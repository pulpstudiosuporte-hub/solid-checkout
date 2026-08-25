import { createHash } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository } from './auth-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

function periodStart(now: Date, period: 'today' | '7d' | 'month'): Date {
  const today = dayFormatter.format(now);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const start = new Date(Date.UTC(year, month - 1, period === 'month' ? 1 : day, 3));
  if (period === '7d') start.setUTCDate(start.getUTCDate() - 6);
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
    const period = request.query.period === 'today' ? 'today' : request.query.period === 'month' ? 'month' : '7d';
    const start = periodStart(now, period);
    const storeId = selected.activeStoreId;

    const [createdSessions, paidAttempts, products, checkouts, published, gateways] = await Promise.all([
      db.checkoutSession.findMany({
        where: { checkout: { storeId }, createdAt: { gte: start, lte: now } },
        select: { id: true, paymentAttempts: { where: { providerTransactionId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } } },
      }),
      db.paymentAttempt.findMany({
        where: { status: 'PAID', paidAt: { gte: start, lte: now }, session: { checkout: { storeId } } },
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
    const days = Math.max(1, Math.round((new Date(`${dayFormatter.format(now)}T03:00:00.000Z`).getTime() - start.getTime()) / 86_400_000) + 1);
    const series = Array.from({ length: days }, (_, index) => {
      const date = new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10);
      const matches = paid.filter(attempt => dayFormatter.format(attempt.paidAt) === date);
      return { date, revenueCents: matches.reduce((sum, attempt) => sum + attempt.amountCents, 0), paidOrders: matches.length };
    });

    const paidCreatedSessions = createdSessions.filter(row => row.paymentAttempts[0]?.status === 'PAID').length;
    return reply.header('cache-control', 'private, no-store').send({
      userName: session.user.name,
      revenueCents: paid.reduce((sum, attempt) => sum + attempt.amountCents, 0),
      paidOrders: paid.length,
      pendingPix: createdSessions.filter(row => row.paymentAttempts[0]?.status === 'PENDING').length,
      conversionRate: createdSessions.length ? Math.round(paidCreatedSessions / createdSessions.length * 10_000) / 100 : 0,
      series,
      checklist: { store: true, product: products > 0, checkout: checkouts > 0, gateway: gateways > 0, published: published > 0 },
    });
  });
}
