import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import { encryptSecret, decryptSecret } from '../src/shopify-crypto.js';
import { buildApp } from '../src/app.js';
import type { AuthRepository, LoginUser, SessionUser } from '../src/auth-repository.js';
import type { PrismaGatewayRepository } from '../src/gateway-repository.js';

const origin = 'http://localhost:5173'; const sessionToken = 'gateway-session'; const csrfToken = 'gateway-csrf';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const env: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: [origin], TRUST_PROXY: false };

class GatewayAuth implements AuthRepository {
  findUserByEmail(): Promise<LoginUser | null> { return Promise.resolve(null); }
  createSession(): Promise<void> { return Promise.resolve(); }
  findActiveSession(tokenHash: string): Promise<SessionUser | null> { return Promise.resolve(tokenHash === hash(sessionToken) ? { sessionId: 'session-a', userId: 'user-a', csrfTokenHash: hash(csrfToken), expiresAt: new Date(Date.now() + 60_000), absoluteExpiresAt: new Date(Date.now() + 60_000), user: { publicId: 'user-a', name: 'Owner', email: 'owner@example.com', mfaEnabled: false } } : null); }
  touchSession(): Promise<void> { return Promise.resolve(); }
  revokeSession(): Promise<void> { return Promise.resolve(); }
  updatePasswordAndRevokeOtherSessions(): Promise<void> { return Promise.resolve(); }
}

const authenticated = { origin, cookie: `solid_session=${sessionToken}; solid_csrf=${csrfToken}`, 'x-csrf-token': csrfToken };
function repository() {
  return {
    context: vi.fn().mockResolvedValue({ storeId: 'store-a', role: 'OWNER' }),
    setPrimary: vi.fn().mockResolvedValue({ active: true, priority: 0, verifiedAt: new Date(), updatedAt: new Date() }),
    disconnect: vi.fn().mockResolvedValue({ count: 1 }),
    recordGatewayConfiguration: vi.fn().mockResolvedValue(undefined),
  };
}

describe('configuração dos gateways de pagamento', () => {
  it('define como principal apenas uma conexão validada', async () => {
    const gateway = repository(); const app = buildApp(env, { authRepository: new GatewayAuth(), gatewayRepository: gateway as unknown as PrismaGatewayRepository });
    const response = await app.inject({ method: 'PUT', url: '/integrations/gateways/primary', headers: authenticated, payload: { provider: 'WESTPAY' } }); await app.close();
    expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({ connected: true, primary: true, priority: 0 });
    expect(gateway.setPrimary).toHaveBeenCalledWith('store-a', 'WESTPAY');
    expect(gateway.recordGatewayConfiguration).toHaveBeenCalledWith('store-a', 'user-a', 'gateway.primary_changed', 'WESTPAY', expect.any(String));
  });

  it('desconecta o gateway e registra a alteração', async () => {
    const gateway = repository(); const app = buildApp(env, { authRepository: new GatewayAuth(), gatewayRepository: gateway as unknown as PrismaGatewayRepository });
    const response = await app.inject({ method: 'DELETE', url: '/integrations/gateways/roas', headers: authenticated }); await app.close();
    expect(response.statusCode).toBe(204); expect(gateway.disconnect).toHaveBeenCalledWith('store-a', 'ROAS');
    expect(gateway.recordGatewayConfiguration).toHaveBeenCalledWith('store-a', 'user-a', 'gateway.disconnected', 'ROAS', expect.any(String));
  });

  it('rejeita alteração sem proteção CSRF', async () => {
    const gateway = repository(); const app = buildApp(env, { authRepository: new GatewayAuth(), gatewayRepository: gateway as unknown as PrismaGatewayRepository });
    const response = await app.inject({ method: 'DELETE', url: '/integrations/gateways/roas', headers: { cookie: `solid_session=${sessionToken}` } }); await app.close();
    expect(response.statusCode).toBe(403); expect(gateway.disconnect).not.toHaveBeenCalled();
  });
});


