import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import { buildApp } from '../src/app.js';
import type { AuthRepository, LoginUser, SessionUser } from '../src/auth-repository.js';
import type { OrderRecord, OrderRepository } from '../src/order-repository.js';
import { encryptSecret } from '../src/shopify-crypto.js';

const sessionToken = 'order-session-token';
const encryptionKey = Buffer.alloc(32, 7).toString('base64');
const env: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: ['http://localhost:5173'], TRUST_PROXY: false, APP_ENCRYPTION_KEY: encryptionKey };
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

class MemoryAuth implements AuthRepository {
  findUserByEmail(): Promise<LoginUser | null> { return Promise.resolve(null); }
  createSession(): Promise<void> { return Promise.resolve(); }
  findActiveSession(tokenHash: string): Promise<SessionUser | null> { return Promise.resolve(tokenHash === sha256(sessionToken) ? { sessionId: 'session-a', userId: 'user-a', csrfTokenHash: sha256('csrf'), expiresAt: new Date(Date.now() + 60_000), absoluteExpiresAt: new Date(Date.now() + 60_000), user: { publicId: 'user-public', name: 'Owner', email: 'owner@example.com' } } : null); }
  touchSession(): Promise<void> { return Promise.resolve(); }
  revokeSession(): Promise<void> { return Promise.resolve(); }
  updatePasswordAndRevokeOtherSessions(): Promise<void> { return Promise.resolve(); }
}

class MemoryOrders implements OrderRepository {
  context(userId: string, sessionId: string) { return Promise.resolve(userId === 'user-a' && sessionId === 'session-a' ? { storeId: 'store-a' } : null); }
  private readonly order: OrderRecord = { publicId: 'orderpublic01', status: 'COMPLETED', totalCents: 500, shippingPriceCents: 0, currency: 'BRL', customerDataEncrypted: encryptSecret(JSON.stringify({ name: 'Cliente Teste', email: 'cliente@example.com', document: '123' }), encryptionKey), shippingAddressEncrypted: encryptSecret(JSON.stringify({ street: 'Rua Teste', number: '10', postalCode: '01001000', city: 'São Paulo', state: 'SP' }), encryptionKey), shippingMethodName: 'Frete grátis', createdAt: new Date('2026-08-15T12:00:00Z'), completedAt: new Date('2026-08-15T12:01:00Z'), items: [{ titleSnapshot: 'Produto teste', variantSnapshot: null, quantity: 1, imageUrlSnapshot: null }], paymentAttempts: [{ publicId: 'paymentpublic01', provider: 'WESTPAY', status: 'PAID', createdAt: new Date('2026-08-15T12:00:30Z'), paidAt: new Date('2026-08-15T12:01:00Z'), expiresAt: null }] };
  list(): Promise<{ items: readonly OrderRecord[]; total: number }> { return Promise.resolve({ total: 1, items: [this.order] }); }
  find(_storeId: string, publicId: string): Promise<OrderRecord | null> { return Promise.resolve(publicId === this.order.publicId ? this.order : null); }
}

describe('pedidos da loja ativa', () => {
  it('exige autenticação e devolve apenas dados necessários à lista', async () => {
    const app = buildApp(env, { authRepository: new MemoryAuth(), orderRepository: new MemoryOrders() });
    expect((await app.inject({ method: 'GET', url: '/orders' })).statusCode).toBe(401);
    const response = await app.inject({ method: 'GET', url: '/orders?page=1&pageSize=5', headers: { cookie: `solid_session=${sessionToken}` } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.json()).toMatchObject({ total: 1, items: [{ publicId: 'orderpublic01', status: 'PAID', totalCents: 500, customer: { name: 'Cliente Teste', email: 'cliente@example.com' } }] });
    expect(response.body).not.toContain('123');
    await app.close();
  });

  it('retorna endereço apenas no detalhe autorizado', async () => {
    const app = buildApp(env, { authRepository: new MemoryAuth(), orderRepository: new MemoryOrders() });
    const response = await app.inject({ method: 'GET', url: '/orders/orderpublic01', headers: { cookie: `solid_session=${sessionToken}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ customer: { name: 'Cliente Teste' }, shippingAddress: { street: 'Rua Teste', number: '10', city: 'São Paulo' } });
    expect(response.body).not.toContain('"document"');
    await app.close();
  });
});
