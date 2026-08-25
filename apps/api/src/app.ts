import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
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

export function buildApp(environment: AppEnvironment, dependencies: { authRepository?: AuthRepository; catalogRepository?: CatalogRepository; storeRepository?: StoreRepository; shopifyRepository?: ShopifyRepository; gatewayRepository?: PrismaGatewayRepository; orderRepository?: OrderRepository; dokployClient?: DokployDomainClient; database?: PrismaClient } = {}): FastifyInstance {
  const app = Fastify({
    logger: environment.NODE_ENV === 'test' ? false : { level: environment.LOG_LEVEL, redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie', '*.password', '*.token', '*.cpf'], censor: '[REDACTED]' } },
    trustProxy: environment.TRUST_PROXY,
    bodyLimit: 1_048_576,
    requestIdHeader: 'x-request-id',
    genReqId: request => request.headers['x-request-id']?.toString().slice(0, 128) ?? crypto.randomUUID()
  });

  void app.register(helmet, { global: true, contentSecurityPolicy: false, hsts: environment.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false });
  void app.register(cors, { origin: (origin, callback) => {
    if (!origin || environment.CORS_ORIGINS.includes(origin)) return callback(null, true);
    let hostname = ''; try { const url = new URL(origin); if (url.protocol !== 'https:') return callback(null, false); hostname = url.hostname.toLowerCase(); } catch { return callback(null, false); }
    if (!dependencies.storeRepository?.isCheckoutDomainAllowed) return callback(null, false);
    void dependencies.storeRepository.isCheckoutDomainAllowed(hostname).then(allowed => callback(null, allowed)).catch(() => callback(null, false));
  }, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['authorization', 'content-type', 'x-csrf-token', 'x-request-id'], maxAge: 600 });
  void app.register(rateLimit, { max: 100, timeWindow: '1 minute', ban: 3, errorResponseBuilder: (_request, context) => ({ error: { code: 'RATE_LIMITED', message: `Muitas requisições. Tente novamente em ${context.after}.`, requestId: _request.id } }) });
  if (dependencies.authRepository) registerAuthRoutes(app, environment, dependencies.authRepository);
  if (dependencies.database) registerRegistrationRoutes(app, environment, dependencies.database);
  if (dependencies.authRepository && dependencies.database) registerDashboardRoutes(app, environment, dependencies.authRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.database) registerAdminUserRoutes(app, environment, dependencies.authRepository, dependencies.database);
  const dokployClient = dependencies.dokployClient ?? (environment.DOKPLOY_URL && environment.DOKPLOY_API_KEY && environment.DOKPLOY_CHECKOUT_APPLICATION_ID ? new HttpDokployDomainClient(environment) : undefined);
  if (dependencies.authRepository && dependencies.storeRepository) registerStoreRoutes(app, environment, dependencies.authRepository, dependencies.storeRepository, dokployClient);
  if (dependencies.authRepository && dependencies.shopifyRepository) registerShopifyRoutes(app, environment, dependencies.authRepository, dependencies.shopifyRepository);
  if (dependencies.authRepository && dependencies.catalogRepository) registerCatalogRoutes(app, environment, dependencies.authRepository, dependencies.catalogRepository);
  if (dependencies.authRepository && dependencies.catalogRepository && dependencies.database) registerMediaRoutes(app, environment, dependencies.authRepository, dependencies.catalogRepository, dependencies.database);
  if (dependencies.authRepository && dependencies.gatewayRepository) registerGatewayRoutes(app, environment, dependencies.authRepository, dependencies.gatewayRepository);
  if (dependencies.authRepository && dependencies.orderRepository) registerOrderRoutes(app, environment, dependencies.authRepository, dependencies.orderRepository);
  if (dependencies.catalogRepository) registerPublicCheckoutRoutes(app, environment, dependencies.catalogRepository, dependencies.gatewayRepository, dependencies.shopifyRepository);

  app.get<{ Reply: HealthResponse }>('/health/live', () => ({ status: 'ok', service: 'solid-api', version: '0.1.0', timestamp: new Date().toISOString() }));
  app.get<{ Reply: HealthResponse }>('/health/ready', () => ({ status: 'ok', service: 'solid-api', version: '0.1.0', timestamp: new Date().toISOString() }));

  app.setNotFoundHandler(async (request, reply) => {
    const body: ErrorResponse = { error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.', requestId: request.id } };
    await reply.code(404).send(body);
  });
  app.setErrorHandler(async (error, request, reply) => {
    request.log.error({ err: error, requestId: request.id }, 'request_failed');
    const body: ErrorResponse = { error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a solicitação.', requestId: request.id } };
    await reply.code(500).send(body);
  });
  return app;
}
