import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@solid/database';
import type { AuthRepository } from '../src/auth-repository.js';
import type { CatalogRepository } from '../src/catalog-repository.js';
import { registerCouponRoutes } from '../src/coupon-routes.js';

const origin = 'http://localhost:5173';
const headers = { origin, cookie: 'solid_session=session; solid_csrf=csrf', 'x-csrf-token': 'csrf' };
const payload = { percentageBps: 500, minimumAmountCents: 0, maximumAmountCents: null, active: true };
async function fixture(role = 'OWNER', attempts: object[] = []) {
  const app = Fastify(); await app.register(cookie);
  const auth = { findActiveSession: vi.fn().mockResolvedValue({ userId: 'user-a', sessionId: 'session-a', csrfTokenHash: createHash('sha256').update('csrf').digest('hex') }) } as unknown as AuthRepository;
  const catalog = { resolveStoreContext: vi.fn().mockResolvedValue({ storeId: 'store-a', role }) } as unknown as CatalogRepository;
  const upsert = vi.fn().mockResolvedValue(payload);
  const update = vi.fn().mockResolvedValue({});
  const transaction = {
    checkoutSession: { findFirst: vi.fn().mockResolvedValue({ id: 'session-a', totalCents: 10_000, shippingPriceCents: 1200, paymentDiscountRule: payload, checkout: { storeId: 'store-a' }, paymentAttempts: attempts }), update },
    coupon: { findFirst: vi.fn().mockResolvedValue({ id: 'coupon-a', code: 'SAVE20', type: 'PERCENT', value: 2000, minimumSubtotalCents: 0, maxDiscountCents: null, maxRedemptions: null, redemptionCount: 0 }) }
  };
  const database = { paymentDiscount: { findUnique: vi.fn().mockResolvedValue(null), upsert }, $transaction: (fn: (tx: typeof transaction) => unknown) => fn(transaction) } as unknown as PrismaClient;
  registerCouponRoutes(app, { NODE_ENV: 'test', API_HOST: 'localhost', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: [origin], TRUST_PROXY: false }, auth, catalog, database);
  return { app, upsert, update };
}
describe('configuração de desconto por loja', () => {
  it('exige sessão para leitura', async () => {
    const { app } = await fixture();
    expect((await app.inject({ url: '/payment-discounts/pix' })).statusCode).toBe(401);
    await app.close();
  });
  it('exige CSRF, origem permitida e permissão de escrita', async () => {
    const { app, upsert } = await fixture();
    expect((await app.inject({ method: 'PUT', url: '/payment-discounts/pix', headers: { cookie: headers.cookie }, payload })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: '/payment-discounts/pix', headers: { ...headers, origin: 'https://other.example' }, payload })).statusCode).toBe(403);
    expect(upsert).not.toHaveBeenCalled(); await app.close();
    const analyst = await fixture('ANALYST');
    expect((await analyst.app.inject({ method: 'PUT', url: '/payment-discounts/pix', headers, payload })).statusCode).toBe(403);
    expect(analyst.upsert).not.toHaveBeenCalled(); await analyst.app.close();
  });
  it('deriva a loja da sessão e ignora storeId enviado pelo cliente', async () => {
    const { app, upsert } = await fixture();
    expect((await app.inject({ method: 'PUT', url: '/payment-discounts/pix', headers, payload: { ...payload, storeId: 'store-b' } })).statusCode).toBe(200);
    const [input] = upsert.mock.calls[0] as [{ where: object; create: { storeId: string } }];
    expect(input.where).toEqual({ storeId_paymentMethod: { storeId: 'store-a', paymentMethod: 'PIX' } });
    expect(input.create.storeId).toBe('store-a'); await app.close();
  });
  it('rejeita percentual inválido antes de gravar', async () => {
    const { app, upsert } = await fixture();
    expect((await app.inject({ method: 'PUT', url: '/payment-discounts/pix', headers, payload: { ...payload, percentageBps: 10001 } })).statusCode).toBe(400);
    expect(upsert).not.toHaveBeenCalled(); await app.close();
  });
  it('aplica e remove cupom sem perder Pix nem descontar frete', async () => {
    const { app } = await fixture();
    const request = { method: 'PUT' as const, url: '/public/checkout-sessions/session-a/coupon', headers: { authorization: 'Bearer session-token' } };
    const applied = await app.inject({ ...request, payload: { code: 'SAVE20' } });
    expect(applied.json<{ coupon: object }>().coupon).toMatchObject({ discountCents: 2400, paymentDiscountCents: 400, grandTotalCents: 8800 });
    const removed = await app.inject({ ...request, payload: { code: '' } });
    expect(removed.json<{ coupon: object }>().coupon).toMatchObject({ discountCents: 500, paymentDiscountCents: 500, grandTotalCents: 10700 });
    await app.close();
  });
  it('bloqueia alteração de cupom depois de iniciar pagamento', async () => {
    const { app, update } = await fixture('OWNER', [{ id: 'attempt-a' }]);
    expect((await app.inject({ method: 'PUT', url: '/public/checkout-sessions/session-a/coupon', headers: { authorization: 'Bearer session-token' }, payload: { code: '' } })).statusCode).toBe(409);
    expect(update).not.toHaveBeenCalled(); await app.close();
  });
});
