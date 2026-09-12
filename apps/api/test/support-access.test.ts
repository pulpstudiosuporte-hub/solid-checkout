import Fastify, { type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import { describe, expect, it, vi } from 'vitest';
import { PrismaAuthRepository, type AuthRepository, type SessionUser } from '../src/auth-repository.js';
import { registerSupportSessionHook } from '../src/support-session-hook.js';
import { registerAdminSupportRoutes } from '../src/admin-support-routes.js';
import { registerPlatformRoleRoutes } from '../src/platform-role-routes.js';
import { hashToken } from '../src/admin-access.js';
import { hashPassword } from '../src/password.js';
import { encryptSecret } from '../src/shopify-crypto.js';
import { generateTotpSecret, totpCode } from '../src/totp.js';

const env: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: ['http://localhost:5173'], TRUST_PROXY: false, APP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64') };
const supportToken = 's'.repeat(43);
const future = new Date(Date.now() + 1800000);
const parent: SessionUser = { sessionId: 'parent-id', userId: 'admin-id', csrfTokenHash: hashToken('csrf'), expiresAt: future, absoluteExpiresAt: future, user: { publicId: 'admin-public', name: 'Admin', email: 'admin@example.com', platformAdmin: true } };
const child: SessionUser = { ...parent, sessionId: 'child-id', userId: 'client-id', user: { publicId: 'client-public', name: 'Cliente', email: 'client@example.com' }, support: { parentSessionId: parent.sessionId, actorUserId: parent.userId, actorPublicId: parent.user.publicId, actorName: 'Admin', mode: 'READ_ONLY', reason: 'Investigar chamado 123', expiresAt: future } };
const normalHeaders = { cookie: 'solid_session=primary; solid_csrf=csrf', origin: env.CORS_ORIGINS[0]!, 'x-csrf-token': 'csrf' };
const headers = { ...normalHeaders, 'x-solid-support-session': supportToken, 'x-solid-user-context': child.user.publicId };

async function fixture(mode: 'READ_ONLY' | 'MAINTENANCE' = 'READ_ONLY') {
  let primary: SessionUser | null = structuredClone(parent);
  let support: SessionUser | null = { ...child, support: { ...child.support!, mode } };
  const auth = { findActiveSession: vi.fn((hash: string) => Promise.resolve(hash === hashToken('primary') ? primary : hash === hashToken(supportToken) ? support : null)), findUserByEmail: vi.fn(), touchSession: vi.fn() } as unknown as AuthRepository;
  const audit = vi.fn<(input: { data: Record<string, unknown> }) => Promise<object>>().mockResolvedValue({});
  const database = { auditLog: { create: audit }, session: { count: vi.fn().mockResolvedValue(0), create: vi.fn<(input: { data: Record<string, unknown> }) => Promise<{ id: string }>>().mockResolvedValue({ id: 'child-id' }), findFirst: vi.fn().mockResolvedValue({ id: 'child-id', user: { publicId: 'client-public' } }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, user: { findUnique: vi.fn().mockResolvedValue({ id: 'client-id', publicId: 'client-public', name: 'Cliente', disabledAt: null, accountStatus: 'APPROVED', platformAdmin: false, platformRole: null }) }, platformRole: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ publicId: 'new-role' }), findUnique: vi.fn().mockResolvedValue({ id: 'role-id', name: 'Equipe', permissions: ['support.read'] }), update: vi.fn().mockResolvedValue({ publicId: 'role-id' }) }, $transaction: (work: (tx: unknown) => unknown) => Promise.resolve(work(database)) };
  const db = database as unknown as PrismaClient;
  const app = Fastify();
  await app.register(cookie);
  registerSupportSessionHook(app, env, auth, db);
  registerAdminSupportRoutes(app, env, auth, db);
  registerPlatformRoleRoutes(app, env, auth, db);
  const action = vi.fn((request: FastifyRequest) => ({ effectiveToken: request.cookies.solid_session }));
  app.get('/products', action);
  app.post('/products', action);
  app.post('/stores/:storeId/select', action);
  app.post('/unknown-mutation', action);
  app.post('/auth/logout', action);
  app.patch('/settings', action);
  app.post('/store-webhooks', action);
  app.get('/auth/sessions', action);
  return { app, auth, database, audit, action, revoke: () => { support = null; }, logout: () => { primary = null; }, changeParent: () => { primary = { ...parent, sessionId: 'different-parent' }; }, useStaff: () => { primary = { ...parent, user: { ...parent.user, platformAdmin: false, platformPermissions: ['users.read', 'support.read'] } }; } };
}

