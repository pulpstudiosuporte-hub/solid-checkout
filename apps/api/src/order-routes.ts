import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository } from './auth-repository.js';
import type { OrderListFilters, OrderRecord, OrderRepository } from './order-repository.js';
import { decryptSecret } from './shopify-crypto.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const preferredAttempt = <T extends { status: string }>(attempts: readonly T[]): T | null => attempts.find(attempt => attempt.status === 'PAID') ?? attempts[0] ?? null;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const asString = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const pickString = (value: Record<string, unknown>, keys: readonly string[]): string | undefined => keys.map(key => asString(value[key])).find(Boolean);

type FulfillmentStatus = 'AWAITING_PAYMENT' | 'PAYMENT_APPROVED' | 'PREPARING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
type StatusEvent = Readonly<{ status: FulfillmentStatus; note?: string; at: string }>;
type OrderManagement = Readonly<{
  fulfillmentStatus?: FulfillmentStatus;
  trackingCarrier?: string;
  trackingCode?: string;
  trackingUrl?: string;
  trackingNote?: string;
  statusEvents?: readonly StatusEvent[];
  visitorBlocked?: boolean;
  visitorBlockedAt?: string;
}>;

const fulfillmentStatuses = new Set<FulfillmentStatus>(['AWAITING_PAYMENT', 'PAYMENT_APPROVED', 'PREPARING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']);

function trackingRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function orderManagement(value: unknown): OrderManagement {
  const root = trackingRecord(value);
  const raw = isRecord(root._orderManagement) ? root._orderManagement : {};
  const rawEvents = Array.isArray(raw.statusEvents) ? raw.statusEvents : [];
  const events = rawEvents.flatMap(event => {
    if (!isRecord(event) || !fulfillmentStatuses.has(event.status as FulfillmentStatus) || !asString(event.at)) return [];
    const note = asString(event.note);
    return [{ status: event.status as FulfillmentStatus, ...(note ? { note } : {}), at: String(event.at) }];
  });
  const trackingCarrier = asString(raw.trackingCarrier);
  const trackingCode = asString(raw.trackingCode);
  const trackingUrl = asString(raw.trackingUrl);
  const trackingNote = asString(raw.trackingNote);
  const visitorBlockedAt = asString(raw.visitorBlockedAt);
  return {
    ...(fulfillmentStatuses.has(raw.fulfillmentStatus as FulfillmentStatus) ? { fulfillmentStatus: raw.fulfillmentStatus as FulfillmentStatus } : {}),
    ...(trackingCarrier ? { trackingCarrier } : {}),
    ...(trackingCode ? { trackingCode } : {}),
    ...(trackingUrl ? { trackingUrl } : {}),
    ...(trackingNote ? { trackingNote } : {}),
    ...(events.length ? { statusEvents: events } : {}),
    ...(typeof raw.visitorBlocked === 'boolean' ? { visitorBlocked: raw.visitorBlocked } : {}),
    ...(visitorBlockedAt ? { visitorBlockedAt } : {})
  };
}

function decryptPanelData(encrypted: string | null, encryptionKey: string, request: FastifyRequest, orderId: string, event: string): Record<string, unknown> {
  if (!encrypted) return {};
  try { return JSON.parse(decryptSecret(encrypted, encryptionKey)) as Record<string, unknown>; }
  catch (error) { request.log.error({ err: error, orderId }, event); return {}; }
}

function maskedDocument(value: string): string {
  const document = value.replace(/\D/g, '');
  if (document.length < 5) return '***';
  return `${'*'.repeat(Math.max(0, document.length - 4))}${document.slice(-4)}`;
}

function customerForPanel(encrypted: string | null, encryptionKey: string, request: FastifyRequest, orderId: string): { name?: string; email?: string; phone?: string; documentMasked?: string } {
  const value = decryptPanelData(encrypted, encryptionKey, request, orderId, 'order_customer_decryption_failed');
  const name = asString(value.name);
  const email = asString(value.email);
  const phone = asString(value.phone);
  const document = pickString(value, ['document', 'cpf', 'cnpj']);
  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(document ? { documentMasked: maskedDocument(document) } : {})
  };
}

