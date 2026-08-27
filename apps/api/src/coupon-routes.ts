import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@solid/database';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository } from './auth-repository.js';
import type { CatalogRepository, StoreContext } from './catalog-repository.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string) => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const couponSelect = { publicId: true, code: true, type: true, value: true, minimumSubtotalCents: true, maxDiscountCents: true, maxRedemptions: true, redemptionCount: true, startsAt: true, expiresAt: true, active: true, createdAt: true, updatedAt: true } as const;
const normalizeCode = (value: unknown) => typeof value === 'string' ? value.trim().toUpperCase() : '';
const optionalDate = (value: unknown): Date | null | undefined => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};
const isUniqueConstraintError = (error: unknown): boolean => typeof error === 'object' && error !== null && !Array.isArray(error) && (error as { code?: unknown }).code === 'P2002';

export function registerCouponRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, catalog: CatalogRepository, database: PrismaClient): void {
  const secure = environment.NODE_ENV === 'production';
  const sessionCookie = secure ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = secure ? '__Host-solid_csrf' : 'solid_csrf';
  const authenticate = async (request: FastifyRequest, mutation = false): Promise<StoreContext | null> => {
    const token = request.cookies[sessionCookie]; if (!token) return null;
    const session = await auth.findActiveSession(sha256(token), new Date()); if (!session) return null;
    if (mutation) {
      const origin = request.headers.origin; const cookie = request.cookies[csrfCookie]; const header = request.headers['x-csrf-token'];
      if (typeof origin !== 'string' || !environment.CORS_ORIGINS.includes(origin) || !cookie || typeof header !== 'string' || !safeEqual(cookie, header) || !safeEqual(sha256(header), session.csrfTokenHash)) return null;
    }
    return catalog.resolveStoreContext(session.userId, session.sessionId);
  };
  const canWrite = (context: StoreContext) => context.role === 'OWNER' || context.role === 'ADMIN';
  const parseInput = (body: Record<string, unknown>) => {
    const code = normalizeCode(body.code); const type = body.type; const value = body.value;
    const minimumSubtotalCents = body.minimumSubtotalCents ?? 0; const maxDiscountCents = body.maxDiscountCents ?? null; const maxRedemptions = body.maxRedemptions ?? null;
    const startsAt = optionalDate(body.startsAt); const expiresAt = optionalDate(body.expiresAt);
    if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !['PERCENT', 'FIXED'].includes(String(type)) || !Number.isInteger(value) || Number(value) < 1 || type === 'PERCENT' && Number(value) > 10_000 || !Number.isInteger(minimumSubtotalCents) || Number(minimumSubtotalCents) < 0 || maxDiscountCents !== null && (!Number.isInteger(maxDiscountCents) || Number(maxDiscountCents) < 1) || maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || Number(maxRedemptions) < 1) || startsAt === undefined || expiresAt === undefined || startsAt && expiresAt && startsAt >= expiresAt || typeof body.active !== 'boolean') return null;
    return { code, type: type as 'PERCENT' | 'FIXED', value: Number(value), minimumSubtotalCents: Number(minimumSubtotalCents), maxDiscountCents: maxDiscountCents === null ? null : Number(maxDiscountCents), maxRedemptions: maxRedemptions === null ? null : Number(maxRedemptions), startsAt, expiresAt, active: body.active };
  };

  app.get('/coupons', async (request, reply) => { const context = await authenticate(request); if (!context) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.')); return reply.send({ items: await database.coupon.findMany({ where: { storeId: context.storeId }, orderBy: { createdAt: 'desc' }, select: couponSelect }) }); });
  app.post<{ Body: Record<string, unknown> }>('/coupons', async (request, reply) => { const context = await authenticate(request, true); if (!context || !canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.')); const input = parseInput(request.body); if (!input) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Revise os dados do cupom.')); try { const coupon = await database.coupon.create({ data: { storeId: context.storeId, ...input }, select: couponSelect }); return reply.code(201).send({ coupon }); } catch (error) { if (isUniqueConstraintError(error)) return reply.code(409).send(errorBody(request, 'COUPON_EXISTS', 'Já existe um cupom com este código.')); throw error; } });
  app.put<{ Params: { couponId: string }; Body: Record<string, unknown> }>('/coupons/:couponId', async (request, reply) => { const context = await authenticate(request, true); if (!context || !canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.')); const input = parseInput(request.body); if (!input) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Revise os dados do cupom.')); const current = await database.coupon.findFirst({ where: { publicId: request.params.couponId, storeId: context.storeId }, select: { id: true } }); if (!current) return reply.code(404).send(errorBody(request, 'NOT_FOUND', 'Cupom não encontrado.')); try { return reply.send({ coupon: await database.coupon.update({ where: { id: current.id }, data: input, select: couponSelect }) }); } catch (error) { if (isUniqueConstraintError(error)) return reply.code(409).send(errorBody(request, 'COUPON_EXISTS', 'Já existe um cupom com este código.')); throw error; } });
  app.delete<{ Params: { couponId: string } }>('/coupons/:couponId', async (request, reply) => { const context = await authenticate(request, true); if (!context || !canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.')); const current = await database.coupon.findFirst({ where: { publicId: request.params.couponId, storeId: context.storeId }, select: { id: true, _count: { select: { sessions: true } } } }); if (!current) return reply.code(404).send(errorBody(request, 'NOT_FOUND', 'Cupom não encontrado.')); if (current._count.sessions) await database.coupon.update({ where: { id: current.id }, data: { active: false } }); else await database.coupon.delete({ where: { id: current.id } }); return reply.code(204).send(); });

  app.put<{ Params: { sessionId: string }; Body: { code?: string } }>('/public/checkout-sessions/:sessionId/coupon', { config: { rateLimit: { max: 10, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const authorization = request.headers.authorization; if (!authorization?.startsWith('Bearer ')) return reply.code(401).send(errorBody(request, 'INVALID_SESSION', 'Sessão inválida.'));
    const tokenHash = sha256(authorization.slice(7)); const code = normalizeCode(request.body?.code); const now = new Date();
    const result = await database.$transaction(async transaction => {
      const session = await transaction.checkoutSession.findFirst({ where: { publicId: request.params.sessionId, tokenHash, status: 'OPEN', expiresAt: { gt: now } }, select: { id: true, totalCents: true, shippingPriceCents: true, checkout: { select: { storeId: true } }, paymentAttempts: { take: 1, select: { id: true } } } });
      if (!session) return { error: 'INVALID_SESSION' as const }; if (session.paymentAttempts.length) return { error: 'PAYMENT_STARTED' as const };
      if (!code) { await transaction.checkoutSession.update({ where: { id: session.id }, data: { couponId: null, couponCode: null, discountCents: 0 } }); return { discountCents: 0, code: null, subtotalCents: session.totalCents, shippingPriceCents: session.shippingPriceCents, grandTotalCents: session.totalCents + session.shippingPriceCents }; }
      const coupon = await transaction.coupon.findFirst({ where: { storeId: session.checkout.storeId, code, active: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] }, select: { id: true, code: true, type: true, value: true, minimumSubtotalCents: true, maxDiscountCents: true, maxRedemptions: true, redemptionCount: true } });
      if (!coupon || session.totalCents < coupon.minimumSubtotalCents || coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) return { error: 'INVALID_COUPON' as const };
      let discountCents = coupon.type === 'PERCENT' ? Math.floor(session.totalCents * coupon.value / 10_000) : coupon.value; if (coupon.maxDiscountCents) discountCents = Math.min(discountCents, coupon.maxDiscountCents); discountCents = Math.min(discountCents, session.totalCents - 1);
      await transaction.checkoutSession.update({ where: { id: session.id }, data: { couponId: coupon.id, couponCode: coupon.code, discountCents } });
      return { discountCents, code: coupon.code, subtotalCents: session.totalCents, shippingPriceCents: session.shippingPriceCents, grandTotalCents: session.totalCents - discountCents + session.shippingPriceCents };
    });
    if ('error' in result) return reply.code(result.error === 'PAYMENT_STARTED' ? 409 : 400).send(errorBody(request, result.error, result.error === 'PAYMENT_STARTED' ? 'O pagamento já foi iniciado.' : 'Cupom inválido, expirado ou indisponível.'));
    return reply.send({ coupon: result });
  });
}
