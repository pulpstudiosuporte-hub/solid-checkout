import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { AuthRepository } from '../src/auth-repository.js';
import type { CatalogRepository } from '../src/catalog-repository.js';
import { registerCouponRoutes } from '../src/coupon-routes.js';
import { createHash } from 'node:crypto';

const now = Date.now(), expiresAt = new Date(now + 600000), couponExpiry = new Date(now + 300000);
const session = { totalCents: 10000, couponCode: null, expiresAt, checkout: { storeId: 'store-a', publishedConfig: { exitOfferEnabled: true, exitOfferCouponCode: 'FICA10' } }, paymentAttempts: [] };
const coupon = { code: 'FICA10', type: 'PERCENT', value: 1000, minimumSubtotalCents: 0, maxDiscountCents: null, maxRedemptions: null, redemptionCount: 0, expiresAt: couponExpiry };
function fixture() {
  const findSession = vi.fn().mockResolvedValue(structuredClone(session));
  const findCoupon = vi.fn().mockResolvedValue(structuredClone(coupon));
  const app = Fastify();
  registerCouponRoutes(app, { NODE_ENV: 'test', CORS_ORIGINS: [] } as unknown as AppEnvironment, {} as AuthRepository, {} as CatalogRepository, { checkoutSession: { findFirst: findSession }, coupon: { findFirst: findCoupon } } as unknown as PrismaClient);
  return { app, findSession, findCoupon };
}
const request = { method: 'GET' as const, url: '/public/checkout-sessions/public-session/exit-offer', headers: { authorization: 'Bearer secret-session-token' } };
describe('exit offer eligibility', () => {
  it('authenticates the checkout session and uses only its published coupon and store', async () => {
    const f = fixture();
    try {
      expect((await f.app.inject({ ...request, headers: {} })).statusCode).toBe(401);
      const response = await f.app.inject(request);
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.json<{ offer: unknown }>().offer).toEqual({ code: 'FICA10', type: 'PERCENT', value: 1000, couponDiscountCents: 1000, capped: false, expiresAt: couponExpiry.toISOString() });
      expect(f.findSession).toHaveBeenCalledWith(expect.objectContaining({ where: { publicId: 'public-session', tokenHash: createHash('sha256').update('secret-session-token').digest('hex'), status: 'OPEN', expiresAt: { gt: expect.any(Date) as Date } } }));
      expect(f.findCoupon).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ storeId: 'store-a', code: 'FICA10', active: true, AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) as Date } }] }] }) as unknown }));
      f.findSession.mockResolvedValue(null);
      expect((await f.app.inject(request)).statusCode).toBe(401);
    } finally { await f.app.close(); }
  });
  it('does not offer a discount after payment starts, with a coupon already applied or when disabled', async () => {
    const f = fixture();
    try {
      for (const change of [{ paymentAttempts: [{ id: 'payment' }] }, { couponCode: 'OTHER' }, { checkout: { storeId: 'store-a', publishedConfig: { exitOfferEnabled: false } } }]) {
        f.findSession.mockResolvedValue({ ...session, ...change });
        expect((await f.app.inject(request)).json<{ offer: unknown }>().offer).toBeNull();
      }
      expect(f.findCoupon).not.toHaveBeenCalled();
    } finally { await f.app.close(); }
  });
  it('honors minimum, exhausted coupon, caps and session deadline without restarting countdown', async () => {
    const f = fixture();
    try {
      for (const value of [null, { ...coupon, minimumSubtotalCents: 11000 }, { ...coupon, maxRedemptions: 1, redemptionCount: 1 }]) {
        f.findCoupon.mockResolvedValue(value);
        expect((await f.app.inject(request)).json<{ offer: unknown }>().offer).toBeNull();
      }
      f.findCoupon.mockResolvedValue({ ...coupon, maxDiscountCents: 500, expiresAt: null });
      for (let i = 0; i < 2; i++) expect((await f.app.inject(request)).json<{ offer: unknown }>().offer).toMatchObject({ capped: true, couponDiscountCents: 500, expiresAt: expiresAt.toISOString() });
    } finally { await f.app.close(); }
  });
});
