import { createHash } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import { describe, expect, it } from 'vitest';
import type { AuthRepository, LoginUser, SessionUser } from '../src/auth-repository.js';
import { buildApp } from '../src/app.js';

const token = 'dashboard-session-token';
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const env: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: ['http://localhost:5173'], TRUST_PROXY: false };

class DashboardAuth implements AuthRepository {
  findUserByEmail(): Promise<LoginUser | null> { return Promise.resolve(null); }
  createSession(): Promise<void> { return Promise.resolve(); }
  findActiveSession(tokenHash: string): Promise<SessionUser | null> { return Promise.resolve(tokenHash === hash(token) ? { sessionId: 'session-a', userId: 'user-a', csrfTokenHash: hash('csrf'), expiresAt: new Date(Date.now() + 60_000), absoluteExpiresAt: new Date(Date.now() + 60_000), user: { publicId: 'user-public', name: 'Ragnar Costa', email: 'owner@example.com' } } : null); }
  touchSession(): Promise<void> { return Promise.resolve(); }
  revokeSession(): Promise<void> { return Promise.resolve(); }
  updatePasswordAndRevokeOtherSessions(): Promise<void> { return Promise.resolve(); }
}

function dashboardDatabase(): PrismaClient {
  return {
    session: { findUnique: () => Promise.resolve({ activeStoreId: 'store-a' }) },
    storeMember: { findUnique: () => Promise.resolve({ storeId: 'store-a', userId: 'user-a' }) },
    checkoutSession: { findMany: () => Promise.resolve([{ id: 'checkout-session-a', paymentAttempts: [{ status: 'PAID' }] }, { id: 'checkout-session-b', paymentAttempts: [{ status: 'PENDING' }] }]) },
    paymentAttempt: { findMany: () => Promise.resolve([{ checkoutSessionId: 'checkout-session-a', amountCents: 13_467, paidAt: new Date() }]) },
    product: { count: () => Promise.resolve(1) },
    checkout: { count: () => Promise.resolve(1) },
    gatewayConnection: { count: () => Promise.resolve(1) },
  } as unknown as PrismaClient;
}

describe('indicadores da loja ativa', () => {
  it('exige autenticação e usa o valor efetivamente pago', async () => {
    const app = buildApp(env, { authRepository: new DashboardAuth(), database: dashboardDatabase() });
    expect((await app.inject({ method: 'GET', url: '/dashboard' })).statusCode).toBe(401);
    const response = await app.inject({ method: 'GET', url: '/dashboard?period=today', headers: { cookie: `solid_session=${token}` } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.json()).toMatchObject({ userName: 'Ragnar Costa', revenueCents: 13_467, paidOrders: 1, pendingPix: 1, conversionRate: 50, checklist: { store: true, product: true, checkout: true, gateway: true, published: true } });
    await app.close();
  });
});