function addressForPanel(encrypted: string | null, encryptionKey: string, request: FastifyRequest, orderId: string): Record<string, string> {
  const value = decryptPanelData(encrypted, encryptionKey, request, orderId, 'order_address_decryption_failed');
  const keys = ['postalCode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'country'] as const;
  return Object.fromEntries(keys.flatMap(key => asString(value[key]) ? [[key, String(value[key])]] : []));
}

function countryFromTracking(value: unknown): string {
  const tracking = trackingRecord(value);
  return (pickString(tracking, ['geo_country', 'country', 'cf_country']) ?? 'BR').toUpperCase();
}

function maskedIp(value: string | undefined): string | null {
  if (!value) return null;
  if (value.includes(':')) return `${value.split(':').slice(0, 3).join(':')}:…`;
  const parts = value.split('.');
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.***` : null;
}

function browserFromUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  const candidates: readonly [RegExp, string][] = [[/Edg\/(\S+)/, 'Edge'], [/OPR\/(\S+)/, 'Opera'], [/Chrome\/(\S+)/, 'Chrome'], [/Firefox\/(\S+)/, 'Firefox'], [/Version\/(\S+).*Safari/, 'Safari']];
  for (const [pattern, name] of candidates) { const match = userAgent.match(pattern); if (match) return `${name} ${match[1]}`; }
  return userAgent.slice(0, 100);
}

function initialFulfillment(order: OrderRecord): FulfillmentStatus {
  const payment = preferredAttempt(order.paymentAttempts);
  if (payment?.status === 'PAID') return 'PAYMENT_APPROVED';
  if (order.status === 'CANCELLED' || order.status === 'EXPIRED') return 'CANCELLED';
  return 'AWAITING_PAYMENT';
}

function statusEvents(order: OrderRecord, management: OrderManagement): readonly StatusEvent[] {
  if (management.statusEvents?.length) return management.statusEvents;
  const events: StatusEvent[] = [{ status: 'AWAITING_PAYMENT', note: `Criado via ${preferredAttempt(order.paymentAttempts)?.provider ?? order.source ?? 'checkout'}`, at: order.createdAt.toISOString() }];
  const paid = preferredAttempt(order.paymentAttempts)?.paidAt ?? order.completedAt;
  if (paid) events.push({ status: 'PAYMENT_APPROVED', note: 'Pagamento confirmado', at: paid.toISOString() });
  return events;
}

function pixCodeForPanel(encrypted: string | null, encryptionKey: string, request: FastifyRequest, orderId: string): string | null {
  if (!encrypted) return null;
  try { return decryptSecret(encrypted, encryptionKey); }
  catch (error) { request.log.error({ err: error, orderId }, 'order_pix_decryption_failed'); return null; }
}

function serializeDetail(order: OrderRecord, encryptionKey: string, request: FastifyRequest, canManage: boolean, history: readonly { publicId: string; status: string; totalCents: number; discountCents: number; shippingPriceCents: number; createdAt: Date; completedAt: Date | null }[]) {
  const customer = customerForPanel(order.customerDataEncrypted, encryptionKey, request, order.publicId);
  const address = addressForPanel(order.shippingAddressEncrypted, encryptionKey, request, order.publicId);
  const attempt = preferredAttempt(order.paymentAttempts);
  const tracking = trackingRecord(order.trackingParameters);
  const management = orderManagement(order.trackingParameters);
  const rawIp = pickString(tracking, ['ip', 'clientIp', 'client_ip', 'cf_connecting_ip', 'visitor_ip']);
  const userAgent = pickString(tracking, ['userAgent', 'user_agent', 'ua']);
  const totalCents = order.totalCents - (order.discountCents ?? 0) + order.shippingPriceCents;
  return {
    publicId: order.publicId,
    status: attempt?.status ?? 'PENDING',
    sessionStatus: order.status,
    paymentProvider: attempt?.provider ?? null,
    paymentPublicId: attempt?.publicId ?? null,
    pixCode: pixCodeForPanel(attempt?.pixCodeEncrypted ?? null, encryptionKey, request, order.publicId),
    subtotalCents: order.totalCents,
    totalCents,
    discountCents: order.discountCents ?? 0,
    couponCode: order.couponCode,
    shippingPriceCents: order.shippingPriceCents,
    shippingMethodName: order.shippingMethodName,
    shippingMinDays: order.shippingMinDays,
    shippingMaxDays: order.shippingMaxDays,
    currency: order.currency,
    customer,
    shippingAddress: address,
    items: order.items,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt ?? order.createdAt,
    paidAt: attempt?.paidAt ?? order.completedAt,
    expiresAt: attempt?.expiresAt ?? null,
    source: order.source,
    sourceCartId: order.sourceCartId,
    shopify: { orderId: order.shopifyOrderId, orderName: order.shopifyOrderName, syncStatus: order.shopifySyncStatus, syncError: order.shopifySyncError },
    checkout: order.checkout ? { publicId: order.checkout.publicId, name: order.checkout.name, slug: order.checkout.slug, mode: order.checkout.mode } : null,
    store: order.checkout?.store ?? null,
    fulfillment: {
      status: management.fulfillmentStatus ?? initialFulfillment(order),
      carrier: management.trackingCarrier ?? null,
      code: management.trackingCode ?? null,
      url: management.trackingUrl ?? null,
      note: management.trackingNote ?? null,
      events: statusEvents(order, management)
    },
    visitor: {
      ip: maskedIp(rawIp),
      browser: browserFromUserAgent(userAgent),
      city: pickString(tracking, ['geo_city', 'city']) ?? address.city ?? null,
      state: pickString(tracking, ['geo_region', 'region', 'state']) ?? address.state ?? null,
      country: countryFromTracking(tracking),
      blocked: management.visitorBlocked ?? false,
      blockedAt: management.visitorBlockedAt ?? null
    },
    utm: {
      url: pickString(tracking, ['url', 'page_url', 'landingPage', 'landing_page']),
      referrer: pickString(tracking, ['referrer', 'referer']),
      source: pickString(tracking, ['utm_source', 'source']),
      medium: pickString(tracking, ['utm_medium', 'medium']),
      campaign: pickString(tracking, ['utm_campaign', 'campaign']),
      content: pickString(tracking, ['utm_content', 'content']),
      term: pickString(tracking, ['utm_term', 'term']),
      src: pickString(tracking, ['src']),
      sck: pickString(tracking, ['sck'])
    },
    paymentAttempts: order.paymentAttempts.map(payment => ({
      publicId: payment.publicId, provider: payment.provider, providerTransactionId: payment.providerTransactionId,
      amountCents: payment.amountCents ?? order.totalCents, status: payment.status, createdAt: payment.createdAt, updatedAt: payment.updatedAt ?? payment.createdAt,
      paidAt: payment.paidAt, expiresAt: payment.expiresAt
    })),
    integrationJobs: order.deliveryJobs ?? [],
    customerHistory: history.map(item => ({ ...item, totalCents: item.totalCents - item.discountCents + item.shippingPriceCents })),
    canManage
  };
}

export function registerOrderRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, orders: OrderRepository): void {
  const sessionCookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = environment.NODE_ENV === 'production' ? '__Host-solid_csrf' : 'solid_csrf';

  async function contextFor(request: FastifyRequest, mutation = false) {
    const token = request.cookies[sessionCookie];
    const current = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
    if (!current) return null;
    const context = await orders.context(current.userId, current.sessionId);
    if (!context) return null;
    if (mutation) {
      const origin = request.headers.origin;
      const cookie = request.cookies[csrfCookie];
      const header = request.headers['x-csrf-token'];
      if (typeof origin !== 'string' || !environment.CORS_ORIGINS.includes(origin) || !cookie || typeof header !== 'string' || !safeEqual(cookie, header) || !safeEqual(sha256(header), current.csrfTokenHash)) return null;
    }
    return context;
  }

  app.get<{ Querystring: { page?: string; pageSize?: string; search?: string; status?: string; from?: string; to?: string; sort?: string } }>('/orders', async (request, reply) => {
    const context = await contextFor(request);
    if (!context) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Proteção de dados indisponível.'));
    const page = Number(request.query.page ?? '1');
    const pageSize = Number(request.query.pageSize ?? '20');
    const statuses = new Set(['PAID', 'PENDING', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED']);
    const sorts = new Set(['newest', 'oldest', 'highest', 'lowest']);
    const status = request.query.status?.toUpperCase(); const sort = request.query.sort || 'newest';
    const from = request.query.from ? new Date(`${request.query.from}T00:00:00.000-03:00`) : undefined;
    const to = request.query.to ? new Date(`${request.query.to}T23:59:59.999-03:00`) : undefined;
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || (request.query.search?.length ?? 0) > 120 || (status && !statuses.has(status)) || !sorts.has(sort) || (from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Paginação inválida.'));
    const normalizedSearch = request.query.search?.trim();
    const emailHash = normalizedSearch?.includes('@') ? createHmac('sha256', createHmac('sha256', Buffer.from(environment.APP_ENCRYPTION_KEY, 'base64')).update('solid-checkout-pii-index-v1').digest()).update(normalizedSearch.toLowerCase()).digest('hex') : undefined;
    const filters: OrderListFilters = { ...(normalizedSearch ? { search: normalizedSearch } : {}), ...(emailHash ? { emailHash } : {}), ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), sort: sort as NonNullable<OrderListFilters['sort']> };
    const result = await orders.list(context.storeId, page, pageSize, filters);
    const items = result.items.map(order => {
      const customer = customerForPanel(order.customerDataEncrypted, environment.APP_ENCRYPTION_KEY!, request, order.publicId);
      const attempt = preferredAttempt(order.paymentAttempts);
      return { publicId: order.publicId, status: attempt?.status ?? 'PENDING', sessionStatus: order.status, paymentProvider: attempt?.provider ?? null, paymentPublicId: attempt?.publicId ?? null, totalCents: order.totalCents - (order.discountCents ?? 0) + order.shippingPriceCents, discountCents: order.discountCents ?? 0, couponCode: order.couponCode, shippingPriceCents: order.shippingPriceCents, shippingMethodName: order.shippingMethodName, currency: order.currency, customer, country: countryFromTracking(order.trackingParameters), items: order.items, createdAt: order.createdAt, paidAt: attempt?.paidAt ?? order.completedAt, expiresAt: attempt?.expiresAt ?? null };
    });
    return reply.header('cache-control', 'private, no-store').send({ items, total: result.total, page, pageSize, pages: Math.max(1, Math.ceil(result.total / pageSize)) });
  });

  app.get<{ Params: { orderId: string } }>('/orders/:orderId', async (request, reply) => {
    const context = await contextFor(request);
    if (!context) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Proteção de dados indisponível.'));
    const order = await orders.find(context.storeId, request.params.orderId);
    if (!order) return reply.code(404).send(errorBody(request, 'ORDER_NOT_FOUND', 'Pedido não encontrado.'));
    const history = order.customerEmailHash && orders.customerHistory ? await orders.customerHistory(context.storeId, order.customerEmailHash, order.publicId) : [];
    return reply.header('cache-control', 'private, no-store').send(serializeDetail(order, environment.APP_ENCRYPTION_KEY, request, context.role !== 'ANALYST', history));
  });

  app.patch<{ Params: { orderId: string }; Body: { status?: string; note?: string } }>('/orders/:orderId/status', async (request, reply) => {
    const context = await contextFor(request, true);
    if (!context) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Sessão ou proteção CSRF inválida.'));
    if (context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Seu perfil possui acesso somente para leitura.'));
    const status = request.body?.status as FulfillmentStatus;
    const note = asString(request.body?.note);
    if (!fulfillmentStatuses.has(status) || (note?.length ?? 0) > 240) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Status ou observação inválida.'));
    const order = await orders.find(context.storeId, request.params.orderId);
    if (!order) return reply.code(404).send(errorBody(request, 'ORDER_NOT_FOUND', 'Pedido não encontrado.'));
    const root = trackingRecord(order.trackingParameters); const management = orderManagement(root);
    const events = [...statusEvents(order, management), { status, ...(note ? { note } : {}), at: new Date().toISOString() }].slice(-40);
    if (!orders.updateTrackingParameters) return reply.code(501).send(errorBody(request, 'NOT_IMPLEMENTED', 'Atualização operacional indisponível.'));
    const updated = await orders.updateTrackingParameters(context.storeId, order.publicId, { ...root, _orderManagement: { ...management, fulfillmentStatus: status, statusEvents: events } });
    if (!updated) return reply.code(409).send(errorBody(request, 'UPDATE_CONFLICT', 'O pedido foi alterado. Atualize e tente novamente.'));
    return reply.send({ status, events });
  });

  app.put<{ Params: { orderId: string }; Body: { carrier?: string; code?: string; url?: string; note?: string } }>('/orders/:orderId/tracking', async (request, reply) => {
    const context = await contextFor(request, true);
    if (!context) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Sessão ou proteção CSRF inválida.'));
    if (context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Seu perfil possui acesso somente para leitura.'));
    const carrier = asString(request.body?.carrier); const code = asString(request.body?.code); const url = asString(request.body?.url); const note = asString(request.body?.note);
    if (!carrier || !code || carrier.length > 80 || code.length > 120 || (url && (url.length > 500 || !/^https:\/\//i.test(url))) || (note?.length ?? 0) > 240) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Informe transportadora, código e uma URL HTTPS válida.'));
    const order = await orders.find(context.storeId, request.params.orderId);
    if (!order) return reply.code(404).send(errorBody(request, 'ORDER_NOT_FOUND', 'Pedido não encontrado.'));
    const root = trackingRecord(order.trackingParameters); const management = orderManagement(root);
    if (!orders.updateTrackingParameters) return reply.code(501).send(errorBody(request, 'NOT_IMPLEMENTED', 'Atualização operacional indisponível.'));
    const updated = await orders.updateTrackingParameters(context.storeId, order.publicId, { ...root, _orderManagement: { ...management, trackingCarrier: carrier, trackingCode: code, ...(url ? { trackingUrl: url } : {}), ...(note ? { trackingNote: note } : {}) } });
    if (!updated) return reply.code(409).send(errorBody(request, 'UPDATE_CONFLICT', 'O pedido foi alterado. Atualize e tente novamente.'));
    return reply.send({ carrier, code, url: url ?? null, note: note ?? null });
  });

  app.post<{ Params: { orderId: string }; Body: { blocked?: boolean } }>('/orders/:orderId/block-visitor', async (request, reply) => {
    const context = await contextFor(request, true);
    if (!context) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Sessão ou proteção CSRF inválida.'));
    if (context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Seu perfil possui acesso somente para leitura.'));
    if (typeof request.body?.blocked !== 'boolean') return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'A opção de bloqueio é obrigatória.'));
    const order = await orders.find(context.storeId, request.params.orderId);
    if (!order) return reply.code(404).send(errorBody(request, 'ORDER_NOT_FOUND', 'Pedido não encontrado.'));
    const root = trackingRecord(order.trackingParameters); const management = orderManagement(root); const blocked = request.body.blocked;
    if (!orders.updateTrackingParameters) return reply.code(501).send(errorBody(request, 'NOT_IMPLEMENTED', 'Atualização operacional indisponível.'));
    const updated = await orders.updateTrackingParameters(context.storeId, order.publicId, { ...root, _orderManagement: { ...management, visitorBlocked: blocked, visitorBlockedAt: blocked ? new Date().toISOString() : null } });
    if (!updated) return reply.code(409).send(errorBody(request, 'UPDATE_CONFLICT', 'O pedido foi alterado. Atualize e tente novamente.'));
    return reply.send({ blocked });
  });
}
