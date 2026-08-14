import { beforeAll, describe, expect, it } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import { buildApp } from '../src/app.js';
import type { AuthRepository, LoginUser, SessionUser } from '../src/auth-repository.js';
import { hashPassword } from '../src/password.js';

const origin = 'http://localhost:5173';
const env: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: [origin], TRUST_PROXY: false };
let passwordHash = '';
beforeAll(async () => { passwordHash = await hashPassword('correct horse battery staple'); });

class MemoryAuthRepository implements AuthRepository {
  readonly sessions = new Map<string, SessionUser>();
  user: LoginUser = { id: 'internal-user-id', publicId: 'public-user-id', name: 'Owner', email: 'owner@example.com', passwordHash: null, disabledAt: null };
  findUserByEmail(email: string): Promise<LoginUser | null> { return Promise.resolve(email === this.user.email ? { ...this.user, passwordHash } : null); }
  createSession(input: { tokenHash: string; csrfTokenHash: string; userId: string; userAgent?: string; expiresAt: Date; absoluteExpiresAt: Date }): Promise<void> {
    this.sessions.set(input.tokenHash, { sessionId: 'session-id', csrfTokenHash: input.csrfTokenHash, expiresAt: input.expiresAt, absoluteExpiresAt: input.absoluteExpiresAt, user: { publicId: this.user.publicId, name: this.user.name, email: this.user.email } }); return Promise.resolve();
  }
  findActiveSession(tokenHash: string): Promise<SessionUser | null> { return Promise.resolve(this.sessions.get(tokenHash) ?? null); }
  touchSession(): Promise<void> { return Promise.resolve(); }
  revokeSession(tokenHash: string): Promise<void> { this.sessions.delete(tokenHash); return Promise.resolve(); }
}

const cookiePair = (setCookie: string | string[] | undefined, name: string): string => {
  const values = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
  return values.find(value => value.startsWith(`${name}=`))?.split(';')[0] ?? '';
};

describe('autenticação administrativa', () => {
  it('recusa login sem origem e token CSRF válidos', async () => {
    const app = buildApp(env, { authRepository: new MemoryAuthRepository() });
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'owner@example.com', password: 'correct horse battery staple' } });
    await app.close(); expect(response.statusCode).toBe(403); expect(response.json<{ error: { code: string } }>().error.code).toBe('CSRF_INVALID');
  });

  it('cria sessão opaca em cookie HttpOnly e retorna usuário seguro', async () => {
    const app = buildApp(env, { authRepository: new MemoryAuthRepository() });
    const csrf = await app.inject({ method: 'GET', url: '/auth/csrf', headers: { origin } });
    const csrfToken = csrf.json<{ csrfToken: string }>().csrfToken; const csrfCookie = cookiePair(csrf.headers['set-cookie'], 'solid_csrf');
    const login = await app.inject({ method: 'POST', url: '/auth/login', headers: { origin, cookie: csrfCookie, 'x-csrf-token': csrfToken }, payload: { email: 'OWNER@example.com', password: 'correct horse battery staple' } });
    await app.close();
    expect(login.statusCode).toBe(200); expect(login.json<{ user: unknown }>().user).toEqual({ id: 'public-user-id', name: 'Owner', email: 'owner@example.com' });
    expect(cookiePair(login.headers['set-cookie'], 'solid_session')).toMatch(/^solid_session=/);
    expect(String(login.headers['set-cookie'])).toContain('HttpOnly'); expect(String(login.headers['set-cookie'])).toContain('SameSite=Strict');
  });

  it('não revela se o e-mail existe', async () => {
    const app = buildApp(env, { authRepository: new MemoryAuthRepository() });
    const csrf = await app.inject({ method: 'GET', url: '/auth/csrf', headers: { origin } });
    const csrfToken = csrf.json<{ csrfToken: string }>().csrfToken; const csrfCookie = cookiePair(csrf.headers['set-cookie'], 'solid_csrf');
    const response = await app.inject({ method: 'POST', url: '/auth/login', headers: { origin, cookie: csrfCookie, 'x-csrf-token': csrfToken }, payload: { email: 'missing@example.com', password: 'wrong password' } });
    await app.close(); expect(response.statusCode).toBe(401); expect(response.json<{ error: { message: string } }>().error.message).toBe('E-mail ou senha inválidos.');
  });
});
