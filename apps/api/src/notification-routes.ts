import { createHash, timingSafeEqual } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository } from './auth-repository.js';
import { notificationContent } from './notification-content.js';
import { encryptSecret } from './shopify-crypto.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const same = (left: string, right: string) => { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); };
const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const actions = ['payment.pix_created', 'payment.webhook_verified', 'integration.event_failed', 'integration.shopify_reconnect_required', 'store_domain.not_verified', 'store_domain.activated', 'integration.shopify_connected'] as const;

type PushBody = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
const validPushBody = (body: PushBody): body is { endpoint: string; keys: { p256dh: string; auth: string } } => {
  if (typeof body.endpoint !== 'string' || body.endpoint.length > 2048 || typeof body.keys?.p256dh !== 'string' || typeof body.keys.auth !== 'string') return false;
  if (body.keys.p256dh.length < 40 || body.keys.p256dh.length > 256 || body.keys.auth.length < 10 || body.keys.auth.length > 128) return false;
  try { return new URL(body.endpoint).protocol === 'https:'; } catch { return false; }
};

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
    const current = await context(request); if (!current) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autentica\u00e7\u00e3o necess\u00e1ria.'));
    const state = await db.notificationState.findUnique({ where: { userId_storeId: { userId: current.session.userId, storeId: current.storeId } }, select: { lastReadAt: true } });
    const lastReadAt = state?.lastReadAt ?? new Date(0);
    const [events, unread] = await Promise.all([
      db.auditLog.findMany({ where: { storeId: current.storeId, action: { in: [...actions] } }, orderBy: { createdAt: 'desc' }, take: 25, select: { id: true, action: true, targetId: true, metadata: true, createdAt: true } }),
      db.auditLog.count({ where: { storeId: current.storeId, action: { in: [...actions] }, createdAt: { gt: lastReadAt } } }),
    ]);
    return reply.header('cache-control', 'private, no-store').send({ unread, items: events.map(event => ({ id: event.id.toString(), ...notificationContent(event.action, event.metadata), createdAt: event.createdAt, read: event.createdAt <= lastReadAt, targetId: event.targetId })) });
  });

  app.post('/notifications/read', async (request, reply) => {
    const current = await context(request); if (!current) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autentica\u00e7\u00e3o necess\u00e1ria.'));
    if (!csrfValid(request, current.session.csrfTokenHash)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));
    const lastReadAt = new Date();
    await db.notificationState.upsert({ where: { userId_storeId: { userId: current.session.userId, storeId: current.storeId } }, create: { userId: current.session.userId, storeId: current.storeId, lastReadAt }, update: { lastReadAt } });
    return reply.send({ unread: 0, lastReadAt });
  });

  app.get('/notifications/push/config', async (request, reply) => {
    const current = await context(request); if (!current) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autentica\u00e7\u00e3o necess\u00e1ria.'));
    return reply.header('cache-control', 'private, no-store').send({ enabled: Boolean(environment.VAPID_PUBLIC_KEY), publicKey: environment.VAPID_PUBLIC_KEY ?? null });
  });

  app.post<{ Body: PushBody }>('/notifications/push/subscriptions', async (request, reply) => {
    const current = await context(request); if (!current) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autentica\u00e7\u00e3o necess\u00e1ria.'));
    if (!csrfValid(request, current.session.csrfTokenHash)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));
    if (!environment.VAPID_PUBLIC_KEY || !environment.APP_ENCRYPTION_KEY) return reply.code(503).send(failure(request, 'PUSH_UNAVAILABLE', 'Notifica\u00e7\u00f5es em segundo plano ainda n\u00e3o foram configuradas.'));
    if (!validPushBody(request.body)) return reply.code(400).send(failure(request, 'INVALID_PUSH_SUBSCRIPTION', 'Inscri\u00e7\u00e3o de notifica\u00e7\u00e3o inv\u00e1lida.'));
    const body = request.body;
    const endpointHash = sha256(body.endpoint);
    await db.$transaction(async transaction => {
      await transaction.pushSubscription.upsert({
        where: { endpointHash },
        create: { userId: current.session.userId, sessionId: current.session.sessionId, endpointHash, endpointEncrypted: encryptSecret(body.endpoint, environment.APP_ENCRYPTION_KEY!), p256dhEncrypted: encryptSecret(body.keys.p256dh, environment.APP_ENCRYPTION_KEY!), authEncrypted: encryptSecret(body.keys.auth, environment.APP_ENCRYPTION_KEY!), userAgent: request.headers['user-agent']?.slice(0, 500) ?? null },
        update: { userId: current.session.userId, sessionId: current.session.sessionId, endpointEncrypted: encryptSecret(body.endpoint, environment.APP_ENCRYPTION_KEY!), p256dhEncrypted: encryptSecret(body.keys.p256dh, environment.APP_ENCRYPTION_KEY!), authEncrypted: encryptSecret(body.keys.auth, environment.APP_ENCRYPTION_KEY!), userAgent: request.headers['user-agent']?.slice(0, 500) ?? null, lastUsedAt: new Date() },
      });
      const excess = await transaction.pushSubscription.findMany({ where: { userId: current.session.userId }, orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }], skip: 10, select: { id: true } });
      if (excess.length) await transaction.pushSubscription.deleteMany({ where: { id: { in: excess.map(item => item.id) } } });
    });
    return reply.code(201).send({ active: true });
  });

  app.delete<{ Body: { endpoint?: unknown } }>('/notifications/push/subscriptions', async (request, reply) => {
    const current = await context(request); if (!current) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autentica\u00e7\u00e3o necess\u00e1ria.'));
    if (!csrfValid(request, current.session.csrfTokenHash)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));
    if (typeof request.body.endpoint !== 'string') return reply.code(400).send(failure(request, 'INVALID_PUSH_SUBSCRIPTION', 'Endpoint inv\u00e1lido.'));
    await db.pushSubscription.deleteMany({ where: { endpointHash: sha256(request.body.endpoint), userId: current.session.userId } });
    return reply.code(204).send();
  });
}
