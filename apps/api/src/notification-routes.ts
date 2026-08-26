import { createHash, timingSafeEqual } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository } from './auth-repository.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const same = (left: string, right: string) => { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); };
const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const actions = ['payment.webhook_verified', 'integration.event_failed', 'integration.shopify_reconnect_required', 'store_domain.not_verified', 'store_domain.activated', 'integration.shopify_connected'] as const;

const metadata = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
function content(action: string, raw: unknown) {
  const data = metadata(raw); const provider = typeof data.provider === 'string' ? data.provider : 'integração'; const payment = typeof data.providerStatus === 'string' ? data.providerStatus.toUpperCase() : typeof data.paymentStatus === 'string' ? data.paymentStatus : '';
  if (action === 'payment.webhook_verified' && payment === 'PAID') return { type: 'success', title: 'Pagamento confirmado', message: `Uma venda foi confirmada via ${provider}.`, destination: 'Pedidos' };
  if (action === 'payment.webhook_verified' && payment === 'REFUNDED') return { type: 'warning', title: 'Pagamento reembolsado', message: `Um pagamento via ${provider} foi reembolsado.`, destination: 'Pedidos' };
  if (action === 'payment.webhook_verified') return { type: 'info', title: 'Pagamento atualizado', message: `O gateway ${provider} atualizou um pagamento para ${payment || 'novo status'}.`, destination: 'Pedidos' };
  if (action === 'integration.event_failed') return { type: 'error', title: `Falha na ${provider}`, message: 'Um evento não foi entregue. Abra as integrações para revisar.', destination: 'Integrações' };
  if (action === 'integration.shopify_reconnect_required') return { type: 'warning', title: 'Reconecte a Shopify', message: 'A autorização da loja expirou ou foi revogada.', destination: 'Integrações' };
  if (action === 'store_domain.not_verified') return { type: 'warning', title: 'DNS ainda não validado', message: 'O domínio personalizado ainda não está apontando corretamente.', destination: 'Domínios' };
  if (action === 'store_domain.activated') return { type: 'success', title: 'Domínio ativado', message: 'O domínio personalizado está ativo e protegido.', destination: 'Domínios' };
  return { type: 'success', title: 'Shopify conectada', message: 'A integração com a Shopify foi conectada com sucesso.', destination: 'Integrações' };
}

export function registerNotificationRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  const sessionCookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = environment.NODE_ENV === 'production' ? '__Host-solid_csrf' : 'solid_csrf';
  const context = async (request: FastifyRequest) => {
    const raw = request.cookies[sessionCookie]; const session = raw ? await auth.findActiveSession(sha256(raw), new Date()) : null;
    if (!session) return null;
    const selected = await db.session.findUnique({ where: { id: session.sessionId }, select: { activeStoreId: true } });
    if (!selected?.activeStoreId) return null;
    const member = await db.storeMember.findUnique({ where: { storeId_userId: { storeId: selected.activeStoreId, userId: session.userId } }, select: { id: true } });
    return member ? { session, storeId: selected.activeStoreId } : null;
  };
  const csrfValid = (request: FastifyRequest, csrfHash: string) => { const origin = request.headers.origin; const cookie = request.cookies[csrfCookie]; const header = request.headers['x-csrf-token']; return typeof origin === 'string' && environment.CORS_ORIGINS.includes(origin) && Boolean(cookie) && typeof header === 'string' && same(sha256(cookie!), sha256(header)) && same(sha256(header), csrfHash); };

  app.get('/notifications', async (request, reply) => {
    const current = await context(request); if (!current) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const state = await db.notificationState.findUnique({ where: { userId_storeId: { userId: current.session.userId, storeId: current.storeId } }, select: { lastReadAt: true } });
    const lastReadAt = state?.lastReadAt ?? new Date(0);
    const [events, unread] = await Promise.all([
      db.auditLog.findMany({ where: { storeId: current.storeId, action: { in: [...actions] } }, orderBy: { createdAt: 'desc' }, take: 25, select: { id: true, action: true, targetId: true, metadata: true, createdAt: true } }),
      db.auditLog.count({ where: { storeId: current.storeId, action: { in: [...actions] }, createdAt: { gt: lastReadAt } } }),
    ]);
    return reply.header('cache-control', 'private, no-store').send({ unread, items: events.map(event => ({ id: event.id.toString(), ...content(event.action, event.metadata), createdAt: event.createdAt, read: event.createdAt <= lastReadAt, targetId: event.targetId })) });
  });

  app.post('/notifications/read', async (request, reply) => {
    const current = await context(request); if (!current) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    if (!csrfValid(request, current.session.csrfTokenHash)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));
    const lastReadAt = new Date();
    await db.notificationState.upsert({ where: { userId_storeId: { userId: current.session.userId, storeId: current.storeId } }, create: { userId: current.session.userId, storeId: current.storeId, lastReadAt }, update: { lastReadAt } });
    return reply.send({ unread: 0, lastReadAt });
  });
}
