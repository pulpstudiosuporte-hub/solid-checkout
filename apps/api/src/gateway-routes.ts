import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository, SessionUser } from './auth-repository.js';
import type { PrismaGatewayRepository } from './gateway-repository.js';
import { encryptSecret } from './shopify-crypto.js';
import { testWestPay } from './westpay-client.js';
import { testRoas } from './roas-client.js';
import { testUtmifyToken } from './utmify-client.js';
import { validateMetaCredentials } from './meta-client.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const equal = (a: string, b: string) => { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

export function registerGatewayRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, repository: PrismaGatewayRepository): void {
  const secure = environment.NODE_ENV === 'production'; const sessionCookie = secure ? '__Host-solid_session' : 'solid_session'; const csrfCookie = secure ? '__Host-solid_csrf' : 'solid_csrf';
  const session = async (request: FastifyRequest): Promise<SessionUser | null> => { const token = request.cookies[sessionCookie]; return token ? auth.findActiveSession(sha256(token), new Date()) : null; };
  const csrfValid = (request: FastifyRequest, current: SessionUser) => { const origin = request.headers.origin; const cookie = request.cookies[csrfCookie]; const header = request.headers['x-csrf-token']; return typeof origin === 'string' && environment.CORS_ORIGINS.includes(origin) && Boolean(cookie) && typeof header === 'string' && equal(sha256(cookie!), sha256(header)) && equal(sha256(header), current.csrfTokenHash); };
  const mfaRequired = (request: FastifyRequest, reply: FastifyReply, current: SessionUser) => {
    if (current.user.mfaEnabled === false) return reply.code(403).send(errorBody(request, 'MFA_SETUP_REQUIRED', 'Ative o aplicativo autenticador em Configurações para administrar credenciais.'));
    if (current.user.mfaEnabled === true && !current.mfaVerifiedAt) return reply.code(403).send(errorBody(request, 'MFA_VERIFICATION_REQUIRED', 'Entre novamente e confirme o segundo fator.'));
    return null;
  };

  app.get('/integrations/westpay/status', async (request, reply) => {
    const current = await session(request); if (!current) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context) return reply.code(409).send(errorBody(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    const status = await repository.status(context.storeId); return reply.send({ connected: Boolean(status?.active && status.verifiedAt), ...status });
  });

  app.get('/integrations/roas/status', async (request, reply) => {
    const current = await session(request); if (!current) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context) return reply.code(409).send(errorBody(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    const status = await repository.status(context.storeId, 'ROAS'); return reply.send({ connected: Boolean(status?.active && status.verifiedAt), ...status });
  });

  app.get('/integrations/utmify/status', async (request, reply) => {
    const current = await session(request); if (!current) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context) return reply.code(409).send(errorBody(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    const status = await repository.status(context.storeId, 'UTMIFY'); return reply.send({ connected: Boolean(status?.active && status.verifiedAt), ...status });
  });
  app.get('/integrations/meta/status', async (request, reply) => {
    const current = await session(request); if (!current) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context) return reply.code(409).send(errorBody(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    const status = await repository.status(context.storeId, 'META'); return reply.send({ connected: Boolean(status?.active && status.verifiedAt), ...status });
  });

  app.get('/integrations/diagnostics', async (request, reply) => {
    const current = await session(request); if (!current) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context) return reply.code(409).send(errorBody(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    const data = await repository.diagnostics(context.storeId); const byProvider = new Map(data.connections.map(item => [item.provider, item]));
    const latestEvent = (provider: string) => data.events.find(item => item.targetId === provider || typeof item.metadata === 'object' && item.metadata !== null && (item.metadata as Record<string, unknown>).provider === provider);
    const tracker = (provider: 'UTMIFY' | 'META', name: string) => { const connection = byProvider.get(provider); const event = latestEvent(provider); return { provider, name, connected: Boolean(connection?.active && connection.verifiedAt), status: connection?.active && connection.verifiedAt ? event?.action === 'integration.event_failed' ? 'warning' : 'healthy' : 'disconnected', verifiedAt: connection?.verifiedAt ?? null, updatedAt: connection?.updatedAt ?? null, lastEvent: event ? { success: event.action !== 'integration.event_failed', event: typeof event.metadata === 'object' && event.metadata !== null ? (event.metadata as Record<string, unknown>).event ?? null : null, at: event.createdAt } : null }; };
    const gateway = (provider: 'ROAS' | 'WESTPAY', name: string) => { const connection = byProvider.get(provider); const event = latestEvent(provider); return { provider, name, connected: Boolean(connection?.active && connection.verifiedAt), status: connection?.active && connection.verifiedAt ? 'healthy' : 'disconnected', verifiedAt: connection?.verifiedAt ?? null, updatedAt: connection?.updatedAt ?? null, lastEvent: event ? { success: true, event: 'webhook', at: event.createdAt } : data.latestPayment?.provider === provider ? { success: ['PAID', 'PENDING'].includes(data.latestPayment.status), event: data.latestPayment.status, at: data.latestPayment.updatedAt } : null }; };
    const shopify = data.shopify; const shopifyConnected = Boolean(shopify && !shopify.revokedAt && !shopify.reconnectRequiredAt);
    return reply.send({ checkedAt: new Date(), integrations: [{ provider: 'SHOPIFY', name: 'Shopify', connected: shopifyConnected, status: shopify?.reconnectRequiredAt ? 'warning' : shopifyConnected ? 'healthy' : 'disconnected', verifiedAt: shopify?.updatedAt ?? null, updatedAt: shopify?.updatedAt ?? null, detail: shopify?.reconnectReason ?? shopify?.shopDomain ?? null, lastEvent: shopify?.lastSyncedAt ? { success: true, event: 'catalog_sync', at: shopify.lastSyncedAt } : null }, gateway('ROAS', 'Roas'), gateway('WESTPAY', 'WestPay'), tracker('UTMIFY', 'UTMify'), tracker('META', 'Meta Pixel')] });
  });

  app.put<{ Body: { apiKey?: unknown; publicKey?: unknown } }>('/integrations/westpay', { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const current = await session(request); if (!current || !csrfValid(request, current)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    if (mfaRequired(request, reply, current)) return;
    const context = await repository.context(current.userId, current.sessionId); if (!context || context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Somente proprietários e administradores podem conectar gateways.'));
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Criptografia indisponível.'));
    const apiKey = typeof request.body?.apiKey === 'string' ? request.body.apiKey.trim() : ''; const publicKey = typeof request.body?.publicKey === 'string' ? request.body.publicKey.trim() : '';
    if (!/^live_[A-Za-z0-9_-]{8,}$/.test(apiKey) || publicKey.length < 8 || publicKey.length > 512) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Confira a API Key live_ e a Public Key da WestPay.'));
    try { await testWestPay({ apiKey, publicKey }); } catch (error) { request.log.warn({ err: error }, 'westpay_credentials_rejected'); return reply.code(422).send(errorBody(request, 'WESTPAY_CREDENTIALS_REJECTED', 'A WestPay recusou essas credenciais. Confira as chaves.')); }
    const value = await repository.save(context.storeId, 'WESTPAY', encryptSecret(apiKey, environment.APP_ENCRYPTION_KEY), encryptSecret(publicKey, environment.APP_ENCRYPTION_KEY));
    return reply.send({ connected: true, ...value });
  });

  app.put<{ Body: { secretKey?: unknown; publicKey?: unknown } }>('/integrations/roas', { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const current = await session(request); if (!current || !csrfValid(request, current)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    if (mfaRequired(request, reply, current)) return;
    const context = await repository.context(current.userId, current.sessionId); if (!context || context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Somente proprietários e administradores podem conectar gateways.'));
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Criptografia indisponível.'));
    const secretKey = typeof request.body?.secretKey === 'string' ? request.body.secretKey.trim() : ''; const publicKey = typeof request.body?.publicKey === 'string' ? request.body.publicKey.trim() : '';
    if (secretKey.length < 8 || secretKey.length > 512 || publicKey.length < 8 || publicKey.length > 512) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Informe a Secret Key e a Public Key da Roas.'));
    try { await testRoas({ secretKey, publicKey }); } catch (error) { request.log.warn({ err: error }, 'roas_credentials_rejected'); return reply.code(422).send(errorBody(request, 'ROAS_CREDENTIALS_REJECTED', 'A Roas recusou essas credenciais. Confira as chaves.')); }
    const value = await repository.save(context.storeId, 'ROAS', encryptSecret(secretKey, environment.APP_ENCRYPTION_KEY), encryptSecret(publicKey, environment.APP_ENCRYPTION_KEY));
    return reply.send({ connected: true, primary: true, ...value });
  });

  app.put<{ Body: { token?: unknown } }>('/integrations/utmify', { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const current = await session(request); if (!current || !csrfValid(request, current)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context || context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Somente proprietários e administradores podem conectar rastreadores.'));
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Criptografia indisponível.'));
    const token = typeof request.body?.token === 'string' ? request.body.token.trim() : '';
    if (token.length < 10 || token.length > 512 || /\s/.test(token)) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Informe uma credencial de API válida da UTMify.'));
    try { await testUtmifyToken(token); } catch (error) { request.log.warn({ err: error }, 'utmify_credentials_rejected'); return reply.code(422).send(errorBody(request, 'UTMIFY_CREDENTIALS_REJECTED', 'A UTMify recusou essa credencial. Confira o token de API.')); }
    const value = await repository.save(context.storeId, 'UTMIFY', encryptSecret(token, environment.APP_ENCRYPTION_KEY), encryptSecret('utmify', environment.APP_ENCRYPTION_KEY));
    return reply.send({ connected: true, ...value });
  });

  app.delete('/integrations/utmify', async (request, reply) => {
    const current = await session(request); if (!current || !csrfValid(request, current)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context || context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    await repository.disconnect(context.storeId, 'UTMIFY'); return reply.code(204).send();
  });
  app.put<{ Body: { pixelId?: unknown; accessToken?: unknown } }>('/integrations/meta', { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const current = await session(request); if (!current || !csrfValid(request, current)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context || context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Somente proprietários e administradores podem conectar rastreadores.'));
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Criptografia indisponível.'));
    const pixelId = typeof request.body?.pixelId === 'string' ? request.body.pixelId.trim() : ''; const accessToken = typeof request.body?.accessToken === 'string' ? request.body.accessToken.trim() : '';
    if (!/^\d{5,32}$/.test(pixelId) || accessToken.length < 20 || accessToken.length > 2048 || /\s/.test(accessToken)) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Confira o ID do Pixel e o token da API de Conversões.'));
    try { await validateMetaCredentials(pixelId, accessToken); } catch (error) { request.log.warn({ err: error }, 'meta_credentials_rejected'); return reply.code(422).send(errorBody(request, 'META_CREDENTIALS_REJECTED', 'A Meta recusou essas credenciais. Confira o Pixel e o token.')); }
    const value = await repository.save(context.storeId, 'META', encryptSecret(accessToken, environment.APP_ENCRYPTION_KEY), encryptSecret(pixelId, environment.APP_ENCRYPTION_KEY)); return reply.send({ connected: true, ...value });
  });
  app.delete('/integrations/meta', async (request, reply) => {
    const current = await session(request); if (!current || !csrfValid(request, current)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context || context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    await repository.disconnect(context.storeId, 'META'); return reply.code(204).send();
  });
}
