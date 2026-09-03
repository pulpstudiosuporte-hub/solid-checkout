import { createHash, createHmac } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository } from './auth-repository.js';
import type { OrderListFilters, OrderRepository } from './order-repository.js';
import { decryptSecret } from './shopify-crypto.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const preferredAttempt = <T extends { status: string }>(attempts: readonly T[]): T | null => attempts.find(attempt => attempt.status === 'PAID') ?? attempts[0] ?? null;
const countryFromTracking = (value: unknown): string => typeof value === 'object' && value && !Array.isArray(value) && typeof (value as Record<string, unknown>).geo_country === 'string' ? String((value as Record<string, unknown>).geo_country).toUpperCase() : '—';

function decryptPanelData(encrypted: string | null, encryptionKey: string, request: FastifyRequest, orderId: string, event: string): Record<string, unknown> {
  if (!encrypted) return {};
  try { return JSON.parse(decryptSecret(encrypted, encryptionKey)) as Record<string, unknown>; }
  catch (error) { request.log.error({ err: error, orderId }, event); return {}; }
}

function customerForPanel(encrypted: string | null, encryptionKey: string, request: FastifyRequest, orderId: string): { name?: string; email?: string; phone?: string } {
  const value = decryptPanelData(encrypted, encryptionKey, request, orderId, 'order_customer_decryption_failed');
  return { ...(typeof value.name === 'string' ? { name: value.name } : {}), ...(typeof value.email === 'string' ? { email: value.email } : {}), ...(typeof value.phone === 'string' ? { phone: value.phone } : {}) };
}

function addressForPanel(encrypted: string | null, encryptionKey: string, request: FastifyRequest, orderId: string): Record<string, string> {
  const value = decryptPanelData(encrypted, encryptionKey, request, orderId, 'order_address_decryption_failed');
  const keys = ['postalCode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'] as const;
  return Object.fromEntries(keys.flatMap(key => { const field = value[key]; return typeof field === 'string' ? [[key, field]] : []; }));
}

export function registerOrderRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, orders: OrderRepository): void {
  const sessionCookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';

  app.get<{ Querystring: { page?: string; pageSize?: string; search?: string; status?: string; from?: string; to?: string; sort?: string } }>('/orders', async (request, reply) => {
    const token = request.cookies[sessionCookie];
    const current = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
    if (!current) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const context = await orders.context(current.userId, current.sessionId);
    if (!context) return reply.code(409).send(errorBody(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Proteção de dados indisponível.'));
    const encryptionKey = environment.APP_ENCRYPTION_KEY;

    const page = Number(request.query.page ?? '1');
    const pageSize = Number(request.query.pageSize ?? '20');
    const statuses = new Set(['PAID', 'PENDING', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED']);
    const sorts = new Set(['newest', 'oldest', 'highest', 'lowest']);
    const status = request.query.status?.toUpperCase(); const sort = request.query.sort || 'newest';
    const from = request.query.from ? new Date(`${request.query.from}T00:00:00.000-03:00`) : undefined;
    const to = request.query.to ? new Date(`${request.query.to}T23:59:59.999-03:00`) : undefined;
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || (request.query.search?.length ?? 0) > 120 || (status && !statuses.has(status)) || !sorts.has(sort) || (from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Paginação inválida.'));
    }

    const normalizedSearch = request.query.search?.trim();
    const emailHash = normalizedSearch?.includes('@') ? createHmac('sha256', createHmac('sha256', Buffer.from(environment.APP_ENCRYPTION_KEY, 'base64')).update('solid-checkout-pii-index-v1').digest()).update(normalizedSearch.toLowerCase()).digest('hex') : undefined;
    const filters: OrderListFilters = { ...(normalizedSearch ? { search: normalizedSearch } : {}), ...(emailHash ? { emailHash } : {}), ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), sort: sort as NonNullable<OrderListFilters['sort']> };
    const result = await orders.list(context.storeId, page, pageSize, filters);
    const items = result.items.map(order => {
      const customer = customerForPanel(order.customerDataEncrypted, encryptionKey, request, order.publicId);
      const attempt = preferredAttempt(order.paymentAttempts);
      return {
        publicId: order.publicId,
        status: attempt?.status ?? 'PENDING',
        sessionStatus: order.status,
        paymentProvider: attempt?.provider ?? null,
        paymentPublicId: attempt?.publicId ?? null,
        totalCents: order.totalCents - (order.discountCents ?? 0) + order.shippingPriceCents,
        discountCents: order.discountCents ?? 0,
        couponCode: order.couponCode,
        shippingPriceCents: order.shippingPriceCents,
        shippingMethodName: order.shippingMethodName,
        currency: order.currency,
        customer,
        country: countryFromTracking(order.trackingParameters),
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
    const attempt = preferredAttempt(order.paymentAttempts);
    let pixCode: string | null = null;
    if (attempt?.status === 'PENDING' && attempt.pixCodeEncrypted) {
      try { pixCode = decryptSecret(attempt.pixCodeEncrypted, environment.APP_ENCRYPTION_KEY); }
      catch (error) { request.log.error({ err: error, orderId: order.publicId }, 'order_pix_decryption_failed'); }
    }
    return reply.header('cache-control', 'private, no-store').send({ publicId: order.publicId, status: attempt?.status ?? 'PENDING', sessionStatus: order.status, paymentProvider: attempt?.provider ?? null, paymentPublicId: attempt?.publicId ?? null, pixCode, totalCents: order.totalCents - (order.discountCents ?? 0) + order.shippingPriceCents, subtotalCents: order.totalCents, discountCents: order.discountCents ?? 0, couponCode: order.couponCode ?? null, shippingPriceCents: order.shippingPriceCents, shippingMethodName: order.shippingMethodName, currency: order.currency, customer: customerForPanel(order.customerDataEncrypted, environment.APP_ENCRYPTION_KEY, request, order.publicId), shippingAddress: addressForPanel(order.shippingAddressEncrypted, environment.APP_ENCRYPTION_KEY, request, order.publicId), items: order.items, createdAt: order.createdAt, paidAt: attempt?.paidAt ?? order.completedAt, expiresAt: attempt?.expiresAt ?? null });
  });
}
