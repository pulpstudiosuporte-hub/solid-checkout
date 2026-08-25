import cookie from '@fastify/cookie';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository } from './auth-repository.js';
import { hashPassword, verifyPassword } from './password.js';

const SESSION_SECONDS = 8 * 60 * 60;
const ABSOLUTE_SESSION_SECONDS = 7 * 24 * 60 * 60;
const DUMMY_PASSWORD_HASH = 'scrypt$32768$8$1$BwcHBwcHBwcHBwcHBwcHBw$hI1JePoeuiF14b9C8gNN2H4u4xrGH1_vkxnpNZ9j6TPFvJtJIvSedpkmL3vol6s3vg-C2kviQ8tDfYv21tRWeA';
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const randomToken = (): string => randomBytes(32).toString('base64url');
const safeEqual = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

export function registerAuthRoutes(app: FastifyInstance, environment: AppEnvironment, repository: AuthRepository): void {
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

  app.get('/auth/csrf', async (_request, reply) => {
    const csrfToken = randomToken();
    return reply.setCookie(authCsrfCookie, csrfToken, { ...cookieBase, httpOnly: true, maxAge: 600 }).send({ csrfToken });
  });

  app.post<{ Body: { email?: unknown; password?: unknown } }>('/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const authCookieToken = request.cookies[authCsrfCookie]; const authHeaderToken = request.headers['x-csrf-token'];
    if (!allowedOrigin(request) || !authCookieToken || typeof authHeaderToken !== 'string' || !safeEqual(authCookieToken, authHeaderToken)) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (email.length > 320 || password.length > 128 || !/^\S+@\S+\.\S+$/.test(email)) return reply.code(401).send(errorBody(request, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.'));
    const user = await repository.findUserByEmail(email);
    const passwordValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordValid || user.disabledAt || user.accountStatus === 'REJECTED') return reply.code(401).send(errorBody(request, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.'));
    if (user.accountStatus === 'PENDING') return reply.code(403).send(errorBody(request, 'ACCOUNT_PENDING', 'Sua conta está aguardando aprovação.'));
    const activeToken = request.cookies[sessionCookie];
    const activeSession = activeToken ? await repository.findActiveSession(sha256(activeToken), new Date()) : null;
    if (activeSession && activeSession.user.publicId !== user.publicId) return reply.code(409).send(errorBody(request, 'ACCOUNT_SWITCH_REQUIRES_LOGOUT', 'Já existe outra conta conectada neste navegador. Saia dela ou use uma janela anônima.'));
    const now = new Date(); const token = randomToken(); const csrfToken = randomToken();
    await repository.createSession({ tokenHash: sha256(token), csrfTokenHash: sha256(csrfToken), userId: user.id,
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'].slice(0, 512) } : {}),
      expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000), absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_SESSION_SECONDS * 1000) });
    return reply.clearCookie(authCsrfCookie, cookieBase).setCookie(sessionCookie, token, { ...cookieBase, httpOnly: true, maxAge: ABSOLUTE_SESSION_SECONDS })
      .setCookie(csrfCookie, csrfToken, { ...cookieBase, httpOnly: true, maxAge: SESSION_SECONDS })
      .send({ user: { id: user.publicId, publicId: user.publicId, name: user.name, email: user.email, accountStatus: user.accountStatus ?? 'APPROVED', platformAdmin: user.platformAdmin ?? false }, csrfToken });
  });

  app.get('/auth/session', async (request, reply) => {
    const token = request.cookies[sessionCookie];
    if (!token) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const now = new Date(); const session = await repository.findActiveSession(sha256(token), now);
    if (!session) return reply.clearCookie(sessionCookie, cookieBase).code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const csrfToken = request.cookies[csrfCookie];
    if (!csrfToken || !safeEqual(sha256(csrfToken), session.csrfTokenHash)) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    await repository.touchSession(session.sessionId, new Date(Math.min(now.getTime() + SESSION_SECONDS * 1000, session.absoluteExpiresAt.getTime())), now);
    return reply.send({ user: session.user, csrfToken });
  });

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[sessionCookie];
    if (!token || !allowedOrigin(request)) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const session = await repository.findActiveSession(sha256(token), new Date());
    if (!session || !validCsrf(request, session.csrfTokenHash)) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    await repository.revokeSession(sha256(token), new Date());
    return reply.clearCookie(sessionCookie, cookieBase).clearCookie(csrfCookie, cookieBase).code(204).send();
  });

  app.post<{ Body: { currentPassword?: unknown; newPassword?: unknown } }>('/auth/change-password', { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const token = request.cookies[sessionCookie];
    if (!token || !allowedOrigin(request)) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const session = await repository.findActiveSession(sha256(token), new Date());
    if (!session || !validCsrf(request, session.csrfTokenHash)) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const currentPassword = typeof request.body?.currentPassword === 'string' ? request.body.currentPassword : '';
    const newPassword = typeof request.body?.newPassword === 'string' ? request.body.newPassword : '';
    if (newPassword.length < 14 || newPassword.length > 128) return reply.code(400).send(errorBody(request, 'PASSWORD_INVALID', 'A nova senha deve ter entre 14 e 128 caracteres.'));
    const user = await repository.findUserByEmail(session.user.email);
    const currentValid = user?.passwordHash ? await verifyPassword(currentPassword, user.passwordHash) : false;
    if (!user || !currentValid) return reply.code(401).send(errorBody(request, 'CURRENT_PASSWORD_INVALID', 'A senha atual está incorreta.'));
    if (await verifyPassword(newPassword, user.passwordHash!)) return reply.code(400).send(errorBody(request, 'PASSWORD_UNCHANGED', 'A nova senha deve ser diferente da senha atual.'));
    const passwordHash = await hashPassword(newPassword);
    await repository.updatePasswordAndRevokeOtherSessions(user.id, passwordHash, session.sessionId, new Date());
    return reply.code(204).send();
  });
}
