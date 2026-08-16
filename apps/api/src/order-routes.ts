import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository } from './auth-repository.js';
import type { OrderRepository } from './order-repository.js';
import { decryptSecret } from './shopify-crypto.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

export function registerOrderRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, orders: OrderRepository): void {
  const sessionCookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';

  app.get<{ Querystring: { page?: string; pageSize?: string } }>('/orders', async (request, reply) => {
    const token = request.cookies[sessionCookie];
    const current = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
    if (!current) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const context = await orders.context(current.userId, current.sessionId);
    if (!context) return reply.code(409).send(errorBody(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Proteção de dados indisponível.'));
    const encryptionKey = environment.APP_ENCRYPTION_KEY;

    const page = Number(request.query.page ?? '1');
    const pageSize = Number(request.query.pageSize ?? '20');
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Paginação inválida.'));
    }

    const result = await orders.list(context.storeId, page, pageSize);
    const items = result.items.map(order => {
      let customer: { name?: string; email?: string } = {};
      if (order.customerDataEncrypted) {
        try {
          const value = JSON.parse(decryptSecret(order.customerDataEncrypted, encryptionKey)) as Record<string, unknown>;
          customer = {
            ...(typeof value.name === 'string' ? { name: value.name } : {}),
            ...(typeof value.email === 'string' ? { email: value.email } : {})
          };
        } catch (error) {
          request.log.error({ err: error, orderId: order.publicId }, 'order_customer_decryption_failed');
        }
      }
      const attempt = order.paymentAttempts[0] ?? null;
      return {
        publicId: order.publicId,
        status: attempt?.status ?? 'PENDING',
        sessionStatus: order.status,
        paymentProvider: attempt?.provider ?? null,
        paymentPublicId: attempt?.publicId ?? null,
        totalCents: order.totalCents + order.shippingPriceCents,
        shippingPriceCents: order.shippingPriceCents,
        shippingMethodName: order.shippingMethodName,
        currency: order.currency,
        customer,
        items: order.items,
        createdAt: order.createdAt,
        paidAt: attempt?.paidAt ?? order.completedAt,
        expiresAt: attempt?.expiresAt ?? null
      };
    });
    return reply.header('cache-control', 'private, no-store').send({ items, total: result.total, page, pageSize, pages: Math.max(1, Math.ceil(result.total / pageSize)) });
  });
}
