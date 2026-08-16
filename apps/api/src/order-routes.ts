import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository } from './auth-repository.js';
import type { OrderRepository } from './order-repository.js';
import { decryptSecret } from './shopify-crypto.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

function decryptPanelData(encrypted: string | null, encryptionKey: string, request: FastifyRequest, orderId: string, event: string): Record<string, unknown> {
  if (!encrypted) return {};
  try { return JSON.parse(decryptSecret(encrypted, encryptionKey)) as Record<string, unknown>; }
  catch (error) { request.log.error({ err: error, orderId }, event); return {}; }
}

function customerForPanel(encrypted: string | null, encryptionKey: string, request: FastifyRequest, orderId: string): { name?: string; email?: string } {
  const value = decryptPanelData(encrypted, encryptionKey, request, orderId, 'order_customer_decryption_failed');
  return { ...(typeof value.name === 'string' ? { name: value.name } : {}), ...(typeof value.email === 'string' ? { email: value.email } : {}) };
}

function addressForPanel(encrypted: string | null, encryptionKey: string, request: FastifyRequest, orderId: string): Record<string, string> {
  const value = decryptPanelData(encrypted, encryptionKey, request, orderId, 'order_address_decryption_failed');
  const keys = ['postalCode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'] as const;
  return Object.fromEntries(keys.flatMap(key => typeof value[key] === 'string' ? [[key, value[key] as string]] : []));
}

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
      const customer = customerForPanel(order.customerDataEncrypted, encryptionKey, request, order.publicId);
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

  app.get<{ Params: { orderId: string } }>('/orders/:orderId', async (request, reply) => {
    const token = request.cookies[sessionCookie]; const current = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
    if (!current) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const context = await orders.context(current.userId, current.sessionId);
    if (!context) return reply.code(409).send(errorBody(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Proteção de dados indisponível.'));
    const order = await orders.find(context.storeId, request.params.orderId);
    if (!order) return reply.code(404).send(errorBody(request, 'ORDER_NOT_FOUND', 'Pedido não encontrado.'));
    const attempt = order.paymentAttempts[0] ?? null;
    return reply.header('cache-control', 'private, no-store').send({ publicId: order.publicId, status: attempt?.status ?? 'PENDING', sessionStatus: order.status, paymentProvider: attempt?.provider ?? null, paymentPublicId: attempt?.publicId ?? null, totalCents: order.totalCents + order.shippingPriceCents, subtotalCents: order.totalCents, shippingPriceCents: order.shippingPriceCents, shippingMethodName: order.shippingMethodName, currency: order.currency, customer: customerForPanel(order.customerDataEncrypted, environment.APP_ENCRYPTION_KEY, request, order.publicId), shippingAddress: addressForPanel(order.shippingAddressEncrypted, environment.APP_ENCRYPTION_KEY, request, order.publicId), items: order.items, createdAt: order.createdAt, paidAt: attempt?.paidAt ?? order.completedAt, expiresAt: attempt?.expiresAt ?? null });
  });
}
