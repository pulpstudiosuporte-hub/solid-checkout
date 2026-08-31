import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import { buildApp } from '../src/app.js';
import type { AuthRepository, LoginUser, SessionUser } from '../src/auth-repository.js';
import type { PrismaGatewayRepository } from '../src/gateway-repository.js';

const origin = 'http://localhost:5173'; const sessionToken = 'gateway-session'; const csrfToken = 'gateway-csrf';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const env: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: [origin], TRUST_PROXY: false };

class GatewayAuth implements AuthRepository {
  findUserByEmail(): Promise<LoginUser | null> { return Promise.resolve(null); }
  createSession(): Promise<void> { return Promise.resolve(); }
  findActiveSession(tokenHash: string): Promise<SessionUser | null> { return Promise.resolve(tokenHash === hash(sessionToken) ? { sessionId: 'session-a', userId: 'user-a', csrfTokenHash: hash(csrfToken), expiresAt: new Date(Date.now() + 60_000), absoluteExpiresAt: new Date(Date.now() + 60_000), user: { publicId: 'user-a', name: 'Owner', email: 'owner@example.com' } } : null); }
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
