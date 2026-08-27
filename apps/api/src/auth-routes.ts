import cookie from '@fastify/cookie';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { AuthRepository, LoginUser } from './auth-repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { decryptSecret, encryptSecret } from './shopify-crypto.js';
import { generateRecoveryCodes, generateTotpSecret, recoveryCodeHash, totpUri, verifyTotp } from './totp.js';

const SESSION_SECONDS = 8 * 60 * 60;
const ABSOLUTE_SESSION_SECONDS = 7 * 24 * 60 * 60;
const DUMMY_PASSWORD_HASH = 'scrypt$32768$8$1$BwcHBwcHBwcHBwcHBwcHBw$hI1JePoeuiF14b9C8gNN2H4u4xrGH1_vkxnpNZ9j6TPFvJtJIvSedpkmL3vol6s3vg-C2kviQ8tDfYv21tRWeA';
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const randomToken = (): string => randomBytes(32).toString('base64url');
const safeEqual = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

export function registerAuthRoutes(app: FastifyInstance, environment: AppEnvironment, repository: AuthRepository, database?: PrismaClient): void {
  const secure = environment.NODE_ENV === 'production';
  const sessionCookie = secure ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = secure ? '__Host-solid_csrf' : 'solid_csrf';
  const authCsrfCookie = secure ? '__Host-solid_auth_csrf' : 'solid_auth_csrf';
  const cookieBase = { path: '/', secure, sameSite: 'strict' as const };
  void app.register(cookie);
  const allowedOrigin = (request: FastifyRequest): boolean => typeof request.headers.origin === 'string' && environment.CORS_ORIGINS.includes(request.headers.origin);
  const validCsrf = (request: FastifyRequest, expectedHash?: string): boolean => {
    const cookieToken = request.cookies[csrfCookie]; const headerToken = request.headers['x-csrf-token'];
    if (!cookieToken || typeof headerToken !== 'string' || !safeEqual(cookieToken, headerToken)) return false;
    return expectedHash ? safeEqual(sha256(headerToken), expectedHash) : true;
  };
  const validAuthCsrf = (request: FastifyRequest): boolean => {
    const cookieToken = request.cookies[authCsrfCookie]; const headerToken = request.headers['x-csrf-token'];
    return allowedOrigin(request) && Boolean(cookieToken) && typeof headerToken === 'string' && safeEqual(cookieToken!, headerToken);
  };
  const authenticated = async (request: FastifyRequest) => {
    const token = request.cookies[sessionCookie]; if (!token || !allowedOrigin(request)) return null;
    const session = await repository.findActiveSession(sha256(token), new Date());
    return session && validCsrf(request, session.csrfTokenHash) ? session : null;
  };
  const issueSession = async (request: FastifyRequest, reply: FastifyReply, user: LoginUser, mfaVerifiedAt?: Date) => {
    const now = new Date(); const token = randomToken(); const csrfToken = randomToken();
    await repository.createSession({ tokenHash: sha256(token), csrfTokenHash: sha256(csrfToken), userId: user.id,
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'].slice(0, 512) } : {}),
      expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000), absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_SESSION_SECONDS * 1000), ...(mfaVerifiedAt ? { mfaVerifiedAt } : {}) });
    return reply.clearCookie(authCsrfCookie, cookieBase).setCookie(sessionCookie, token, { ...cookieBase, httpOnly: true, maxAge: ABSOLUTE_SESSION_SECONDS })
      .setCookie(csrfCookie, csrfToken, { ...cookieBase, httpOnly: true, maxAge: SESSION_SECONDS })
      .send({ user: { id: user.publicId, publicId: user.publicId, name: user.name, email: user.email, accountStatus: user.accountStatus ?? 'APPROVED', platformAdmin: user.platformAdmin ?? false, mfaEnabled: Boolean(user.mfaEnabledAt) }, csrfToken });
  };

  app.get('/auth/csrf', async (_request, reply) => {
    const csrfToken = randomToken();
    return reply.setCookie(authCsrfCookie, csrfToken, { ...cookieBase, httpOnly: true, maxAge: 600 }).send({ csrfToken });
  });

  app.post<{ Body: { email?: unknown; password?: unknown } }>('/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!validAuthCsrf(request)) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (email.length > 320 || password.length > 128 || !/^\S+@\S+\.\S+$/.test(email)) return reply.code(401).send(errorBody(request, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.'));
    const user = await repository.findUserByEmail(email);
    const passwordValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordValid || user.disabledAt || user.accountStatus === 'REJECTED') return reply.code(401).send(errorBody(request, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.'));
    if (user.accountStatus === 'PENDING') return reply.code(403).send(errorBody(request, 'ACCOUNT_PENDING', 'Sua conta está aguardando aprovação.'));
    const activeToken = request.cookies[sessionCookie]; const activeSession = activeToken ? await repository.findActiveSession(sha256(activeToken), new Date()) : null;
    if (activeSession && activeSession.user.publicId !== user.publicId) return reply.code(409).send(errorBody(request, 'ACCOUNT_SWITCH_REQUIRES_LOGOUT', 'Já existe outra conta conectada neste navegador. Saia dela ou use uma janela anônima.'));
    if (user.mfaEnabledAt && user.mfaSecretEncrypted) {
      if (!database || !environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'MFA_UNAVAILABLE', 'O segundo fator está temporariamente indisponível.'));
      const challengeToken = randomToken(); const now = new Date();
      await database.mfaChallenge.deleteMany({ where: { userId: user.id, OR: [{ expiresAt: { lte: now } }, { consumedAt: { not: null } }] } });
      await database.mfaChallenge.create({ data: { userId: user.id, tokenHash: sha256(challengeToken), expiresAt: new Date(now.getTime() + 5 * 60_000) } });
      return reply.code(202).send({ mfaRequired: true, challengeToken, expiresIn: 300 });
    }
    return issueSession(request, reply, user);
  });

  app.post<{ Body: { challengeToken?: unknown; code?: unknown } }>('/auth/login/mfa', { config: { rateLimit: { max: 8, timeWindow: '5 minutes' } } }, async (request, reply) => {
    if (!validAuthCsrf(request)) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    if (!database || !environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'MFA_UNAVAILABLE', 'O segundo fator está temporariamente indisponível.'));
    const challengeToken = typeof request.body?.challengeToken === 'string' ? request.body.challengeToken : '';
    const code = typeof request.body?.code === 'string' ? request.body.code.trim() : ''; const now = new Date();
    if (challengeToken.length < 32 || challengeToken.length > 128 || code.length < 6 || code.length > 32) return reply.code(401).send(errorBody(request, 'MFA_CODE_INVALID', 'Código inválido.'));
    const challenge = await database.mfaChallenge.findFirst({ where: { tokenHash: sha256(challengeToken), consumedAt: null, expiresAt: { gt: now }, attempts: { lt: 5 } }, include: { user: true } });
    if (!challenge || challenge.user.disabledAt || challenge.user.accountStatus !== 'APPROVED' || !challenge.user.mfaSecretEncrypted || !challenge.user.mfaEnabledAt) return reply.code(401).send(errorBody(request, 'MFA_CHALLENGE_INVALID', 'O desafio expirou. Entre novamente.'));
    const secret = decryptSecret(challenge.user.mfaSecretEncrypted, environment.APP_ENCRYPTION_KEY);
    const totpValid = verifyTotp(code, secret); const recovery = totpValid ? null : await database.mfaRecoveryCode.findFirst({ where: { userId: challenge.userId, codeHash: recoveryCodeHash(code), usedAt: null } });
    if (!totpValid && !recovery) { await database.mfaChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } }); return reply.code(401).send(errorBody(request, 'MFA_CODE_INVALID', 'Código inválido.')); }
    await database.$transaction(async transaction => {
      const consumed = await transaction.mfaChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: now } });
      if (consumed.count !== 1) throw new Error('MFA challenge already consumed');
      if (recovery) await transaction.mfaRecoveryCode.update({ where: { id: recovery.id }, data: { usedAt: now } });
      await transaction.auditLog.create({ data: { actorType: 'USER', actorUserId: challenge.userId, action: recovery ? 'auth.mfa_recovery_used' : 'auth.mfa_verified', targetType: 'user', targetId: challenge.userId } });
    });
    return issueSession(request, reply, challenge.user, now);
  });

  app.get('/auth/session', async (request, reply) => {
    const token = request.cookies[sessionCookie]; if (!token) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const now = new Date(); const session = await repository.findActiveSession(sha256(token), now);
    if (!session) return reply.clearCookie(sessionCookie, cookieBase).code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const csrfToken = request.cookies[csrfCookie]; if (!csrfToken || !safeEqual(sha256(csrfToken), session.csrfTokenHash)) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    await repository.touchSession(session.sessionId, new Date(Math.min(now.getTime() + SESSION_SECONDS * 1000, session.absoluteExpiresAt.getTime())), now);
    return reply.send({ user: session.user, csrfToken });
  });

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[sessionCookie]; if (!token || !allowedOrigin(request)) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const session = await repository.findActiveSession(sha256(token), new Date()); if (!session || !validCsrf(request, session.csrfTokenHash)) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    await repository.revokeSession(sha256(token), new Date()); return reply.clearCookie(sessionCookie, cookieBase).clearCookie(csrfCookie, cookieBase).code(204).send();
  });

  app.post<{ Body: { currentPassword?: unknown; newPassword?: unknown } }>('/auth/change-password', { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const session = await authenticated(request); if (!session) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const currentPassword = typeof request.body?.currentPassword === 'string' ? request.body.currentPassword : ''; const newPassword = typeof request.body?.newPassword === 'string' ? request.body.newPassword : '';
    if (newPassword.length < 14 || newPassword.length > 128) return reply.code(400).send(errorBody(request, 'PASSWORD_INVALID', 'A nova senha deve ter entre 14 e 128 caracteres.'));
    const user = await repository.findUserByEmail(session.user.email); const currentValid = user?.passwordHash ? await verifyPassword(currentPassword, user.passwordHash) : false;
    if (!user || !currentValid) return reply.code(401).send(errorBody(request, 'CURRENT_PASSWORD_INVALID', 'A senha atual está incorreta.'));
    if (await verifyPassword(newPassword, user.passwordHash!)) return reply.code(400).send(errorBody(request, 'PASSWORD_UNCHANGED', 'A nova senha deve ser diferente da senha atual.'));
    await repository.updatePasswordAndRevokeOtherSessions(user.id, await hashPassword(newPassword), session.sessionId, new Date()); return reply.code(204).send();
  });

  app.get('/auth/mfa/status', async (request, reply) => {
    const session = await authenticated(request); if (!session) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    if (!database) return reply.code(503).send(errorBody(request, 'MFA_UNAVAILABLE', 'MFA indisponível.'));
    const user = await database.user.findUnique({ where: { id: session.userId }, select: { mfaEnabledAt: true, _count: { select: { mfaRecoveryCodes: { where: { usedAt: null } } } } } });
    return reply.send({ enabled: Boolean(user?.mfaEnabledAt), enabledAt: user?.mfaEnabledAt ?? null, recoveryCodesRemaining: user?._count.mfaRecoveryCodes ?? 0 });
  });

  app.post<{ Body: { currentPassword?: unknown } }>('/auth/mfa/setup', { config: { rateLimit: { max: 3, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const session = await authenticated(request); if (!session) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    if (!database || !environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'MFA_UNAVAILABLE', 'MFA indisponível.'));
    const user = await repository.findUserByEmail(session.user.email); const password = typeof request.body?.currentPassword === 'string' ? request.body.currentPassword : '';
    if (!user?.passwordHash || !await verifyPassword(password, user.passwordHash)) return reply.code(401).send(errorBody(request, 'CURRENT_PASSWORD_INVALID', 'A senha atual está incorreta.'));
    const secret = generateTotpSecret(); await database.user.update({ where: { id: session.userId }, data: { mfaPendingSecretEncrypted: encryptSecret(secret, environment.APP_ENCRYPTION_KEY) } });
    return reply.send({ secret, otpauthUri: totpUri(secret, user.email), issuer: 'SOLID Checkout', account: user.email });
  });

  app.post<{ Body: { code?: unknown } }>('/auth/mfa/enable', { config: { rateLimit: { max: 6, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const session = await authenticated(request); if (!session) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    if (!database || !environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'MFA_UNAVAILABLE', 'MFA indisponível.'));
    const user = await database.user.findUnique({ where: { id: session.userId }, select: { mfaPendingSecretEncrypted: true } }); const code = typeof request.body?.code === 'string' ? request.body.code : '';
    if (!user?.mfaPendingSecretEncrypted) return reply.code(409).send(errorBody(request, 'MFA_SETUP_REQUIRED', 'Inicie a configuração novamente.'));
    const secret = decryptSecret(user.mfaPendingSecretEncrypted, environment.APP_ENCRYPTION_KEY); if (!verifyTotp(code, secret)) return reply.code(400).send(errorBody(request, 'MFA_CODE_INVALID', 'Código inválido.'));
    const now = new Date(); const recoveryCodes = generateRecoveryCodes(); await database.$transaction([
      database.user.update({ where: { id: session.userId }, data: { mfaSecretEncrypted: user.mfaPendingSecretEncrypted, mfaPendingSecretEncrypted: null, mfaEnabledAt: now } }),
      database.mfaRecoveryCode.deleteMany({ where: { userId: session.userId } }),
      database.mfaRecoveryCode.createMany({ data: recoveryCodes.map(item => ({ userId: session.userId, codeHash: recoveryCodeHash(item) })) }),
      database.session.update({ where: { id: session.sessionId }, data: { mfaVerifiedAt: now } }),
      database.auditLog.create({ data: { actorType: 'USER', actorUserId: session.userId, action: 'auth.mfa_enabled', targetType: 'user', targetId: session.userId } }),
    ]);
    return reply.send({ recoveryCodes });
  });

  app.post<{ Body: { currentPassword?: unknown; code?: unknown } }>('/auth/mfa/disable', { config: { rateLimit: { max: 3, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const session = await authenticated(request); if (!session) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    if (!database || !environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'MFA_UNAVAILABLE', 'MFA indisponível.'));
    const user = await repository.findUserByEmail(session.user.email); const password = typeof request.body?.currentPassword === 'string' ? request.body.currentPassword : ''; const code = typeof request.body?.code === 'string' ? request.body.code : '';
    if (!user?.passwordHash || !await verifyPassword(password, user.passwordHash)) return reply.code(401).send(errorBody(request, 'CURRENT_PASSWORD_INVALID', 'A senha atual está incorreta.'));
    if (!user.mfaSecretEncrypted || !verifyTotp(code, decryptSecret(user.mfaSecretEncrypted, environment.APP_ENCRYPTION_KEY))) return reply.code(400).send(errorBody(request, 'MFA_CODE_INVALID', 'Código inválido.'));
    const now = new Date(); await database.$transaction([
      database.user.update({ where: { id: session.userId }, data: { mfaSecretEncrypted: null, mfaPendingSecretEncrypted: null, mfaEnabledAt: null } }),
      database.mfaRecoveryCode.deleteMany({ where: { userId: session.userId } }),
      database.session.updateMany({ where: { userId: session.userId, id: { not: session.sessionId }, revokedAt: null }, data: { revokedAt: now } }),
      database.session.update({ where: { id: session.sessionId }, data: { mfaVerifiedAt: null } }),
      database.auditLog.create({ data: { actorType: 'USER', actorUserId: session.userId, action: 'auth.mfa_disabled', targetType: 'user', targetId: session.userId } }),
    ]); return reply.code(204).send();
  });
}
