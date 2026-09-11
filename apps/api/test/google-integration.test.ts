import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@solid/database';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository } from '../src/auth-repository.js';
import { emptyGoogleConfig, parseGoogleConfig, registerGoogleIntegration } from '../src/google-integration.js';
import { decryptSecret, encryptSecret } from '../src/shopify-crypto.js';

const key = Buffer.alloc(32, 4).toString('base64');
const config = { ...emptyGoogleConfig, measurementId: 'G-ABCDE12345', adsId: 'AW-12345678', conversionLabel: 'label_123' };
const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

function fixture(role = 'OWNER') {
  const connection = { findUnique: vi.fn().mockResolvedValue({ active: true, publicKeyEncrypted: encryptSecret(JSON.stringify(config), key), updatedAt: new Date() }), upsert: vi.fn().mockResolvedValue({ updatedAt: new Date() }), updateMany: vi.fn() };
  const activeSession = { activeStoreId: 'store-a' };
  const checkout = { publicId: 'order-123', totalCents: 10000, discountCents: 1500, paymentDiscountCents: 500, shippingPriceCents: 1000, currency: 'BRL', quantity: 2, unitPriceCents: 5000, trackingParameters: { gclid: 'click-id', utm_source: 'google', utm_term: 'user@example.com', token: 'private-token' },
    checkout: { publicId: 'checkout-a', storeId: 'store-a', store: { publicId: 'public-store-a' }, product: { publicId: 'product-a', checkoutTitle: 'Produto' } }, items: [], paymentAttempts: [] as { amountCents: number }[] };
  const current = { sessionId: 'session-a', userId: 'user-a', csrfTokenHash: createHash('sha256').update('csrf').digest('hex'), user: { mfaEnabled: false }, mfaVerifiedAt: null as Date | null };
  const tx = { gatewayConnection: connection, auditLog: { create: vi.fn() } };
  const db = { ...tx, session: { findFirst: vi.fn().mockResolvedValue(activeSession) }, storeMember: { findUnique: vi.fn().mockResolvedValue({ role, store: { publicId: 'public-store-a' } }) }, checkoutSession: { findFirst: vi.fn().mockResolvedValue(checkout) }, $transaction: vi.fn(async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx)) };
  const auth = { findActiveSession: vi.fn().mockResolvedValue(current) };
  const app = Fastify(); apps.push(app);
  app.addHook('onRequest', (request, _reply, done) => { request.cookies = { solid_session: 'session-cookie', solid_csrf: 'csrf' }; done(); });
  registerGoogleIntegration(app, { NODE_ENV: 'test', CORS_ORIGINS: ['https://app.example.com'], APP_ENCRYPTION_KEY: key } as AppEnvironment, auth as unknown as AuthRepository, db as unknown as PrismaClient);
  const headers = { origin: 'https://app.example.com', 'x-csrf-token': 'csrf' };
  const publicRead = () => app.inject({ url: '/public/checkout-sessions/order-123/tracking/google', headers: { authorization: `Bearer ${'a'.repeat(32)}` } });
  return { app, db, tx, current, activeSession, connection, checkout, headers, publicRead };
}

