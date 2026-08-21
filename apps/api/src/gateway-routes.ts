import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository, SessionUser } from './auth-repository.js';
import type { PrismaGatewayRepository } from './gateway-repository.js';
import { encryptSecret } from './shopify-crypto.js';
import { testWestPay } from './westpay-client.js';
import { testRoas } from './roas-client.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const equal = (a: string, b: string) => { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

export function registerGatewayRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, repository: PrismaGatewayRepository): void {
  const secure = environment.NODE_ENV === 'production'; const sessionCookie = secure ? '__Host-solid_session' : 'solid_session'; const csrfCookie = secure ? '__Host-solid_csrf' : 'solid_csrf';
  const session = async (request: FastifyRequest): Promise<SessionUser | null> => { const token = request.cookies[sessionCookie]; return token ? auth.findActiveSession(sha256(token), new Date()) : null; };
  const csrfValid = (request: FastifyRequest, current: SessionUser) => { const origin = request.headers.origin; const cookie = request.cookies[csrfCookie]; const header = request.headers['x-csrf-token']; return typeof origin === 'string' && environment.CORS_ORIGINS.includes(origin) && Boolean(cookie) && typeof header === 'string' && equal(sha256(cookie!), sha256(header)) && equal(sha256(header), current.csrfTokenHash); };

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

  app.put<{ Body: { apiKey?: unknown; publicKey?: unknown } }>('/integrations/westpay', { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const current = await session(request); if (!current || !csrfValid(request, current)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
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
    const context = await repository.context(current.userId, current.sessionId); if (!context || context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Somente proprietários e administradores podem conectar gateways.'));
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Criptografia indisponível.'));
    const secretKey = typeof request.body?.secretKey === 'string' ? request.body.secretKey.trim() : ''; const publicKey = typeof request.body?.publicKey === 'string' ? request.body.publicKey.trim() : '';
    if (secretKey.length < 8 || secretKey.length > 512 || publicKey.length < 8 || publicKey.length > 512) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Informe a Secret Key e a Public Key da Roas.'));
    try { await testRoas({ secretKey, publicKey }); } catch (error) { request.log.warn({ err: error }, 'roas_credentials_rejected'); return reply.code(422).send(errorBody(request, 'ROAS_CREDENTIALS_REJECTED', 'A Roas recusou essas credenciais. Confira as chaves.')); }
    const value = await repository.save(context.storeId, 'ROAS', encryptSecret(secretKey, environment.APP_ENCRYPTION_KEY), encryptSecret(publicKey, environment.APP_ENCRYPTION_KEY));
    return reply.send({ connected: true, primary: true, ...value });
  });
}
