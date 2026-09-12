import { randomBytes } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository } from './auth-repository.js';
import { hashToken, requirePlatformSession, validAdminMutation } from './admin-access.js';
import { hasPlatformPermission, platformStaff } from './platform-permissions.js';
import { verifyPassword } from './password.js';
import { decryptSecret } from './shopify-crypto.js';
import { verifyTotp } from './totp.js';

const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

export function registerAdminSupportRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  app.post<{ Params: { publicId: string }; Body: { reason?: unknown; mode?: unknown; currentPassword?: unknown; code?: unknown } }>('/admin/users/:publicId/support', { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const session = await requirePlatformSession(request, environment, auth, 'support.read');
    if (!session) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Sem permissão para acessar contas em suporte.'));
    if (!validAdminMutation(request, session, environment)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim().replace(/\s+/g, ' ') : '';
    const mode = request.body?.mode ?? 'READ_ONLY';
    if (reason.length < 10 || reason.length > 240 || (mode !== 'READ_ONLY' && mode !== 'MAINTENANCE')) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Informe um motivo de 10 a 240 caracteres e um modo válido.'));
    if (mode === 'MAINTENANCE' && !hasPlatformPermission(session.user, 'support.write')) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Seu perfil permite apenas consulta.'));
    const operator = await auth.findUserByEmail(session.user.email);
    const password = typeof request.body?.currentPassword === 'string' ? request.body.currentPassword : '';
    if (!operator?.passwordHash || password.length > 128 || !await verifyPassword(password, operator.passwordHash)) return reply.code(401).send(failure(request, 'REAUTH_REQUIRED', 'Confirme sua senha de administrador para continuar.'));
    if (operator.mfaEnabledAt) {
      const code = typeof request.body?.code === 'string' ? request.body.code : '';
      if (!environment.APP_ENCRYPTION_KEY || !operator.mfaSecretEncrypted || !verifyTotp(code, decryptSecret(operator.mfaSecretEncrypted, environment.APP_ENCRYPTION_KEY))) return reply.code(401).send(failure(request, 'MFA_CODE_INVALID', 'Confirme o código atual do seu autenticador.'));
    }
    const target = await db.user.findUnique({ where: { publicId: request.params.publicId }, select: { id: true, publicId: true, name: true, email: true, disabledAt: true, accountStatus: true, platformAdmin: true, platformRole: { select: { publicId: true, name: true, permissions: true } } } });
    if (!target || target.id === session.userId || target.disabledAt || target.accountStatus !== 'APPROVED' || platformStaff(target)) return reply.code(409).send(failure(request, 'SUPPORT_TARGET_INVALID', 'Escolha uma conta ativa de cliente, sem acesso à administração.'));
    const now = new Date();
    const expiresAt = new Date(Math.min(now.getTime() + 30 * 60_000, session.expiresAt.getTime(), session.absoluteExpiresAt.getTime()));
    const supportToken = randomBytes(32).toString('base64url');
    const created = await db.$transaction(async transaction => {
      if (await transaction.session.count({ where: { supportParentId: session.sessionId, revokedAt: null, expiresAt: { gt: now } } }) >= 3) return false;
      const child = await transaction.session.create({ data: { userId: target.id, tokenHash: hashToken(supportToken), csrfTokenHash: session.csrfTokenHash, supportParentId: session.sessionId, supportMode: mode, supportReason: reason, expiresAt, absoluteExpiresAt: expiresAt,
        ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'].slice(0, 512) } : {}) }, select: { id: true } });
      await transaction.auditLog.create({ data: { actorType: 'USER', actorUserId: session.userId, action: 'admin.support.started', targetType: 'user', targetId: target.publicId, requestId: request.id, metadata: { supportSessionId: child.id, targetName: target.name, mode: mode, reason, expiresAt: expiresAt.toISOString() } } });
      return true;
    }, { isolationLevel: 'Serializable' });
    if (!created) return reply.code(409).send(failure(request, 'SUPPORT_LIMIT', 'Encerre um dos três acessos de suporte ativos antes de abrir outro.'));
    return reply.header('cache-control', 'private, no-store').code(201).send({ supportToken, targetUserId: target.publicId, expiresAt });
  });

  app.post('/admin/support/end', async (request, reply) => {
    // Revocation remains available even if the operator's support permission was removed.
    const raw = request.cookies[environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session'];
    const parent = raw ? await auth.findActiveSession(hashToken(raw), new Date()) : null;
    if (!parent || parent.support || !validAdminMutation(request, parent, environment)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const token = request.headers['x-solid-support-session'];
    if (typeof token !== 'string') return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Acesso de suporte não informado.'));
    await db.$transaction(async transaction => {
      const child = await transaction.session.findFirst({ where: { tokenHash: hashToken(token), supportParentId: parent.sessionId }, select: { id: true, user: { select: { publicId: true } } } });
      if (!child) return;
      const result = await transaction.session.updateMany({ where: { id: child.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (result.count) await transaction.auditLog.create({ data: { actorType: 'USER', actorUserId: parent.userId, action: 'admin.support.ended', targetType: 'user', targetId: child.user.publicId, requestId: request.id, metadata: { supportSessionId: child.id } } });
    });
    return reply.code(204).send();
  });
}
