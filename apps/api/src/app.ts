import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { ErrorResponse, HealthResponse } from '@solid/contracts';
import type { AuthRepository } from './auth-repository.js';
import { registerAuthRoutes } from './auth-routes.js';

export function buildApp(environment: AppEnvironment, dependencies: { authRepository?: AuthRepository } = {}): FastifyInstance {
  const app = Fastify({
    logger: environment.NODE_ENV === 'test' ? false : { level: environment.LOG_LEVEL, redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie', '*.password', '*.token', '*.cpf'], censor: '[REDACTED]' } },
    trustProxy: environment.TRUST_PROXY,
    bodyLimit: 1_048_576,
    requestIdHeader: 'x-request-id',
    genReqId: request => request.headers['x-request-id']?.toString().slice(0, 128) ?? crypto.randomUUID()
  });

  void app.register(helmet, { global: true, contentSecurityPolicy: false, hsts: environment.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false });
  void app.register(cors, { origin: environment.CORS_ORIGINS, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['content-type', 'x-csrf-token', 'x-request-id'], maxAge: 600 });
  void app.register(rateLimit, { max: 100, timeWindow: '1 minute', ban: 3, errorResponseBuilder: (_request, context) => ({ error: { code: 'RATE_LIMITED', message: `Muitas requisições. Tente novamente em ${context.after}.`, requestId: _request.id } }) });
  if (dependencies.authRepository) registerAuthRoutes(app, environment, dependencies.authRepository);

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
