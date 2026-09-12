import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance } from 'fastify';
import type { AuthRepository, SessionUser } from './auth-repository.js';
import { hashToken, sessionCookieName, validAdminMutation } from './admin-access.js';
import { supportRequestAllowed } from './support-policy.js';

declare module 'fastify' {
  interface FastifyRequest { supportSession: SessionUser | null }
}

export function registerSupportSessionHook(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db?: PrismaClient): void {
  app.decorateRequest('supportSession', null);
  app.addHook('preValidation', async (request, reply) => {
    const header = request.headers['x-solid-support-session'];
    const expected = request.headers['x-solid-user-context'];
    const cookieName = sessionCookieName(environment);
    const raw = request.cookies[cookieName];
    if (!raw && header === undefined && expected === undefined) return;
    const session = raw ? await auth.findActiveSession(hashToken(raw), new Date()) : null;
    const error = (code: string, message: string, status = 403) => reply.code(status).send({ error: { code, message, requestId: request.id } });
    // A support token is unusable as a normal login cookie, even with its CSRF token.
    if (session?.support) return error('SUPPORT_CONTEXT_REQUIRED', 'Use o acesso de suporte vinculado à sua sessão administrativa.');
    let effective = session;
    if (header !== undefined) {
      if (!db || typeof header !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(header) || !session) return error('SUPPORT_SESSION_EXPIRED', 'O acesso de suporte foi encerrado. Volte à administração.', 409);
      if (!['GET', 'HEAD'].includes(request.method) && !validAdminMutation(request, session, environment)) return error('CSRF_INVALID', 'Requisição não autorizada.');
      // Termination also works after the child expires; the route checks its parent.
      if (request.routeOptions.url === '/admin/support/end') return;
      effective = await auth.findActiveSession(hashToken(header), new Date());
      if (!effective?.support || effective.support.parentSessionId !== session.sessionId) return error('SUPPORT_SESSION_EXPIRED', 'O acesso de suporte foi encerrado. Volte à administração.', 409);
      if (typeof expected !== 'string' || expected !== effective.user.publicId) return error('SESSION_CONTEXT_CHANGED', 'A conta desta aba foi alterada.', 409);
      if (!supportRequestAllowed(request.method, request.routeOptions.url ?? '', effective.support.mode)) return error('SUPPORT_ACTION_FORBIDDEN', 'Esta ação não está disponível no acesso de suporte.');
      reply.header('cache-control', 'private, no-store');
      request.supportSession = effective;
      request.cookies[cookieName] = header;
      const params = Object.fromEntries(Object.entries(request.params as Record<string, unknown> ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(entry[1])));
      // Record the responsible operator before exposing data or executing a mutation.
      await db.auditLog.create({ data: { actorType: 'USER', actorUserId: effective.support.actorUserId, action: 'admin.support.request', targetType: 'user', targetId: effective.user.publicId, requestId: request.id,
        metadata: { supportSessionId: effective.sessionId, mode: effective.support.mode, method: request.method, route: request.routeOptions.url ?? '', params } } });
    }
    if (typeof expected === 'string' && (!effective || effective.user.publicId !== expected)) return error('SESSION_CONTEXT_CHANGED', 'A conta desta aba foi alterada em outra aba.', 409);
  });
  app.addHook('onResponse', async (request, reply) => {
    const session = request.supportSession;
    if (!db || !session?.support) return;
    try {
      await db.auditLog.create({ data: { actorType: 'USER', actorUserId: session.support.actorUserId, action: 'admin.support.result', targetType: 'user', targetId: session.user.publicId, requestId: request.id,
        metadata: { supportSessionId: session.sessionId, method: request.method, route: request.routeOptions.url ?? '', statusCode: reply.statusCode } } });
    } catch (error) { request.log.error({ err: error, requestId: request.id }, 'support_audit_result_failed'); }
  });
}
