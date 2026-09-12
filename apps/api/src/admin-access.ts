import { createHash, timingSafeEqual } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { FastifyRequest } from 'fastify';
import type { AuthRepository, SessionUser } from './auth-repository.js';
import { hasPlatformPermission } from './platform-permissions.js';
import type { PlatformPermission } from './platform-permissions.js';
import { verifyPassword } from './password.js';
import { decryptSecret } from './shopify-crypto.js';
import { verifyTotp } from './totp.js';

export const hashToken = (value: string): string => createHash('sha256').update(value).digest('hex');
const equal = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(hashToken(left)), Buffer.from(hashToken(right)));
export const sessionCookieName = (environment: AppEnvironment): string => environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';
export async function verifyAdminCredentials(auth: AuthRepository, environment: AppEnvironment, session: SessionUser, body: { currentPassword?: unknown; code?: unknown } | undefined): Promise<{ code: string; message: string } | null> {
  const operator = await auth.findUserByEmail(session.user.email);
  const password = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  if (!operator?.passwordHash || !password || password.length > 128 || !await verifyPassword(password, operator.passwordHash)) return { code: 'REAUTH_REQUIRED', message: 'Confirme sua senha de administrador para continuar.' };
  if (operator.mfaEnabledAt) {
    const code = typeof body?.code === 'string' ? body.code : '';
    if (!environment.APP_ENCRYPTION_KEY || !operator.mfaSecretEncrypted || !verifyTotp(code, decryptSecret(operator.mfaSecretEncrypted, environment.APP_ENCRYPTION_KEY))) return { code: 'MFA_CODE_INVALID', message: 'Confirme o código atual do seu autenticador.' };
  }
  return null;
}
export function validAdminMutation(request: FastifyRequest, session: SessionUser, environment: AppEnvironment): boolean {
  const origin = request.headers.origin;
  const header = request.headers['x-csrf-token'];
  const cookie = request.cookies[environment.NODE_ENV === 'production' ? '__Host-solid_csrf' : 'solid_csrf'];
  return typeof origin === 'string' && environment.CORS_ORIGINS.includes(origin) && typeof header === 'string' && Boolean(cookie) && equal(cookie!, header) && equal(hashToken(header), session.csrfTokenHash);
}
export async function requirePlatformSession(request: FastifyRequest, environment: AppEnvironment, auth: AuthRepository, permission: PlatformPermission): Promise<SessionUser | null> {
  const token = request.cookies[sessionCookieName(environment)];
  const session = token ? await auth.findActiveSession(hashToken(token), new Date()) : null;
  return session && !session.support && hasPlatformPermission(session.user, permission) ? session : null;
}
