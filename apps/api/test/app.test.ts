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
  it('aplica headers de proteção', async () => {
    const app = buildApp(env); const response = await app.inject({ method: 'GET', url: '/health/live' }); await app.close();
    expect(response.headers['x-content-type-options']).toBe('nosniff'); expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
  it('retorna erro padronizado com request id', async () => {
    const app = buildApp(env); const response = await app.inject({ method: 'GET', url: '/missing' }); await app.close();
    const body = errorResponseSchema.parse(response.json());
    expect(response.statusCode).toBe(404); expect(body.error).toMatchObject({ code: 'NOT_FOUND' }); expect(body.error.requestId).toBeTruthy();
  });
});
