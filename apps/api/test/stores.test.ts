import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import { buildApp } from '../src/app.js';
import type { AuthRepository, LoginUser, SessionUser } from '../src/auth-repository.js';
import type { DokployDomainClient } from '../src/dokploy-client.js';
import type { StoreDomainSummary, StoreRepository, StoreSummary } from '../src/store-repository.js';

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
  domain: StoreDomainSummary | null = null;
  listForUser(): Promise<readonly StoreSummary[]> { return Promise.resolve(this.items); }
  createForUser(_userId: string, _sessionId: string, name: string, slug: string): Promise<StoreSummary> { this.items = this.items.map(item => ({...item, active: false})); const store: StoreSummary = { publicId: 'store-new', name, slug, role: 'OWNER', active: true }; this.items.push(store); return Promise.resolve(store); }
  selectForUser(_userId: string, _sessionId: string, storePublicId: string): Promise<StoreSummary | null> { const selected = this.items.find(item => item.publicId === storePublicId); if (!selected) return Promise.resolve(null); this.items = this.items.map(item => ({...item, active: item.publicId === storePublicId})); return Promise.resolve({...selected, active: true}); }
  archiveForUser(_userId: string, _sessionId: string, storePublicId: string): Promise<boolean> { if (this.items.length < 2 || !this.items.some(item => item.publicId === storePublicId)) return Promise.resolve(false); this.items = this.items.filter(item => item.publicId !== storePublicId); return Promise.resolve(true); }
  getDomainForUser(): Promise<StoreDomainSummary | null> { return Promise.resolve(this.domain); }
  saveDomainForUser(_userId: string, _sessionId: string, hostname: string): Promise<StoreDomainSummary> { this.domain = { publicId: 'domain-a', hostname, status: 'PENDING_DNS', verifiedAt: null, activatedAt: null, lastCheckedAt: null, dokployDomainId: null }; return Promise.resolve(this.domain); }
  updateDomainVerification(_userId: string, _sessionId: string, domainPublicId: string, verified: boolean): Promise<StoreDomainSummary | null> { if (!this.domain || this.domain.publicId !== domainPublicId) return Promise.resolve(null); this.domain = { ...this.domain, status: verified ? 'VERIFIED_DNS' : 'PENDING_DNS', verifiedAt: verified ? new Date() : null, lastCheckedAt: new Date() }; return Promise.resolve(this.domain); }
  activateDomainForUser(_userId: string, _sessionId: string, domainPublicId: string, dokployDomainId: string): Promise<StoreDomainSummary | null> { if (!this.domain || this.domain.publicId !== domainPublicId) return Promise.resolve(null); this.domain = { ...this.domain, status: 'ACTIVE', dokployDomainId, activatedAt: new Date() }; return Promise.resolve(this.domain); }
  deleteDomainForUser(_userId: string, _sessionId: string, domainPublicId: string): Promise<boolean> { if (!this.domain || this.domain.publicId !== domainPublicId) return Promise.resolve(false); this.domain = null; return Promise.resolve(true); }
}

class FailingDokploy implements DokployDomainClient {
  deletedDomainIds: string[] = [];
  createCheckoutDomain(): Promise<string> { return Promise.resolve('unused'); }
  findCheckoutDomain(): Promise<string | null> { return Promise.resolve(null); }
  reconcileCheckoutDomain(): Promise<string> { return Promise.resolve('unused'); }
  deleteCheckoutDomain(domainId: string): Promise<void> {
    this.deletedDomainIds.push(domainId);
    return Promise.reject(new Error('Dokploy indisponível'));
  }
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
  it('mantém o novo domínio salvo quando a limpeza anterior no Dokploy falha', async () => {
    const stores = new MemoryStores();
    stores.domain = { publicId: 'domain-old', hostname: 'old.example.com', status: 'ACTIVE', verifiedAt: new Date(), activatedAt: new Date(), lastCheckedAt: new Date(), dokployDomainId: 'dokploy-old' };
    const dokploy = new FailingDokploy();
    const app = buildApp(env, { authRepository: new MemoryAuth(), storeRepository: stores, dokployClient: dokploy });
    const response = await app.inject({ method: 'PUT', url: '/store-domain', headers, payload: { hostname: 'new.example.com' } });
    expect(response.statusCode).toBe(200);
    expect(stores.domain?.hostname).toBe('new.example.com');
    expect(dokploy.deletedDomainIds).toEqual(['dokploy-old']);
    await app.close();
  });

  it('remove o domínio do banco mesmo quando a limpeza no Dokploy falha', async () => {
    const stores = new MemoryStores();
    stores.domain = { publicId: 'domain-a', hostname: 'checkout.example.com', status: 'ACTIVE', verifiedAt: new Date(), activatedAt: new Date(), lastCheckedAt: new Date(), dokployDomainId: 'dokploy-a' };
    const dokploy = new FailingDokploy();
    const app = buildApp(env, { authRepository: new MemoryAuth(), storeRepository: stores, dokployClient: dokploy });
    const response = await app.inject({ method: 'DELETE', url: '/store-domain/domain-a', headers });
    expect(response.statusCode).toBe(204);
    expect(stores.domain).toBeNull();
    expect(dokploy.deletedDomainIds).toEqual(['dokploy-a']);
    await app.close();
  });
});
