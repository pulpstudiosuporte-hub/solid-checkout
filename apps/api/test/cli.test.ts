import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@solid/database';
import type { AuthRepository } from '../src/auth-repository.js';
import type { CatalogRepository } from '../src/catalog-repository.js';
import { registerCliRoutes } from '../src/cli-routes.js';
vi.mock('../src/store-onboarding.js', () => ({ storeOnboardingComplete: vi.fn(() => Promise.resolve(true)) }));
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const config = JSON.parse(readFileSync(new URL('./fixtures/cli-config.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const accessToken = `pirat_${'a'.repeat(43)}`;
const bearer = { authorization: `Bearer ${accessToken}` };
const browserHeaders = { cookie: 'solid_session=session; solid_csrf=csrf', origin: 'http://localhost:5173', 'x-csrf-token': 'csrf' };

async function setup() {
  type Device = Record<string, unknown> & { id: string; expiresAt: Date };
  type Version = { id: string; checkoutId: string; config: Record<string, unknown>; action: string };
  let device: Device | null = null;
  const state = { allowed: true, role: 'OWNER', support: false, revision: new Date('2026-09-19T06:00:00Z'), draft: structuredClone(config), published: { ...config, title: 'Versão publicada' } as Record<string, unknown>, versions: [] as Version[], writes: 0, domain: true, connection: { id: 'connection', userId: 'user-a', storeId: 'store-a', canPublish: false, revokedAt: null as Date | null, expiresAt: new Date(Date.now() + 60_000) } };
  const matchesDevice = (where: Record<string, unknown>) => device && Object.entries(where).every(([key, value]) => key === 'expiresAt' ? device!.expiresAt > (value as { gt: Date }).gt : device![key] === value);
  const db = {
    cliDevice: {
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
      create: vi.fn(({ data }: { data: Device }) => { device = { userId: null, storeId: null, consumedAt: null, ...data, id: 'device' }; return Promise.resolve(device); }),
      findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) => Promise.resolve(matchesDevice(where) ? { ...device } : null)),
      updateMany: vi.fn(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => { if (!matchesDevice(where)) return Promise.resolve({ count: 0 }); Object.assign(device!, data); return Promise.resolve({ count: 1 }); }),
    },
    cliConnection: {
      findFirst: vi.fn(({ where }: { where: { tokenHash: string } }) => Promise.resolve(state.allowed && !state.connection.revokedAt && state.connection.expiresAt > new Date() && where.tokenHash === hash(accessToken) ? state.connection : null)),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'connection-new', ...data })),
      update: vi.fn(({ data }: { data: Partial<typeof state.connection> }) => Promise.resolve(Object.assign(state.connection, data))),
      updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
      findMany: vi.fn(() => Promise.resolve([])),
    },
    storeMember: {
      findUnique: vi.fn(() => Promise.resolve({ role: state.role })),
      findFirst: vi.fn(() => Promise.resolve(state.allowed ? { userId: 'user-a', storeId: 'store-a' } : null)),
    },
    store: { findUniqueOrThrow: vi.fn(() => Promise.resolve({ publicId: 'store-public', name: 'Loja de teste' })), findUnique: vi.fn(() => Promise.resolve({ publicId: 'store-public', name: 'Loja de teste' })) },
    checkout: {
      findFirst: vi.fn(({ where }: { where: { publicId: string; storeId: string } }) => Promise.resolve(where.publicId === 'checkout-a' && where.storeId === 'store-a' ? { id: 'internal-checkout', publicId: 'checkout-a', name: 'Tema', mode: 'DIRECT_LINK', product: { active: true }, draftConfig: state.draft, publishedConfig: state.published, updatedAt: state.revision, status: 'PUBLISHED' } : null)),
      update: vi.fn(({ data }: { data: { draftConfig?: Record<string, unknown>; publishedConfig?: Record<string, unknown>; updatedAt: Date } }) => { state.writes++; if (data.draftConfig) state.draft = data.draftConfig; if (data.publishedConfig) state.published = data.publishedConfig; state.revision = data.updatedAt; return Promise.resolve({ publicId: 'checkout-a', updatedAt: state.revision, status: 'PUBLISHED' }); }),
      updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    checkoutCliVersion: {
      create: vi.fn(({ data }: { data: Omit<Version, 'id'> }) => { state.versions.push({ id: `version-${state.versions.length + 1}`, ...data }); return Promise.resolve(); }),
      findFirst: vi.fn(({ where }: { where: { id: string; checkoutId: string } }) => Promise.resolve(state.versions.find(v => v.id === where.id && v.checkoutId === where.checkoutId))),
    },
    storeDomain: { count: vi.fn(() => Promise.resolve(state.domain ? 1 : 0)) },
    auditLog: { create: vi.fn(() => Promise.resolve({})) },
    $queryRaw: vi.fn(() => Promise.resolve([])),
    $transaction: (callback: (db: unknown) => unknown): Promise<unknown> => Promise.resolve(callback(db)),
  };
  const auth = { findActiveSession: (value: string) => Promise.resolve(value === hash('session') ? { userId: 'user-a', sessionId: 'session-a', csrfTokenHash: hash('csrf'), ...(state.support ? { support: {} } : {}) } : null) } as unknown as AuthRepository;
  const catalog = { resolveStoreContext: () => Promise.resolve({ userId: 'user-a', storeId: 'store-a', role: state.role, sessionId: 'session-a' }) } as unknown as CatalogRepository;
  const app = Fastify(); await app.register(cookie); await app.register(rateLimit, { global: false });
  registerCliRoutes(app, { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: ['http://localhost:5173'], TRUST_PROXY: false }, auth, catalog, db as unknown as PrismaClient);
  return { app, state, db, device: () => device };
}

