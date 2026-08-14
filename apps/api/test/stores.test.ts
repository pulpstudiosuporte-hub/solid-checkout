import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import { buildApp } from '../src/app.js';
import type { AuthRepository, LoginUser, SessionUser } from '../src/auth-repository.js';
import type { StoreRepository, StoreSummary } from '../src/store-repository.js';

const origin = 'http://localhost:5173';
const env: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: [origin], TRUST_PROXY: false };
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const sessionToken = 'store-session'; const csrfToken = 'store-csrf';

class MemoryAuth implements AuthRepository {
  findUserByEmail(): Promise<LoginUser | null> { return Promise.resolve(null); }
  createSession(): Promise<void> { return Promise.resolve(); }
  findActiveSession(tokenHash: string): Promise<SessionUser | null> { return Promise.resolve(tokenHash === sha256(sessionToken) ? { sessionId: 'session-a', userId: 'user-a', csrfTokenHash: sha256(csrfToken), expiresAt: new Date(Date.now() + 60_000), absoluteExpiresAt: new Date(Date.now() + 60_000), user: { publicId: 'user-public-a', name: 'Owner', email: 'owner@example.com' } } : null); }
  touchSession(): Promise<void> { return Promise.resolve(); } revokeSession(): Promise<void> { return Promise.resolve(); } updatePasswordAndRevokeOtherSessions(): Promise<void> { return Promise.resolve(); }
}

class MemoryStores implements StoreRepository {
  items: StoreSummary[] = [{ publicId: 'store-a', name: 'Loja A', slug: 'loja-a', role: 'OWNER', active: true }];
  listForUser(): Promise<readonly StoreSummary[]> { return Promise.resolve(this.items); }
  createForUser(_userId: string, _sessionId: string, name: string, slug: string): Promise<StoreSummary> { this.items = this.items.map(item => ({...item, active: false})); const store: StoreSummary = { publicId: 'store-new', name, slug, role: 'OWNER', active: true }; this.items.push(store); return Promise.resolve(store); }
  selectForUser(_userId: string, _sessionId: string, storePublicId: string): Promise<StoreSummary | null> { const selected = this.items.find(item => item.publicId === storePublicId); if (!selected) return Promise.resolve(null); this.items = this.items.map(item => ({...item, active: item.publicId === storePublicId})); return Promise.resolve({...selected, active: true}); }
}

const headers = { origin, cookie: `solid_session=${sessionToken}; solid_csrf=${csrfToken}`, 'x-csrf-token': csrfToken };

describe('contexto de lojas', () => {
  it('lista lojas somente com sessão autenticada', async () => {
    const app = buildApp(env, { authRepository: new MemoryAuth(), storeRepository: new MemoryStores() });
    expect((await app.inject({ method: 'GET', url: '/stores' })).statusCode).toBe(401);
    const response = await app.inject({ method: 'GET', url: '/stores', headers: { cookie: `solid_session=${sessionToken}` } });
    expect(response.statusCode).toBe(200); expect(response.json<{ items: StoreSummary[] }>().items[0]?.publicId).toBe('store-a'); await app.close();
  });

  it('cria loja com CSRF e a torna ativa', async () => {
    const stores = new MemoryStores(); const app = buildApp(env, { authRepository: new MemoryAuth(), storeRepository: stores });
    expect((await app.inject({ method: 'POST', url: '/stores', headers: { cookie: `solid_session=${sessionToken}` }, payload: { name: 'Nova Loja' } })).statusCode).toBe(403);
    const response = await app.inject({ method: 'POST', url: '/stores', headers, payload: { name: 'Nova Loja' } });
    expect(response.statusCode).toBe(201); expect(response.json<{ store: StoreSummary }>().store).toMatchObject({ name: 'Nova Loja', active: true }); await app.close();
  });

  it('não permite selecionar loja sem vínculo', async () => {
    const app = buildApp(env, { authRepository: new MemoryAuth(), storeRepository: new MemoryStores() });
    const response = await app.inject({ method: 'POST', url: '/stores/store-foreign/select', headers });
    expect(response.statusCode).toBe(404); await app.close();
  });
});
