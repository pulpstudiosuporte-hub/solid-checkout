import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import { buildApp } from '../src/app.js';
import type { AuthRepository } from '../src/auth-repository.js';

const origin = 'http://localhost:5173';
const environment: AppEnvironment = {
  NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: [origin], TRUST_PROXY: false,
  APP_URL: origin, RESEND_API_KEY: 're_registration_test', EMAIL_FROM: 'SOLID <contato@example.com>', APP_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64')
};

type PendingSignup = {
  id: string; email: string; name: string; passwordHash: string; storeSlug: string;
  tokenHash: string; expiresAt: Date; emailSentAt?: Date | null;
};
type CreateArgs = { data: Record<string, unknown> };
type PendingUpsertArgs = { create: Omit<PendingSignup, 'id'>; update: Partial<Omit<PendingSignup, 'id'>> };
type PendingUpdateArgs = { data: Partial<PendingSignup> };
type PendingWhereArgs = { where: { id?: string; email?: string } };

const cookiePair = (setCookie: string | string[] | undefined, name: string): string => {
  const values = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
  return values.find(value => value.startsWith(`${name}=`))?.split(';')[0] ?? '';
};

function databaseDouble() {
  let pending: PendingSignup | null = null;
  const createdUser = vi.fn(({ data }: CreateArgs) => Promise.resolve({ id: 'user-id', ...data }));
  const pendingSignup = {
    upsert: vi.fn(({ create, update }: PendingUpsertArgs) => {
      pending = { id: 'pending-id', ...create, ...(pending ? update : {}) };
      return Promise.resolve(pending);
    }),
    update: vi.fn(({ data }: PendingUpdateArgs) => {
      pending = pending ? { ...pending, ...data } : null;
      return Promise.resolve(pending);
    }),
    findUnique: vi.fn(({ where }: PendingWhereArgs) => Promise.resolve(
      where.email ? pending?.email === where.email ? pending : null : pending?.id === where.id ? pending : null
    )),
    findFirst: vi.fn(() => Promise.resolve(null)),
    delete: vi.fn(() => { const current = pending; pending = null; return Promise.resolve(current); })
  };
  const transaction = { pendingSignup, user: { create: createdUser } };
  const database = {
    user: { findUnique: vi.fn(() => Promise.resolve(null)), create: createdUser }, pendingSignup,
    $transaction: vi.fn((input: (client: typeof transaction) => Promise<unknown>) => input(transaction)),
  } as unknown as PrismaClient;
  return { database, createdUser };
}

afterEach(() => vi.unstubAllGlobals());

describe('cadastro público', () => {
  it('confirma o código, ativa a conta e deixa a criação da primeira loja para o usuário', async () => {
    let sentEmail: { subject?: string } | undefined;
    vi.stubGlobal('fetch', vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      const parsed: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
      if (typeof parsed === 'object' && parsed !== null && 'subject' in parsed && typeof parsed.subject === 'string') sentEmail = { subject: parsed.subject };
      return Promise.resolve(new Response(null, { status: 202 }));
    }));
    const db = databaseDouble();
    const app = buildApp(environment, { authRepository: {} as AuthRepository, database: db.database });
    const csrf = await app.inject({ method: 'GET', url: '/auth/csrf', headers: { origin } });
    const csrfToken = csrf.json<{ csrfToken: string }>().csrfToken;
    const headers = { origin, cookie: cookiePair(csrf.headers['set-cookie'], 'solid_auth_csrf'), 'x-csrf-token': csrfToken };
    const registration = await app.inject({ method: 'POST', url: '/auth/register', headers, payload: { name: 'Cliente Teste', email: 'cliente@example.com', password: 'correct horse battery staple', termsAccepted: true } });
    expect(registration.statusCode).toBe(202);
    const code = sentEmail?.subject?.match(/^\d{6}/)?.[0];
    expect(code).toMatch(/^\d{6}$/);

    const invalid = await app.inject({ method: 'POST', url: '/auth/verify-email', headers, payload: { email: 'cliente@example.com', code: '000000' } });
    expect(invalid.statusCode).toBe(400);
    const verified = await app.inject({ method: 'POST', url: '/auth/verify-email', headers, payload: { email: 'CLIENTE@example.com', code } });
    expect(verified.statusCode).toBe(200);
    expect(verified.json()).toEqual({ verified: true, activated: true });
    const userData = db.createdUser.mock.calls[0]?.[0].data;
    expect(userData).toMatchObject({ email: 'cliente@example.com', accountStatus: 'APPROVED' });
    expect(userData?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(db.createdUser).toHaveBeenCalledOnce();
    await app.close();
  });
});