describe('CLI conectada', () => {
  it('vincula código, verificador, CSRF, loja e troca de uso único', async () => {
    const { app, db } = await setup();
    const verifier = 'v'.repeat(43);
    const started = await app.inject({ method: 'POST', url: '/cli/device', payload: { challenge: hash(verifier), label: 'Minha IDE' } });
    expect(started.statusCode).toBe(200); const device = started.json<{ deviceToken: string; userCode: string }>();
    expect(db.cliDevice.create.mock.calls[0]?.[0].data.tokenHash).not.toBe(device.deviceToken);
    const poll = (v = verifier) => app.inject({ method: 'POST', url: '/cli/device/token', payload: { deviceToken: device.deviceToken, verifier: v } });
    expect((await poll()).statusCode).toBe(202);
    expect((await poll('x'.repeat(43))).statusCode).toBe(410);
    const body = { userCode: device.userCode, canPublish: false, storePublicId: 'store-public' };
    expect((await app.inject({ method: 'POST', url: '/cli/device/approve', payload: body })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/cli/device/approve', headers: { ...browserHeaders, origin: 'https://untrusted.example' }, payload: body })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/cli/device/approve', headers: browserHeaders, payload: { ...body, storePublicId: 'other-store' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: '/cli/device/approve', headers: browserHeaders, payload: body })).statusCode).toBe(200);
    const accepted = await poll(); expect(accepted.statusCode).toBe(200); expect(accepted.json<{ accessToken: string }>().accessToken).toMatch(/^pirat_/); expect(accepted.headers['cache-control']).toBe('no-store');
    expect((await poll()).statusCode).toBe(410); expect(db.cliConnection.create).toHaveBeenCalledTimes(1);
    await app.close();
  });
  it('recusa sessão de suporte, código expirado e concessão repetida', async () => {
    const { app, state, device } = await setup();
    const started = (await app.inject({ method: 'POST', url: '/cli/device', payload: { challenge: hash('v'.repeat(43)), label: 'IDE' } })).json<{ userCode: string }>();
    state.support = true;
    expect((await app.inject({ method: 'POST', url: '/cli/device/approve', headers: browserHeaders, payload: { userCode: started.userCode, canPublish: true } })).statusCode).toBe(403);
    state.support = false; device()!.expiresAt = new Date(0);
    expect((await app.inject({ method: 'POST', url: '/cli/device/approve', headers: browserHeaders, payload: { userCode: started.userCode, canPublish: true } })).statusCode).toBe(404);
    await app.close();
  });
  it('isola loja e reavalia revogação, função e expiração em cada requisição', async () => {
    const { app, state } = await setup();
    expect((await app.inject({ url: '/cli/checkouts/checkout-a', headers: bearer })).statusCode).toBe(200);
    expect((await app.inject({ url: '/cli/checkouts/checkout-b', headers: bearer })).statusCode).toBe(404);
    state.role = 'ANALYST'; expect((await app.inject({ url: '/cli/me', headers: bearer })).statusCode).toBe(401);
    state.role = 'OWNER'; state.connection.expiresAt = new Date(0); expect((await app.inject({ url: '/cli/me', headers: bearer })).statusCode).toBe(401);
    state.connection.expiresAt = new Date(Date.now() + 60_000);
    expect((await app.inject({ method: 'POST', url: '/cli/logout', headers: bearer })).statusCode).toBe(200);
    expect((await app.inject({ url: '/cli/me', headers: bearer })).statusCode).toBe(401);
    await app.close();
  });
  it('envia só rascunho, detecta conflito e não publica sem concessão', async () => {
    const { app, state, db } = await setup(); const revision = state.revision.toISOString();
    const push = await app.inject({ method: 'POST', url: '/cli/checkouts/checkout-a/push', headers: bearer, payload: { revision, config: { ...config, title: 'Minha marca' } } });
    expect(push.statusCode).toBe(200); expect(state.draft.title).toBe('Minha marca'); expect(state.published.title).toBe('Versão publicada'); expect(state.versions).toHaveLength(1); expect(db.$queryRaw).toHaveBeenCalled();
    expect((await app.inject({ method: 'POST', url: '/cli/checkouts/checkout-a/push', headers: bearer, payload: { revision, config } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: '/cli/checkouts/checkout-a/publish', headers: bearer, payload: { revision: state.revision.toISOString() } })).statusCode).toBe(403);
    expect(state.writes).toBe(1); await app.close();
  });
  it('valida campos, protege publicação e restaura somente a versão da loja', async () => {
    const { app, state } = await setup();
    expect((await app.inject({ method: 'POST', url: '/cli/validate', headers: bearer, payload: { config: { ...config, arbitraryScript: 'bad' } } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/cli/validate', headers: bearer, payload: { config } })).statusCode).toBe(200); expect(state.writes).toBe(0);
    state.connection.canPublish = true; state.domain = false;
    const publish = () => app.inject({ method: 'POST', url: '/cli/checkouts/checkout-a/publish', headers: bearer, payload: { revision: state.revision.toISOString() } });
    expect((await publish()).statusCode).toBe(409); state.domain = true; expect((await publish()).statusCode).toBe(200);
    expect(state.published).toEqual(state.draft);
    expect((await app.inject({ method: 'POST', url: '/cli/checkouts/checkout-a/restore', headers: bearer, payload: { revision: state.revision.toISOString(), version: 'other-checkout-version' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/cli/checkouts/checkout-a/restore', headers: bearer, payload: { revision: state.revision.toISOString(), version: 'version-1' } })).statusCode).toBe(200);
    expect(state.draft.title).toBe('Versão publicada'); expect(state.published.title).toBe(config.title);
    await app.close();
  });
});
