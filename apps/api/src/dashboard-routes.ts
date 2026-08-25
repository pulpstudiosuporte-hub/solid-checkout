import { createHash } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository } from './auth-repository.js';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
export function registerDashboardRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  const cookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';
  app.get<{ Querystring: { period?: string } }>('/dashboard', async (request, reply) => {
    const raw = request.cookies[cookie]; const session = raw ? await auth.findActiveSession(sha256(raw), new Date()) : null;
    if (!session) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const selected = await db.session.findUnique({ where: { id: session.sessionId }, select: { activeStoreId: true } }); if (!selected?.activeStoreId) return reply.code(409).send(failure(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    const member = await db.storeMember.findUnique({ where: { storeId_userId: { storeId: selected.activeStoreId, userId: session.userId } } }); if (!member) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));
    const now = new Date(); const period = request.query.period === 'today' ? 'today' : request.query.period === 'month' ? 'month' : '7d'; const start = period === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : period === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getTime() - 6 * 86400000); start.setHours(0, 0, 0, 0);
    const rows = await db.checkoutSession.findMany({ where: { checkout: { storeId: selected.activeStoreId }, createdAt: { gte: start } }, select: { createdAt: true, totalCents: true, shippingPriceCents: true, paymentAttempts: { where: { providerTransactionId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, paidAt: true } } } });
    const paid = rows.filter(row => row.paymentAttempts[0]?.status === 'PAID'); const days = Math.max(1, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - start.getTime()) / 86400000) + 1); const series = Array.from({ length: days }, (_, index) => { const date = new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10); const matches = paid.filter(row => (row.paymentAttempts[0]?.paidAt ?? row.createdAt).toISOString().slice(0, 10) === date); return { date, revenueCents: matches.reduce((sum, row) => sum + row.totalCents + row.shippingPriceCents, 0), paidOrders: matches.length }; });
    const storeId = selected.activeStoreId; const [products, checkouts, published, gateways] = await Promise.all([db.product.count({ where: { storeId, active: true } }), db.checkout.count({ where: { storeId, archivedAt: null } }), db.checkout.count({ where: { storeId, status: 'PUBLISHED', archivedAt: null } }), db.gatewayConnection.count({ where: { storeId, active: true } })]);
    return reply.header('cache-control', 'private, no-store').send({ userName: session.user.name, revenueCents: paid.reduce((sum, row) => sum + row.totalCents + row.shippingPriceCents, 0), paidOrders: paid.length, pendingPix: rows.filter(row => row.paymentAttempts[0]?.status === 'PENDING').length, conversionRate: rows.length ? Math.round(paid.length / rows.length * 10000) / 100 : 0, series, checklist: { store: true, product: products > 0, checkout: checkouts > 0, gateway: gateways > 0, published: published > 0 } });
  });
}