describe('conexão Meta', () => {
  const credentials = { pixelId: '123456789012345', accessToken: 'test-meta-token-with-enough-characters' };
  const metaEnv = { ...env, APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') };
  it.each([
    [400, { error: { code: 100 } }, 422, 'META_VALIDATION_FAILED'],
    [400, { error: { code: 190 } }, 422, 'META_TOKEN_INVALID'],
    [503, { error: { code: 2 } }, 503, 'META_UNAVAILABLE'],
  ])('não salva conexão rejeitada: %s %j', async (status, body, expectedStatus, code) => {
    const gateway = { ...repository(), save: vi.fn() };
    const app = buildApp(metaEnv, { authRepository: new GatewayAuth(), gatewayRepository: gateway as unknown as PrismaGatewayRepository });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
    try {
      const response = await app.inject({ method: 'PUT', url: '/integrations/meta', headers: authenticated, payload: { ...credentials, testEventCode: 'TEST12345' } });
      expect(response.statusCode).toBe(expectedStatus); expect(response.json<{ error: { code: string } }>().error.code).toBe(code);
      expect(gateway.save).not.toHaveBeenCalled(); expect(response.body).not.toContain(credentials.accessToken);
    } finally { vi.unstubAllGlobals(); await app.close(); }
  });
  it.each([false, true])('salva sem chamadas à Meta, servidor=%s', async serverEnabled => {
    const gateway = { ...repository(), save: vi.fn().mockResolvedValue({ active: true, verifiedAt: null }) };
    const app = buildApp(metaEnv, { authRepository: new GatewayAuth(), gatewayRepository: gateway as unknown as PrismaGatewayRepository });
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    try {
      const response = await app.inject({ method: 'PUT', url: '/integrations/meta', headers: authenticated, payload: { pixelId: credentials.pixelId, ...(serverEnabled && { accessToken: credentials.accessToken }), serverEnabled } });
      expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({ connected: true, serverEnabled, serverVerified: false });
      expect(fetcher).not.toHaveBeenCalled();
      expect(gateway.save).toHaveBeenCalledWith('store-a', 'META', serverEnabled ? expect.stringMatching(/^v1\./) : '', expect.stringMatching(/^v1\./), false);
    } finally { vi.unstubAllGlobals(); await app.close(); }
  });
  it.each([false, true])('preserva token somente para o mesmo Pixel: troca=%s', async changed => {
    const gateway = { ...repository(), credentials: vi.fn().mockResolvedValue({ apiKeyEncrypted: encryptSecret(credentials.accessToken, metaEnv.APP_ENCRYPTION_KEY), publicKeyEncrypted: encryptSecret(credentials.pixelId, metaEnv.APP_ENCRYPTION_KEY) }), save: vi.fn().mockResolvedValue({ active: true }) };
    const app = buildApp(metaEnv, { authRepository: new GatewayAuth(), gatewayRepository: gateway as unknown as PrismaGatewayRepository });
    try {
      const response = await app.inject({ method: 'PUT', url: '/integrations/meta', headers: authenticated, payload: { pixelId: changed ? '99999999999' : credentials.pixelId, serverEnabled: true, accessToken: '' } });
      expect(response.statusCode).toBe(changed ? 400 : 200);
      if (changed) expect(gateway.save).not.toHaveBeenCalled();
      else expect(decryptSecret(gateway.save.mock.calls[0]![2] as string, metaEnv.APP_ENCRYPTION_KEY)).toBe(credentials.accessToken);
      expect(response.body).not.toContain(credentials.accessToken);
    } finally { await app.close(); }
  });
  it('retorna o ID configurado sem expor o token nem afirmar valida��o externa', async () => {
    const gateway = { ...repository(), status: vi.fn().mockResolvedValue({ active: true, verifiedAt: null }), credentials: vi.fn().mockResolvedValue({ apiKeyEncrypted: encryptSecret(credentials.accessToken, metaEnv.APP_ENCRYPTION_KEY), publicKeyEncrypted: encryptSecret(credentials.pixelId, metaEnv.APP_ENCRYPTION_KEY) }) };
    const app = buildApp(metaEnv, { authRepository: new GatewayAuth(), gatewayRepository: gateway as unknown as PrismaGatewayRepository });
    try {
      const response = await app.inject({ method: 'GET', url: '/integrations/meta/status', headers: authenticated });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ connected: true, pixelId: credentials.pixelId, serverEnabled: true, serverVerified: false });
      expect(response.body).not.toContain(credentials.accessToken);
      expect(response.body).not.toContain('apiKeyEncrypted');
      expect(response.headers['cache-control']).toBe('private, no-store');
    } finally { await app.close(); }
  });
  it('salva credenciais criptografadas após confirmar o evento de teste', async () => {
    const gateway = { ...repository(), save: vi.fn().mockResolvedValue({ active: true }) };
    const app = buildApp(metaEnv, { authRepository: new GatewayAuth(), gatewayRepository: gateway as unknown as PrismaGatewayRepository });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ events_received: 1 })));
    vi.stubGlobal('fetch', fetcher);
    try {
      const response = await app.inject({ method: 'PUT', url: '/integrations/meta', headers: authenticated, payload: { ...credentials, testEventCode: 'TEST12345' } });
      expect(response.statusCode).toBe(200); expect(response.json<{ connected: boolean }>().connected).toBe(true);
      const sent = JSON.parse(fetcher.mock.calls[0]![1]?.body as string) as { test_event_code: string };
      expect(sent.test_event_code).toBe('TEST12345');
      expect(gateway.save).toHaveBeenCalledWith('store-a', 'META', expect.stringMatching(/^v1\./), expect.stringMatching(/^v1\./), true);
      expect(JSON.stringify(gateway.save.mock.calls)).not.toContain('TEST12345');
      expect(JSON.stringify(gateway.save.mock.calls)).not.toContain(credentials.accessToken);
    } finally { vi.unstubAllGlobals(); await app.close(); }
  });
});
