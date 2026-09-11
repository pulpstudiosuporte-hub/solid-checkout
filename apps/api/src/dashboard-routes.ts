import { loadDashboardData } from './dashboard-query.js';
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
  const dashboardCache = new Map<string, { expiresAt: number; payload: unknown }>();
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
    const cacheKey = `${storeId}:${session.userId}:${period}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return reply.header('cache-control', 'private, no-store').send(cached.payload);
    if (cached) dashboardCache.delete(cacheKey);

    const payload = { userName: session.user.name, ...await loadDashboardData(db, storeId, start, end, now) };
    dashboardCache.set(cacheKey, { expiresAt: Date.now() + 15_000, payload });
    while (dashboardCache.size > 500) dashboardCache.delete(dashboardCache.keys().next().value!);
    return reply.header('cache-control', 'private, no-store').send(payload);
  });
}
