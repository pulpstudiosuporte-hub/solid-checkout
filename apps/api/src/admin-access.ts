import { createHash, timingSafeEqual } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { FastifyRequest } from 'fastify';
import type { AuthRepository, SessionUser } from './auth-repository.js';
import { hasPlatformPermission } from './platform-permissions.js';
import type { PlatformPermission } from './platform-permissions.js';

export const hashToken = (value: string): string => createHash('sha256').update(value).digest('hex');
const equal = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(hashToken(left)), Buffer.from(hashToken(right)));
export const sessionCookieName = (environment: AppEnvironment): string => environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';
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