describe('support session boundary', () => {
  it('resolves the client only in the support tab and records the responsible administrator', async () => {
    const f = await fixture();
    try {
      const response = await f.app.inject({ method: 'GET', url: '/products', headers });
      expect(response.statusCode).toBe(200);
      expect(response.json<{ effectiveToken: string }>().effectiveToken).toBe(supportToken);
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(f.audit.mock.calls[0]?.[0].data).toMatchObject({ actorUserId: 'admin-id', targetId: 'client-public', action: 'admin.support.request' });
      expect((await f.app.inject({ method: 'GET', url: '/products', headers: normalHeaders })).json<{ effectiveToken: string }>().effectiveToken).toBe('primary');
    } finally { await f.app.close(); }
  });
  it('rejects writes in consultation, permits switching only the child store, and rejects token cookie reuse', async () => {
    const f = await fixture();
    try {
      expect((await f.app.inject({ method: 'POST', url: '/products', headers })).statusCode).toBe(403);
      expect((await f.app.inject({ method: 'POST', url: '/stores/store-a/select', headers })).statusCode).toBe(200);
      expect((await f.app.inject({ method: 'GET', url: '/products', headers: { cookie: `solid_session=${supportToken}` } })).statusCode).toBe(403);
      expect(f.action).toHaveBeenCalledTimes(1);
    } finally { await f.app.close(); }
  });
  it('permits catalog maintenance but blocks sensitive, administrative and unknown routes', async () => {
    const f = await fixture('MAINTENANCE');
    try {
      expect((await f.app.inject({ method: 'POST', url: '/products', headers })).statusCode).toBe(200);
      for (const [method, url] of [['POST', '/auth/logout'], ['PATCH', '/settings'], ['POST', '/store-webhooks'], ['GET', '/auth/sessions'], ['GET', '/admin/roles'], ['POST', '/unknown-mutation']] as const) expect((await f.app.inject({ method, url, headers })).statusCode).toBe(403);
      expect(f.action).toHaveBeenCalledTimes(1);
    } finally { await f.app.close(); }
  });
  it('requires matching parent, target identity, origin and CSRF', async () => {
    const f = await fixture('MAINTENANCE');
    try {
      expect((await f.app.inject({ method: 'POST', url: '/products', headers: { ...headers, origin: 'https://evil.example' } })).statusCode).toBe(403);
      expect((await f.app.inject({ method: 'POST', url: '/products', headers: { ...headers, 'x-csrf-token': 'bad' } })).statusCode).toBe(403);
      expect((await f.app.inject({ method: 'GET', url: '/products', headers: { ...headers, 'x-solid-user-context': 'someone-else' } })).statusCode).toBe(409);
      f.changeParent();
      expect((await f.app.inject({ method: 'GET', url: '/products', headers })).statusCode).toBe(409);
      expect(f.action).not.toHaveBeenCalled();
    } finally { await f.app.close(); }
  });
  it('fails closed after expiry or parent logout and allows explicit termination after expiry', async () => {
    const f = await fixture();
    try {
      f.revoke();
      expect((await f.app.inject({ method: 'GET', url: '/products', headers })).statusCode).toBe(409);
      expect((await f.app.inject({ method: 'POST', url: '/admin/support/end', headers })).statusCode).toBe(204);
      expect(f.database.session.updateMany).toHaveBeenCalledWith({ where: { id: 'child-id', revokedAt: null }, data: { revokedAt: expect.any(Date) as Date } });
      f.logout();
      expect((await f.app.inject({ method: 'GET', url: '/products', headers })).statusCode).toBe(409);
      expect(f.action).not.toHaveBeenCalled();
    } finally { await f.app.close(); }
  });
  it('does not expose data when audit persistence fails', async () => {
    const f = await fixture();
    try {
      f.audit.mockRejectedValue(new Error('database unavailable'));
      expect((await f.app.inject({ method: 'GET', url: '/products', headers })).statusCode).toBe(500);
      expect(f.action).not.toHaveBeenCalled();
    } finally { await f.app.close(); }
  });
  it('requires administrator reauthentication and persists an expiring grant without a raw token', async () => {
    const f = await fixture();
    try {
      // The mock has no instance binding.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(f.auth.findUserByEmail).mockResolvedValue({ id: parent.userId, ...parent.user, passwordHash: await hashPassword('correct-password'), disabledAt: null });
      const payload = { mode: 'MAINTENANCE', reason: 'Investigar chamado 123', currentPassword: 'wrong' };
      expect((await f.app.inject({ method: 'POST', url: '/admin/users/client-public/support', headers: normalHeaders, payload })).statusCode).toBe(401);
      const response = await f.app.inject({ method: 'POST', url: '/admin/users/client-public/support', headers: normalHeaders, payload: { ...payload, currentPassword: 'correct-password' } });
      expect(response.statusCode).toBe(201);
      expect(response.json<{ supportToken: string }>().supportToken).toHaveLength(43);
      expect(f.database.session.create.mock.calls[0]?.[0].data).toMatchObject({ supportParentId: parent.sessionId, supportMode: 'MAINTENANCE', tokenHash: hashToken(response.json<{ supportToken: string }>().supportToken), absoluteExpiresAt: expect.any(Date) as Date });
      expect(JSON.stringify(f.audit.mock.calls)).not.toContain('correct-password');
      expect(JSON.stringify(f.audit.mock.calls)).not.toContain(response.json<{ supportToken: string }>().supportToken);
      f.useStaff();
      expect((await f.app.inject({ method: 'POST', url: '/admin/users/client-public/support', headers: normalHeaders, payload })).statusCode).toBe(403);
    } finally { await f.app.close(); }
  });
  it('keeps role administration exclusive to principal admins and rejects privilege escalation', async () => {
    const f = await fixture();
    try {
      const url = '/admin/roles';
      for (const permissions of [['roles.manage'], ['support.write'], ['unknown']]) expect((await f.app.inject({ method: 'POST', url, headers: normalHeaders, payload: { name: 'Equipe', permissions } })).statusCode).toBe(400);
      expect((await f.app.inject({ method: 'POST', url, headers: normalHeaders, payload: { name: 'Consulta', permissions: ['users.read', 'support.read'] } })).statusCode).toBe(201);
      expect((await f.app.inject({ method: 'PUT', url: '/admin/roles/role-id', headers: normalHeaders, payload: { name: 'Consulta', permissions: ['users.read', 'support.read'] } })).statusCode).toBe(200);
      expect(f.database.session.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { supportParent: { user: { platformRoleId: 'role-id' } }, revokedAt: null } }));
      f.useStaff();
      expect((await f.app.inject({ method: 'GET', url, headers: normalHeaders })).statusCode).toBe(403);
      expect((await f.app.inject({ method: 'PUT', url: '/admin/users/client-public/platform-role', headers: normalHeaders, payload: { rolePublicId: 'role-id' } })).statusCode).toBe(403);
    } finally { await f.app.close(); }
  });
  it('requires TOTP for MFA operators and rejects inactive or administrative targets', async () => {
    const f = await fixture();
    try {
      const secret = generateTotpSecret();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(f.auth.findUserByEmail).mockResolvedValue({ id: parent.userId, ...parent.user, disabledAt: null, passwordHash: await hashPassword('correct-password'), mfaEnabledAt: new Date(), mfaSecretEncrypted: encryptSecret(secret, env.APP_ENCRYPTION_KEY!) });
      const payload = { mode: 'READ_ONLY', reason: 'Investigate ticket 123', currentPassword: 'correct-password' };
      const url = '/admin/users/client-public/support';
      expect((await f.app.inject({ method: 'POST', url, headers: normalHeaders, payload })).statusCode).toBe(401);
      const verified = { ...payload, code: totpCode(secret) };
      expect((await f.app.inject({ method: 'POST', url, headers: normalHeaders, payload: verified })).statusCode).toBe(201);
      for (const target of [{ id: 'client-id', disabledAt: new Date(), accountStatus: 'APPROVED' }, { id: 'client-id', platformAdmin: true, accountStatus: 'APPROVED' }, { id: 'client-id', platformRole: { publicId: 'tech', name: 'Technical', permissions: [] }, accountStatus: 'APPROVED' }, { id: parent.userId, accountStatus: 'APPROVED' }]) {
        f.database.user.findUnique.mockResolvedValue(target);
        expect((await f.app.inject({ method: 'POST', url, headers: normalHeaders, payload: verified })).statusCode).toBe(409);
      }
      expect(f.database.session.create).toHaveBeenCalledTimes(1);
    } finally { await f.app.close(); }
  });
});

