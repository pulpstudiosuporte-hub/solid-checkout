import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import rawBody from 'fastify-raw-body';
import Fastify, { type FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import { createHash, randomUUID } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { ErrorResponse, HealthResponse } from '@solid/contracts';
import type { AuthRepository } from './auth-repository.js';
import { registerAuthRoutes } from './auth-routes.js';
import type { CatalogRepository } from './catalog-repository.js';
import { registerCatalogRoutes } from './catalog-routes.js';
import type { StoreRepository } from './store-repository.js';
import { registerStoreRoutes } from './store-routes.js';
import type { ShopifyRepository } from './shopify-repository.js';
import { registerShopifyRoutes } from './shopify-routes.js';
import { registerPublicCheckoutRoutes } from './public-checkout-routes.js';
import { registerGatewayRoutes } from './gateway-routes.js';
import type { PrismaGatewayRepository } from './gateway-repository.js';
import type { OrderRepository } from './order-repository.js';
import { registerOrderRoutes } from './order-routes.js';
import { registerMediaRoutes } from './media-routes.js';
import { HttpDokployDomainClient, type DokployDomainClient } from './dokploy-client.js';
import type { PrismaClient } from '@solid/database';
import { registerRegistrationRoutes } from './registration-routes.js';
import { registerDashboardRoutes } from './dashboard-routes.js';
import { registerAdminUserRoutes } from './admin-user-routes.js';
import { registerCouponRoutes } from './coupon-routes.js';
import { registerNotificationRoutes } from './notification-routes.js';
import { registerAdminOperationRoutes } from './admin-operation-routes.js';
import { registerBillingRoutes } from './billing-routes.js';
import { registerAbandonedCartRoutes } from './abandoned-cart-routes.js';
import { registerWebhookRoutes } from './webhook-routes.js';
import { registerProductFeedbackRoutes } from './product-feedback-routes.js';
import { registerAdminContentRoutes } from './admin-content-routes.js';
import { registerChromaSenseRoutes } from './chromasense-routes.js';
import { registerSettingsRoutes } from './settings-routes.js';

export function buildApp(environment: AppEnvironment, dependencies: { authRepository?: AuthRepository; catalogRepository?: CatalogRepository; storeRepository?: StoreRepository; shopifyRepository?: ShopifyRepository; gatewayRepository?: PrismaGatewayRepository; orderRepository?: OrderRepository; dokployClient?: DokployDomainClient; database?: PrismaClient } = {}): FastifyInstance {
  const checkoutOriginCache = new Map<string, { allowed: boolean; expiresAt: number }>();
  const app = Fastify({
    logger: environment.NODE_ENV === 'test' ? false : {
      level: environment.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie',
          'req.body.password', 'req.body.currentPassword', 'req.body.newPassword',
          'req.body.token', 'req.body.code', 'req.body.accessToken', 'req.body.apiKey',
          'req.body.publicKey', 'req.body.secretKey', 'req.body.cpf',
          'req.body.values.document', 'req.body.values.legalName',
          'req.body.values.birthDate', 'req.body.values.zipCode',
          'req.body.values.address', 'req.body.values.number',
          'req.body.values.complement', 'req.body.values.district',
          'req.body.values.city',
          '*.password', '*.token', '*.code', '*.accessToken', '*.apiKey', '*.publicKey',
          '*.secretKey', '*.cpf', '*.document', '*.documentNumber',
          '*.customerDataEncrypted', '*.shippingAddressEncrypted', 'err.details'
        ],
        censor: '[REDACTED]'
      }
    },
    trustProxy: environment.TRUST_PROXY,
    bodyLimit: 1_048_576,
    genReqId: () => randomUUID()
  });
  const rateLimitRedis = environment.REDIS_URL ? new Redis(environment.REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1, retryStrategy: (times: number) => times < 4 ? Math.min(times * 250, 1_000) : null }) : undefined;
  if (rateLimitRedis) {
    rateLimitRedis.on('error', (error: Error) => app.log.warn({ err: error }, 'rate_limit_redis_error'));
    app.addHook('onClose', () => { rateLimitRedis.disconnect(); });
  } else if (environment.NODE_ENV === 'production') {
    app.log.warn('REDIS_URL ausente: rate limiting opera apenas por réplica');
  }

  void app.register(helmet, { global: true, contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"], frameAncestors: ["'none'"] } }, hsts: environment.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false });
  void app.register(cors, { origin: (origin, callback) => {
    if (!origin || environment.CORS_ORIGINS.includes(origin)) return callback(null, true);
    let hostname = ''; try { const url = new URL(origin); if (url.protocol !== 'https:') return callback(null, false); hostname = url.hostname.toLowerCase(); } catch { return callback(null, false); }
    if (!dependencies.storeRepository?.isCheckoutDomainAllowed) return callback(null, false);
    const cached = checkoutOriginCache.get(hostname);
    if (cached && cached.expiresAt > Date.now()) return callback(null, cached.allowed);
    void dependencies.storeRepository.isCheckoutDomainAllowed(hostname).then(allowed => {
      if (checkoutOriginCache.size >= 1_000) checkoutOriginCache.delete(checkoutOriginCache.keys().next().value ?? '');
      checkoutOriginCache.set(hostname, { allowed, expiresAt: Date.now() + 60_000 });
      callback(null, allowed);
    }).catch(() => callback(null, false));
  }, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['authorization', 'content-type', 'x-csrf-token', 'x-request-id', 'x-solid-user-context'], maxAge: 600 });
  void app.register(rateLimit, { max: 100, timeWindow: '1 minute', ban: 3, ...(rateLimitRedis ? { redis: rateLimitRedis } : {}), errorResponseBuilder: (_request, context) => ({ error: { code: 'RATE_LIMITED', message: `Muitas requisições. Tente novamente em ${context.after}.`, requestId: _request.id } }) });
  if (dependencies.authRepository) {
    const repository = dependencies.authRepository;
    const sessionCookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';
    app.addHook('onRequest', async (request, reply) => {
      const expectedUser = request.headers['x-solid-user-context'];
      if (typeof expectedUser !== 'string') return;
      const rawCookie = request.headers.cookie || '';
      const encodedToken = rawCookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
      if (!encodedToken) return reply.code(409).send({ error: { code: 'SESSION_CONTEXT_CHANGED', message: 'A conta desta aba foi alterada em outra aba.', requestId: request.id } });
      const tokenHash = createHash('sha256').update(decodeURIComponent(encodedToken)).digest('hex');
      const session = await repository.findActiveSession(tokenHash, new Date());
      if (!session || session.user.publicId !== expectedUser) {
        return reply.code(409).send({ error: { code: 'SESSION_CONTEXT_CHANGED', message: 'A conta desta aba foi alterada em outra aba.', requestId: request.id } });
      }
    });
  }
  if (dependencies.authRepository) registerAuthRoutes(app, environment, dependencies.authRepository, dependencies.database);
  if (dependencies.database) registerRegistrationRoutes(app, environment, dependencies.database);
  if (dependencies.authRepository && dependencies.database) registerDashboardRoutes(app, environment, dependencies.authRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.database) registerAdminUserRoutes(app, environment, dependencies.authRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.database) registerAdminOperationRoutes(app, environment, dependencies.authRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.database) registerNotificationRoutes(app, environment, dependencies.authRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.database) {
    const authRepository = dependencies.authRepository;
    const database = dependencies.database;
    void app.register(async billingApp => {
      await billingApp.register(rawBody, { field: 'rawBody', global: false, encoding: false, runFirst: true });
      registerBillingRoutes(billingApp, environment, authRepository, database);
    });
  }
  const dokployClient = dependencies.dokployClient ?? (environment.DOKPLOY_URL && environment.DOKPLOY_API_KEY && environment.DOKPLOY_CHECKOUT_APPLICATION_ID ? new HttpDokployDomainClient(environment) : undefined);
  if (dependencies.authRepository && dependencies.storeRepository) registerStoreRoutes(app, environment, dependencies.authRepository, dependencies.storeRepository, dokployClient);
  if (dependencies.authRepository && dependencies.shopifyRepository) registerShopifyRoutes(app, environment, dependencies.authRepository, dependencies.shopifyRepository);
  if (dependencies.authRepository && dependencies.catalogRepository) registerCatalogRoutes(app, environment, dependencies.authRepository, dependencies.catalogRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.catalogRepository && dependencies.database) registerCouponRoutes(app, environment, dependencies.authRepository, dependencies.catalogRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.catalogRepository && dependencies.database) registerMediaRoutes(app, environment, dependencies.authRepository, dependencies.catalogRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.gatewayRepository) registerGatewayRoutes(app, environment, dependencies.authRepository, dependencies.gatewayRepository);
  if (dependencies.authRepository && dependencies.orderRepository) registerOrderRoutes(app, environment, dependencies.authRepository, dependencies.orderRepository);
  if (dependencies.authRepository && dependencies.database) registerAbandonedCartRoutes(app, environment, dependencies.authRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.database) registerWebhookRoutes(app, environment, dependencies.authRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.database) registerProductFeedbackRoutes(app, environment, dependencies.authRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.database) registerAdminContentRoutes(app, environment, dependencies.authRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.database) registerChromaSenseRoutes(app, environment, dependencies.authRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.database) registerSettingsRoutes(app, environment, dependencies.authRepository, dependencies.database);
  if (dependencies.catalogRepository) registerPublicCheckoutRoutes(app, environment, dependencies.catalogRepository, dependencies.gatewayRepository, dependencies.shopifyRepository, dependencies.database);

  app.get<{ Reply: HealthResponse }>('/health/live', () => ({ status: 'ok', service: 'solid-api', version: '0.1.0', timestamp: new Date().toISOString() }));
  app.get('/health/ready', async (_request, reply) => {
    const timestamp = new Date().toISOString();
    if (!dependencies.database) return reply.code(503).send({ status: 'error', service: 'solid-api', version: '0.1.0', timestamp, database: 'unavailable' });
    try {
      await Promise.race([dependencies.database.$queryRaw`SELECT 1`, new Promise((_, reject) => setTimeout(() => reject(new Error('database readiness timeout')), 2_000))]);
      return reply.send({ status: 'ok', service: 'solid-api', version: '0.1.0', timestamp, database: 'ok' });
    } catch (error) {
      app.log.warn({ err: error }, 'database_readiness_failed');
      return reply.code(503).send({ status: 'error', service: 'solid-api', version: '0.1.0', timestamp, database: 'unavailable' });
    }
  });

  app.setNotFoundHandler(async (request, reply) => {
    const body: ErrorResponse = { error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.', requestId: request.id } };
    await reply.code(404).send(body);
  });
  app.setErrorHandler(async (error, request, reply) => {
    const candidate = error as Error & { statusCode?: unknown };
    const errorStatusCode = candidate.statusCode;
    const statusCode = typeof errorStatusCode === 'number' && errorStatusCode >= 400 && errorStatusCode < 500
      ? errorStatusCode
      : 500;
    if (statusCode < 500) {
      request.log.warn({ err: error, requestId: request.id }, 'request_rejected');
      const codes: Record<number, string> = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        413: 'PAYLOAD_TOO_LARGE',
        415: 'UNSUPPORTED_MEDIA_TYPE',
        422: 'VALIDATION_ERROR',
        429: 'RATE_LIMITED',
      };
      const messages: Record<number, string> = {
        400: 'A requisição enviada é inválida.',
        401: 'Autenticação necessária.',
        403: 'Acesso negado.',
        404: 'Recurso não encontrado.',
        409: 'A solicitação conflita com o estado atual.',
        413: 'O conteúdo enviado excede o limite permitido.',
        415: 'Formato de conteúdo não suportado.',
        422: 'Revise os dados enviados.',
        429: 'Muitas requisições. Tente novamente mais tarde.',
      };
      return reply.code(statusCode).send({
        error: {
          code: codes[statusCode] ?? 'REQUEST_REJECTED',
          message: messages[statusCode] ?? 'Não foi possível aceitar a solicitação.',
          requestId: request.id,
        },
      });
    }
    request.log.error({ err: error, requestId: request.id }, 'request_failed');
    const body: ErrorResponse = { error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a solicitação.', requestId: request.id } };
    await reply.code(500).send(body);
  });
  return app;
}
