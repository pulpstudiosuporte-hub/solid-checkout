import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { AuthRepository } from '../src/auth-repository.js';
import { registerWebhookRoutes } from '../src/webhook-routes.js';

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
function fixture(role = 'OWNER') {
  const endpoint = { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({ publicId: 'endpoint-a' }), findFirst: vi.fn().mockResolvedValue(null) };
  const delivery = { create: vi.fn() };
  const tx = { $queryRaw: vi.fn(), webhookEndpoint: endpoint };
  const db = { webhookEndpoint: endpoint, webhookDelivery: delivery, $transaction: vi.fn(async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx)), session: { findFirst: vi.fn().mockResolvedValue({ activeStoreId: 'store-a' }) }, storeMember: { findUnique: vi.fn().mockResolvedValue({ role }) } };
  const auth = { findActiveSession: vi.fn().mockResolvedValue({ sessionId: 'session-a', userId: 'user-a', csrfTokenHash: createHash('sha256').update('csrf-test').digest('hex') }) };
  const app = Fastify(); apps.push(app);
  app.addHook('onRequest', (request, _reply, done) => { request.cookies = { solid_session: 'session-test', solid_csrf: 'csrf-test' }; done(); });
  registerWebhookRoutes(app, { NODE_ENV: 'test', CORS_ORIGINS: ['https://app.example.com'], APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') } as AppEnvironment, auth as unknown as AuthRepository, db as unknown as PrismaClient);
  const headers = { origin: 'https://app.example.com', 'x-csrf-token': 'csrf-test' };
  const post = () => app.inject({ method: 'POST', url: '/store-webhooks', headers, payload: { name: 'ERP', url: 'https://1.1.1.1/hook', events: ['order.paid'] } });
  return { app, endpoint, delivery, tx, headers, post };
}
describe('webhook administration', () => {
  it('rejects read-only users before creating an endpoint', async () => {
    const { post, endpoint } = fixture('VIEWER');
    expect((await post()).statusCode).toBe(403);
    expect(endpoint.create).not.toHaveBeenCalled();
  });
  it('enforces the endpoint quota under the transaction lock', async () => {
    const { post, endpoint, tx } = fixture();
    endpoint.count.mockResolvedValue(20);
    expect((await post()).statusCode).toBe(409);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(endpoint.create).not.toHaveBeenCalled();
    endpoint.count.mockResolvedValue(19);
    const response = await post();
    expect(response.statusCode).toBe(201);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(endpoint.create.mock.calls[0]?.[0]).toMatchObject({ data: { storeId: 'store-a', events: ['order.paid'] } });
  });
  it('does not enqueue tests for inactive endpoints or endpoints from another store', async () => {
    const { app, endpoint, delivery, headers } = fixture();
    const test = () => app.inject({ method: 'POST', url: '/store-webhooks/endpoint-b/test', headers, payload: {} });
    expect((await test()).statusCode).toBe(404);
    expect(endpoint.findFirst.mock.calls[0]?.[0]).toMatchObject({ where: { publicId: 'endpoint-b', storeId: 'store-a' } });
    endpoint.findFirst.mockResolvedValue({ id: 'endpoint-a', active: false });
    expect((await test()).statusCode).toBe(409);
    expect(delivery.create).not.toHaveBeenCalled();
  });
  it('rejects invalid CSRF before enqueueing an outbound request', async () => {
    const { app, delivery, headers } = fixture();
    const response = await app.inject({ method: 'POST', url: '/store-webhooks/endpoint-a/test', headers: { ...headers, 'x-csrf-token': 'wrong' }, payload: {} });
    expect(response.statusCode).toBe(403);
    expect(delivery.create).not.toHaveBeenCalled();
  });
});
