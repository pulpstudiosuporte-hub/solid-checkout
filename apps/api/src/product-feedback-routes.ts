import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { AuthRepository } from './auth-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(sha256(left), 'hex'); const b = Buffer.from(sha256(right), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
};
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().replace(/\0/g, '').slice(0, max) : '';

export function registerProductFeedbackRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  const sessionCookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = environment.NODE_ENV === 'production' ? '__Host-solid_csrf' : 'solid_csrf';
  const context = async (request: FastifyRequest, mutation = false) => {
    const token = request.cookies[sessionCookie];
    const current = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
    if (!current) return null;
    if (mutation) {
      const origin = request.headers.origin; const cookie = request.cookies[csrfCookie]; const header = request.headers['x-csrf-token'];
      if (typeof origin !== 'string' || !environment.CORS_ORIGINS.includes(origin) || !cookie || typeof header !== 'string' || !safeEqual(cookie, header) || !safeEqual(sha256(header), current.csrfTokenHash)) return null;
    }
    const session = await db.session.findFirst({ where: { id: current.sessionId, userId: current.userId, revokedAt: null }, select: { activeStoreId: true } });
    return { userId: current.userId, storeId: session?.activeStoreId ?? null };
  };

  app.get('/product-feedback', async (request, reply) => {
    const actor = await context(request);
    if (!actor) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const items = await db.productFeedback.findMany({
      take: 100,
      orderBy: [{ createdAt: 'desc' }],
      select: { publicId: true, type: true, status: true, title: true, description: true, createdAt: true, user: { select: { name: true } }, votes: { select: { userId: true } } }
    });
    return reply.header('cache-control', 'no-store').send({ items: items.map(item => ({ publicId: item.publicId, type: item.type, status: item.status, title: item.title, description: item.description, createdAt: item.createdAt, author: item.user.name, votes: item.votes.length, voted: item.votes.some(vote => vote.userId === actor.userId) })) });
  });

  app.post<{ Body: { type?: string; title?: string; description?: string } }>('/product-feedback', async (request, reply) => {
    const actor = await context(request, true);
    if (!actor) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Sessão ou proteção CSRF inválida.'));
    const type = request.body?.type === 'BUG' ? 'BUG' : 'SUGGESTION';
    const title = clean(request.body?.title, 120); const description = clean(request.body?.description, 2_000);
    if (title.length < 5 || description.length < 10) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Informe um título e descreva a ideia com mais detalhes.'));
    const feedback = await db.productFeedback.create({ data: { userId: actor.userId, storeId: actor.storeId, type, title, description }, select: { publicId: true, type: true, status: true, title: true, description: true, createdAt: true, user: { select: { name: true } } } });
    return reply.code(201).send({ feedback: { ...feedback, author: feedback.user.name, user: undefined, votes: 0, voted: false } });
  });

  app.post<{ Params: { feedbackId: string } }>('/product-feedback/:feedbackId/vote', async (request, reply) => {
    const actor = await context(request, true);
    if (!actor) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Sessão ou proteção CSRF inválida.'));
    const publicId = clean(request.params.feedbackId, 32);
    const feedback = await db.productFeedback.findUnique({ where: { publicId }, select: { id: true } });
    if (!feedback) return reply.code(404).send(errorBody(request, 'NOT_FOUND', 'Sugestão não encontrada.'));
    const existing = await db.productFeedbackVote.findUnique({ where: { feedbackId_userId: { feedbackId: feedback.id, userId: actor.userId } }, select: { id: true } });
    if (existing) await db.productFeedbackVote.delete({ where: { id: existing.id } });
    else await db.productFeedbackVote.create({ data: { feedbackId: feedback.id, userId: actor.userId } });
    const votes = await db.productFeedbackVote.count({ where: { feedbackId: feedback.id } });
    return reply.send({ voted: !existing, votes });
  });
}