describe('merchant Google integrations', () => {
  it('validates GA4/Ads/GTM identifiers and prevents double installation', () => {
    expect(parseGoogleConfig(config)).toEqual(config);
    expect(parseGoogleConfig({ ...emptyGoogleConfig, mode: 'gtm', containerId: 'GTM-ABCDEF' }).mode).toBe('gtm');
    for (const invalid of [{ ...config, measurementId: 'UA-12345-1' }, { ...config, measurementId: '<script>' }, { ...config, conversionLabel: '' }, { ...config, propertyId: '123/evil' }, { ...config, containerId: 'GTM-ABCDE' }, { ...config, mode: 'gtm', containerId: 'GTM-ABCDE' }, { ...emptyGoogleConfig }]) expect(() => parseGoogleConfig(invalid)).toThrow();
  });
  it('scopes reads and writes to the active merchant store and encrypts saved config', async () => {
    const f = fixture();
    const response = await f.app.inject({ method: 'PUT', url: '/integrations/google?store=public-store-a', headers: f.headers, payload: config });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    const input = f.connection.upsert.mock.calls[0]?.[0] as { where: unknown; create: { verifiedAt: Date | null; publicKeyEncrypted: string } };
    expect(input.where).toEqual({ storeId_provider: { storeId: 'store-a', provider: 'GOOGLE' } });
    expect(input.create.verifiedAt).toBeNull();
    expect(JSON.parse(decryptSecret(input.create.publicKeyEncrypted, key))).toEqual(config);
    expect(f.tx.auditLog.create).toHaveBeenCalledOnce();
    f.activeSession.activeStoreId = 'store-b';
    await f.app.inject({ url: '/integrations/google' });
    expect(f.connection.findUnique).toHaveBeenLastCalledWith(expect.objectContaining({ where: { storeId_provider: { storeId: 'store-b', provider: 'GOOGLE' } } }));
  });
  it('enforces read-only role, CSRF, origin and MFA for mutations', async () => {
    const analyst = fixture('ANALYST');
    expect((await analyst.app.inject({ url: '/integrations/google' })).json<{ writable: boolean }>().writable).toBe(false);
    for (const method of ['PUT', 'DELETE'] as const) expect((await analyst.app.inject({ method, url: '/integrations/google?store=public-store-a', headers: analyst.headers, ...(method === 'PUT' ? { payload: config } : {}) })).statusCode).toBe(403);
    const f = fixture();
    for (const headers of [{ ...f.headers, 'x-csrf-token': 'wrong' }, { ...f.headers, origin: 'https://evil.example' }]) expect((await f.app.inject({ method: 'PUT', url: '/integrations/google?store=public-store-a', headers, payload: config })).statusCode).toBe(403);
    expect((await f.app.inject({ method: 'PUT', url: '/integrations/google?store=public-store-b', headers: f.headers, payload: config })).statusCode).toBe(403);
    f.current.user.mfaEnabled = true;
    expect((await f.app.inject({ method: 'PUT', url: '/integrations/google?store=public-store-a', headers: f.headers, payload: config })).statusCode).toBe(403);
    expect(f.connection.upsert).not.toHaveBeenCalled();
  });
  it('requires the checkout token and an unexpired or recently completed session', async () => {
    const f = fixture();
    expect((await f.app.inject({ url: '/public/checkout-sessions/order-123/tracking/google' })).statusCode).toBe(401);
    f.db.checkoutSession.findFirst.mockResolvedValueOnce(null);
    expect((await f.publicRead()).statusCode).toBe(404);
    const query = f.db.checkoutSession.findFirst.mock.calls[0]?.[0] as { where: { publicId: string; tokenHash: string; OR: [{ expiresAt: { gt: Date } }, { completedAt: { gte: Date } }] } };
    expect(query.where).toMatchObject({ publicId: 'order-123', tokenHash: createHash('sha256').update('a'.repeat(32)).digest('hex') });
    expect(query.where.OR[0].expiresAt.gt).toBeInstanceOf(Date);
    expect(query.where.OR[1].completedAt.gte).toBeInstanceOf(Date);
  });
  it('uses confirmed payments, counts discounts once and excludes sensitive tracking data', async () => {
    const f = fixture();
    const pending = (await f.publicRead()).json<{ purchase: boolean; orderValue: number; ecommerce: { value: number; items: unknown[] }; attribution: unknown }>();
    expect(pending.purchase).toBe(false);
    expect(pending.ecommerce.value).toBe(85);
    expect(pending.orderValue).toBe(95);
    expect(pending.ecommerce.items).toEqual([{ item_id: 'product-a', item_name: 'Produto', price: 42.5, quantity: 2 }]);
    expect(pending.attribution).toEqual({ gclid: 'click-id', utm_source: 'google' });
    f.checkout.paymentAttempts = [{ amountCents: 9000 }];
    const paid = (await f.publicRead()).json<{ purchase: boolean; orderValue: number; ecommerce: { value: number }; transactionId: string }>();
    expect(paid.purchase).toBe(true);
    expect(paid.ecommerce.value).toBe(80);
    expect(paid.orderValue).toBe(90);
    expect(paid.transactionId).toBe('order-123');
    expect(f.db.checkoutSession.findFirst.mock.calls[0]?.[0]).toMatchObject({ select: { paymentAttempts: { where: { status: 'PAID' } } } });
    expect(JSON.stringify(paid)).not.toMatch(/private-token|user@example|apiKeyEncrypted|publicKeyEncrypted/);
  });
  it('disconnects only the selected store and stops exposing its configuration', async () => {
    const f = fixture();
    expect((await f.app.inject({ method: 'DELETE', url: '/integrations/google?store=public-store-a', headers: f.headers })).statusCode).toBe(204);
    expect(f.connection.updateMany).toHaveBeenCalledWith({ where: { storeId: 'store-a', provider: 'GOOGLE' }, data: { active: false } });
    f.connection.findUnique.mockResolvedValue({ active: false });
    expect((await f.publicRead()).json()).toEqual({ config: null });
  });
});
