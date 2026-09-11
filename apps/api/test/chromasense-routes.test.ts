import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { PrismaClient } from '@solid/database';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository } from '../src/auth-repository.js';
import { registerChromaSenseRoutes } from '../src/chromasense-routes.js';

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
const visitId = '12345678-1234-4234-8234-123456789012';
const event = { type: 'SCROLL', scrollPercent: 50 };

function fixture() {
  const checkoutSession = { findFirst: vi.fn().mockResolvedValue({ id: 'checkout-session-a', checkoutId: 'checkout-a', checkout: { storeId: 'store-a' } }) };
  const sessions = { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({ id: 'visit-a' }), findMany: vi.fn().mockResolvedValue([]) };
  const events = { createMany: vi.fn().mockResolvedValue({ count: 1 }), findMany: vi.fn().mockResolvedValue([]) };
  const tx = { $queryRaw: vi.fn(), chromaSenseSession: sessions, chromaSenseEvent: events };
  const db = {
    checkoutSession, chromaSenseSession: sessions, chromaSenseEvent: events,
    $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)),
    session: { findFirst: vi.fn().mockResolvedValue({ activeStoreId: 'store-a' }) },
    storeMember: { findUnique: vi.fn().mockResolvedValue({ id: 'member-a' }) },
    checkout: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const auth = { findActiveSession: vi.fn().mockResolvedValue({ userId: 'user-a', sessionId: 'auth-a' }) };
  const app = Fastify(); apps.push(app);
  app.addHook('onRequest', (request, _reply, done) => { request.cookies = { solid_session: 'session-token' }; done(); });
  registerChromaSenseRoutes(app, { NODE_ENV: 'test' } as AppEnvironment, auth as unknown as AuthRepository, db as unknown as PrismaClient);
  const post = (batch: unknown[] = [event]) => app.inject({ method: 'POST', url: '/public/checkout-sessions/session-public/chromasense/events', headers: { authorization: `Bearer ${'t'.repeat(43)}` }, payload: { visitId, events: batch } });
  return { app, db, sessions, events, checkoutSession, tx, post };
}

describe('ChromaSense route boundaries', () => {
  it('rejects a visit belonging to a different checkout session without mutating it', async () => {
    const { post, sessions, events, tx } = fixture();
    sessions.findUnique.mockResolvedValue({ checkoutSessionId: 'another-session', eventCount: 1, maxScrollPercent: 20 });
    expect((await post()).statusCode).toBe(409);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(sessions.upsert).not.toHaveBeenCalled();
    expect(events.createMany).not.toHaveBeenCalled();
  });

  it('caps accepted events and keeps the greatest scroll depth inside one transaction', async () => {
    const { post, db, sessions, events } = fixture();
    sessions.findUnique.mockResolvedValue({ checkoutSessionId: 'checkout-session-a', eventCount: 9999, maxScrollPercent: 90 });
    const response = await post([event, event]);
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: 1 });
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(sessions.upsert.mock.calls[0]?.[0]).toMatchObject({ update: { eventCount: { increment: 1 }, maxScrollPercent: 90 } });
    expect(events.createMany.mock.calls[0]?.[0]).toMatchObject({ data: [{ sessionId: 'visit-a', scrollPercent: 50 }] });
    sessions.findUnique.mockResolvedValue({ checkoutSessionId: 'checkout-session-a', eventCount: 10000, maxScrollPercent: 90 });
    expect((await post()).statusCode).toBe(204);
    expect(events.createMany).toHaveBeenCalledOnce();
  });

  it('requires an unexpired checkout token before accepting events', async () => {
    const { post, checkoutSession, sessions } = fixture();
    checkoutSession.findFirst.mockResolvedValue(null);
    expect((await post()).statusCode).toBe(404);
    const query = checkoutSession.findFirst.mock.calls[0]?.[0] as { where: { expiresAt: { gt: Date } } };
    expect(query.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(sessions.upsert).not.toHaveBeenCalled();
  });

  it('reports sessions reaching each scroll threshold, scoped to the active store', async () => {
    const { app, sessions, events } = fixture();
    sessions.findMany.mockResolvedValue([10, 30, 60, 100].map((depth, index) => ({ id: `visit-${index}`, publicId: `public-${index}`, deviceType: 'mobile', eventCount: 1, activeMs: 0, maxScrollPercent: depth, rageClickCount: 0, deadClickCount: 0, checkout: { publicId: 'checkout-public', name: 'Checkout' }, checkoutSession: { status: 'OPEN' } })));
    const response = await app.inject({ url: '/chromasense?device=mobile&checkoutId=checkout-public' });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ scroll: { distribution: number[] } }>().scroll.distribution).toEqual([3, 2, 1, 1]);
    expect(sessions.findMany.mock.calls[0]?.[0]).toMatchObject({ where: { storeId: 'store-a', deviceType: 'mobile', checkout: { publicId: 'checkout-public' } } });
    expect(events.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: 'desc' } }));
  });
});
