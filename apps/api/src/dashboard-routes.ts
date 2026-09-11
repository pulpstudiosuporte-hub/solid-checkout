import { dashboardRange } from './dashboard-period.js';
import { loadDashboardData } from './dashboard-query.js';
import { createHash } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository } from './auth-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
export function registerDashboardRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  const dashboardCache = new Map<string, { expiresAt: number; payload: unknown }>();
  const cookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';

  app.get<{ Querystring: { period?: string; from?: string; to?: string; store?: string } }>('/dashboard', async (request, reply) => {
    const raw = request.cookies[cookie];
    const session = raw ? await auth.findActiveSession(sha256(raw), new Date()) : null;
    if (!session) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));

    const selected = await db.session.findUnique({ where: { id: session.sessionId }, select: { activeStoreId: true } });
    if (!selected?.activeStoreId) return reply.code(409).send(failure(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    const member = await db.storeMember.findUnique({ where: { storeId_userId: { storeId: selected.activeStoreId, userId: session.userId } }, include: { store: { select: { publicId: true } } } });
    if (!member) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));

    if (request.query.store && request.query.store !== member.store.publicId) return reply.code(409).send(failure(request, 'STORE_CHANGED', 'A loja ativa mudou. Atualize as análises.'));

    const now = new Date();
    let range;
    try { range = dashboardRange(request.query, now); }
    catch (error) { return reply.code(400).send(failure(request, 'INVALID_PERIOD', (error as Error).message)); }
    const { start, end } = range;
    const storeId = selected.activeStoreId;
    const cacheKey = `${storeId}:${session.userId}:${request.query.period || '7d'}:${start.toISOString()}:${request.query.to || end.toISOString().slice(0, 10)}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return reply.header('cache-control', 'private, no-store').send(cached.payload);
    if (cached) dashboardCache.delete(cacheKey);

    const payload = { range: { from: start.toISOString(), to: end.toISOString() }, userName: session.user.name, ...await loadDashboardData(db, storeId, start, end, now) };
    dashboardCache.set(cacheKey, { expiresAt: Date.now() + 15_000, payload });
    while (dashboardCache.size > 500) dashboardCache.delete(dashboardCache.keys().next().value!);
    return reply.header('cache-control', 'private, no-store').send(payload);
  });
}
