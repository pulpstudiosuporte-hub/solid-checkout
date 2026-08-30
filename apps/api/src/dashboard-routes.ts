import { createHash } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository } from './auth-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

type DashboardPeriod = 'today' | 'yesterday' | '7d' | 'month' | 'year';

function periodStart(now: Date, period: DashboardPeriod): Date {
  const today = dayFormatter.format(now);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const start = new Date(Date.UTC(period === 'year' ? year : year, period === 'year' ? 0 : month - 1, period === 'month' || period === 'year' ? 1 : day, 3));
  if (period === '7d') start.setUTCDate(start.getUTCDate() - 6);
  if (period === 'yesterday') start.setUTCDate(start.getUTCDate() - 1);
  return start;
}

export function registerDashboardRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  const cookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';

  app.get<{ Querystring: { period?: string } }>('/dashboard', async (request, reply) => {
    const raw = request.cookies[cookie];
    const session = raw ? await auth.findActiveSession(sha256(raw), new Date()) : null;
    if (!session) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));

    const selected = await db.session.findUnique({ where: { id: session.sessionId }, select: { activeStoreId: true } });
    if (!selected?.activeStoreId) return reply.code(409).send(failure(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    const member = await db.storeMember.findUnique({ where: { storeId_userId: { storeId: selected.activeStoreId, userId: session.userId } } });
    if (!member) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));

    const now = new Date();
    const allowed = new Set<DashboardPeriod>(['today', 'yesterday', '7d', 'month', 'year']);
    const period = allowed.has(request.query.period as DashboardPeriod) ? request.query.period as DashboardPeriod : '7d';
    const start = periodStart(now, period);
    const end = period === 'yesterday' ? new Date(start.getTime() + 86_400_000 - 1) : now;
    const storeId = selected.activeStoreId;

    const [createdSessions, paidAttempts, products, checkouts, published, gateways] = await Promise.all([
      db.checkoutSession.findMany({
        where: { checkout: { storeId }, createdAt: { gte: start, lte: end } },
        select: {
          id: true, status: true, totalCents: true, discountCents: true, couponCode: true,
          customerEmailHash: true, customerCapturedAt: true, shippingCapturedAt: true, createdAt: true,
          items: { select: { titleSnapshot: true, quantity: true, totalCents: true, isOrderBump: true } },
          paymentAttempts: { where: { providerTransactionId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, provider: true, amountCents: true } },
        },
      }),
      db.paymentAttempt.findMany({
        where: { status: 'PAID', paidAt: { gte: start, lte: end }, session: { checkout: { storeId } } },
        orderBy: { paidAt: 'asc' },
        select: { checkoutSessionId: true, amountCents: true, paidAt: true },
      }),
      db.product.count({ where: { storeId, active: true } }),
      db.checkout.count({ where: { storeId, archivedAt: null } }),
      db.checkout.count({ where: { storeId, status: 'PUBLISHED', archivedAt: null } }),
      db.gatewayConnection.count({ where: { storeId, active: true } }),
    ]);

    const paidBySession = new Map<string, { amountCents: number; paidAt: Date }>();
    for (const attempt of paidAttempts) if (attempt.paidAt) paidBySession.set(attempt.checkoutSessionId, { amountCents: attempt.amountCents, paidAt: attempt.paidAt });
    const paid = [...paidBySession.values()];
    const lastDay = period === 'yesterday' ? end : now;
    const days = Math.max(1, Math.round((new Date(`${dayFormatter.format(lastDay)}T03:00:00.000Z`).getTime() - start.getTime()) / 86_400_000) + 1);
    const series = Array.from({ length: days }, (_, index) => {
      const date = new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10);
      const matches = paid.filter(attempt => dayFormatter.format(attempt.paidAt) === date);
      return { date, revenueCents: matches.reduce((sum, attempt) => sum + attempt.amountCents, 0), paidOrders: matches.length };
    });

    const paidCreatedSessions = createdSessions.filter(row => row.paymentAttempts[0]?.status === 'PAID').length;
    const generatedRevenueCents = createdSessions.reduce((sum, row) => sum + (row.totalCents ?? 0), 0);
    const paidRevenueCents = paid.reduce((sum, attempt) => sum + attempt.amountCents, 0);
    const abandoned = createdSessions.filter(row => row.status === 'EXPIRED' || (row.status === 'OPEN' && row.createdAt && row.createdAt < new Date(now.getTime() - 30 * 60_000))).length;
    const pending = createdSessions.filter(row => row.paymentAttempts[0]?.status === 'PENDING').length;
    const refunded = createdSessions.filter(row => row.paymentAttempts[0]?.status === 'REFUNDED').length;
    const cancelled = createdSessions.filter(row => row.status === 'CANCELLED' || row.paymentAttempts[0]?.status === 'CANCELLED').length;
    const customerHashes = createdSessions.map(row => row.customerEmailHash).filter((value): value is string => Boolean(value));
    const uniqueCustomers = new Set(customerHashes).size;
    const couponSessions = createdSessions.filter(row => row.couponCode);
    const bumpItems = createdSessions.flatMap(row => row.items ?? []).filter(item => item.isOrderBump);
    const productMap = new Map<string, { title: string; quantity: number; revenueCents: number }>();
    for (const row of createdSessions) for (const item of row.items ?? []) {
      const current = productMap.get(item.titleSnapshot) || { title: item.titleSnapshot, quantity: 0, revenueCents: 0 };
      current.quantity += item.quantity; current.revenueCents += item.totalCents; productMap.set(item.titleSnapshot, current);
    }
    const gatewayMap = new Map<string, { provider: string; attempts: number; paid: number; revenueCents: number }>();
    for (const row of createdSessions) {
      const attempt = row.paymentAttempts[0]; if (!attempt) continue;
      const current = gatewayMap.get(attempt.provider) || { provider: attempt.provider, attempts: 0, paid: 0, revenueCents: 0 };
      current.attempts += 1; if (attempt.status === 'PAID') { current.paid += 1; current.revenueCents += attempt.amountCents; } gatewayMap.set(attempt.provider, current);
    }
    return reply.header('cache-control', 'private, no-store').send({
      userName: session.user.name,
      revenueCents: paidRevenueCents,
      paidOrders: paid.length,
      pendingPix: pending,
      conversionRate: createdSessions.length ? Math.round(paidCreatedSessions / createdSessions.length * 10_000) / 100 : 0,
      series,
      analytics: {
        sessions: createdSessions.length, generatedRevenueCents, paidRevenueCents,
        averageTicketCents: paid.length ? Math.round(paidRevenueCents / paid.length) : 0,
        abandoned, abandonmentRate: createdSessions.length ? Math.round(abandoned / createdSessions.length * 10_000) / 100 : 0,
        pending, cancelled, refunded, uniqueCustomers,
        checkoutSteps: {
          visitors: createdSessions.length,
          personal: createdSessions.filter(row => row.customerCapturedAt).length,
          shipping: createdSessions.filter(row => row.shippingCapturedAt).length,
          payment: createdSessions.filter(row => row.paymentAttempts.length).length,
          paid: paidCreatedSessions,
        },
        coupons: {
          orders: couponSessions.length,
          revenueCents: couponSessions.reduce((sum, row) => sum + (row.totalCents ?? 0), 0),
          discountCents: couponSessions.reduce((sum, row) => sum + (row.discountCents ?? 0), 0),
        },
        orderBumps: {
          items: bumpItems.reduce((sum, item) => sum + item.quantity, 0),
          revenueCents: bumpItems.reduce((sum, item) => sum + item.totalCents, 0),
        },
        gateways: [...gatewayMap.values()].map(item => ({ ...item, conversionRate: item.attempts ? Math.round(item.paid / item.attempts * 10_000) / 100 : 0 })),
        products: [...productMap.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 8),
      },
      checklist: { store: true, product: products > 0, checkout: checkouts > 0, gateway: gateways > 0, published: published > 0 },
    });
  });
}