describe('database support grant validation', () => {
  const record = () => ({ id: 'child-id', userId: 'client-id', csrfTokenHash: hashToken('csrf'), expiresAt: future, absoluteExpiresAt: future, supportParentId: 'parent-id', supportMode: 'MAINTENANCE', supportReason: 'Investigating ticket', user: { ...child.user, platformAdmin: false }, supportParent: { id: 'parent-id', userId: 'admin-id', supportParentId: null, revokedAt: null, expiresAt: future, absoluteExpiresAt: future, user: { publicId: 'admin-public', name: 'Operator', disabledAt: null, accountStatus: 'APPROVED', platformAdmin: false, platformRole: { publicId: 'tech', name: 'Technical', permissions: ['support.read', 'support.write'] } } } });
  it('rechecks current role and parent lifecycle on every resolution', async () => {
    const value = record();
    const findFirst = vi.fn().mockResolvedValue(value);
    const repository = new PrismaAuthRepository({ session: { findFirst } } as unknown as PrismaClient);
    expect((await repository.findActiveSession('hash', new Date()))?.support?.actorUserId).toBe('admin-id');
    value.supportParent.user.platformRole.permissions = ['support.read'];
    expect(await repository.findActiveSession('hash', new Date())).toBeNull();
    value.supportParent.user.platformRole.permissions = ['support.read', 'support.write'];
    value.supportParent.expiresAt = new Date(0);
    expect(await repository.findActiveSession('hash', new Date())).toBeNull();
    value.supportParent.expiresAt = future;
    value.user.platformAdmin = true;
    expect(await repository.findActiveSession('hash', new Date())).toBeNull();
  });
});
