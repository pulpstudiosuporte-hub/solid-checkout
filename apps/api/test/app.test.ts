import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { errorResponseSchema } from '@solid/contracts';
import type { AppEnvironment } from '@solid/config';

const env: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: ['http://localhost:5173'], TRUST_PROXY: false };

describe('API foundation', () => {
  it('responde ao health check sem vazar implementação', async () => {
    const app = buildApp(env); const response = await app.inject({ method: 'GET', url: '/health/live' }); await app.close();
    expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({ status: 'ok', service: 'solid-api' });
  });
  it('nao declara prontidao quando o banco nao esta disponivel', async () => {
    const app = buildApp(env); const response = await app.inject({ method: 'GET', url: '/health/ready' }); await app.close();
    expect(response.statusCode).toBe(503); expect(response.json()).toMatchObject({ status: 'error', database: 'unavailable' });
  });
  it('aplica headers de proteção', async () => {
    const app = buildApp(env); const response = await app.inject({ method: 'GET', url: '/health/live' }); await app.close();
    expect(response.headers['x-content-type-options']).toBe('nosniff'); expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
  it('retorna erro padronizado com request id', async () => {
    const app = buildApp(env); const response = await app.inject({ method: 'GET', url: '/missing' }); await app.close();
    const body = errorResponseSchema.parse(response.json());
    expect(response.statusCode).toBe(404); expect(body.error).toMatchObject({ code: 'NOT_FOUND' }); expect(body.error.requestId).toBeTruthy();
  });
  it('preserva erros de requisicao sem transforma-los em falha interna', async () => {
    const app = buildApp(env);
    const malformed = await app.inject({
      method: 'POST',
      url: '/missing',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });
    const oversized = await app.inject({
      method: 'POST',
      url: '/missing',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ value: 'x'.repeat(1_048_576) }),
    });
    await app.close();

    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
  });
  it('gera request id no servidor e ignora valores enviados pelo cliente', async () => {
    const app = buildApp(env);
    const accepted = await app.inject({ method: 'GET', url: '/missing', headers: { 'x-request-id': 'checkout:request-123' } });
    const rejected = await app.inject({ method: 'GET', url: '/missing', headers: { 'x-request-id': 'valor com espaços' } });
    await app.close();
    const acceptedBody = errorResponseSchema.parse(accepted.json());
    const rejectedBody = errorResponseSchema.parse(rejected.json());
    expect(acceptedBody.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(rejectedBody.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(acceptedBody.error.requestId).not.toBe('checkout:request-123');
  });
});
