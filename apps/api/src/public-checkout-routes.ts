import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { CatalogRepository } from './catalog-repository.js';
import { decryptSecret, encryptSecret } from './shopify-crypto.js';
import type { PrismaGatewayRepository } from './gateway-repository.js';
import type { ShopifyRepository } from './shopify-repository.js';
import { syncPaidShopifyOrder } from './shopify-order-sync.js';
import { createWestPayPix, findWestPayPix, getWestPayPix, WestPayRequestError } from './westpay-client.js';
import { createRoasPix, getRoasPix, RoasRequestError } from './roas-client.js';
import { lookupBrazilianPostalCode, PostalCodeLookupError } from './postal-code.js';
import { syncUtmifyOrder } from './utmify-sync.js';
import { syncMetaEvent } from './meta-sync.js';
import { mapProviderPaymentStatus, providerAmountMatches } from './payment-rules.js';
import { storeOnboardingComplete } from './store-onboarding.js';
import { anonymizeSocialProofLocation, anonymizeSocialProofName, sanitizeSocialProofProduct } from './social-proof-privacy.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const slug = (value: unknown): string | null => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80 ? value : null;
const publicId = (value: unknown): string | null => typeof value === 'string' && /^[A-Za-z0-9_-]{8,32}$/.test(value) ? value : null;
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const digits = (value: unknown): string => typeof value === 'string' ? value.replace(/\D/g, '') : '';
const trackingKeys = ['src', 'sck', 'utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'fbp', 'fbc', 'event_source_url', 'visitor_id'] as const;
const trackingParameters = (value: unknown): Record<string, string | null> => { const input = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; return Object.fromEntries(trackingKeys.map(key => [key, typeof input[key] === 'string' && input[key].trim() ? input[key].trim().slice(0, 500) : null])); };
const geoHeader = (request: FastifyRequest, name: string, max = 120): string | null => { const value = request.headers[name]; return typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value.trim() : null; };
const validCpf = (value: string): boolean => { if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false; const check = (length: number) => { let sum = 0; for (let index = 0; index < length; index += 1) sum += Number(value[index]) * (length + 1 - index); const mod = sum % 11; return mod < 2 ? 0 : 11 - mod; }; return check(9) === Number(value[9]) && check(10) === Number(value[10]); };
const brazilianMobile = (value: unknown): string | null => { const raw = digits(value); const local = raw.length === 13 && raw.startsWith('55') ? raw.slice(2) : raw; return /^\d{2}9\d{8}$/.test(local) ? local : null; };
const sessionCredentials = (sessionIdValue: unknown, authorization: string | undefined): { sessionId: string; tokenHash: string } | null => { const sessionId = publicId(sessionIdValue); const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''; return sessionId && token.length >= 32 && token.length <= 128 ? { sessionId, tokenHash: sha256(token) } : null; };
const westPayPaymentStatus = mapProviderPaymentStatus;
const westPayAmountMatches = providerAmountMatches;
const roasAmountMatches = providerAmountMatches;
const validProxySignature = (query: Record<string, string | string[] | undefined>, secret: string): boolean => {
  const signature = query.signature; if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const message = Object.entries(query).filter(([key]) => key !== 'signature').map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value ?? ''}`).sort().join('');
  const expected = createHmac('sha256', secret).update(message).digest('hex');
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
};

export function registerPublicCheckoutRoutes(app: FastifyInstance, environment: AppEnvironment, catalog: CatalogRepository, gateways?: PrismaGatewayRepository, shopify?: ShopifyRepository, database?: PrismaClient): void {
  app.get<{ Params: { postalCode: string } }>('/public/postal-codes/:postalCode', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const postalCode = digits(request.params.postalCode);
    if (postalCode.length !== 8) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'CEP inválido.'));
    try {
      const address = await lookupBrazilianPostalCode(postalCode);
      return reply.header('cache-control', 'public, max-age=86400, stale-while-revalidate=604800').send({ address });
    } catch (lookupError) {
      if (lookupError instanceof PostalCodeLookupError && lookupError.code === 'NOT_FOUND') return reply.code(404).send(errorBody(request, 'POSTAL_CODE_NOT_FOUND', 'CEP não encontrado. Confira os números ou preencha o endereço manualmente.'));
      request.log.warn({ err: lookupError }, 'postal code provider unavailable');
      return reply.code(503).send(errorBody(request, 'POSTAL_CODE_UNAVAILABLE', 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.'));
    }
  });

  app.get<{ Params: { storeSlug: string; checkoutSlug: string } }>('/public/checkouts/:storeSlug/:checkoutSlug', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request, reply) => {
    const storeSlug = slug(request.params.storeSlug); const checkoutSlug = slug(request.params.checkoutSlug);
    if (!storeSlug || !checkoutSlug) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Checkout inválido.'));
    const checkout = await catalog.getPublicCheckout(storeSlug, checkoutSlug);
    if (!checkout) return reply.code(404).send(errorBody(request, 'CHECKOUT_NOT_FOUND', 'Checkout indisponível.'));
    return reply.header('cache-control', 'public, max-age=30, stale-while-revalidate=60').send({ checkout });
  });

  app.post<{ Params: { storeSlug: string; checkoutSlug: string }; Body: Record<string, unknown> }>('/public/checkouts/:storeSlug/:checkoutSlug/sessions', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const storeSlug = slug(request.params.storeSlug); const checkoutSlug = slug(request.params.checkoutSlug);
    const quantity = request.body?.quantity === undefined ? 1 : request.body.quantity;
    const variantPublicId = request.body?.variantId === undefined ? undefined : publicId(request.body.variantId);
    if (!storeSlug || !checkoutSlug || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000 || request.body?.variantId !== undefined && !variantPublicId) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Itens do checkout inválidos.'));
    const token = randomBytes(32).toString('base64url');
    const sessionTracking = { ...trackingParameters(request.body?.trackingParameters), client_ip_address: request.ip, client_user_agent: String(request.headers['user-agent'] || '').slice(0, 500), geo_country: geoHeader(request, 'cf-ipcountry', 2), geo_region: geoHeader(request, 'cf-region'), geo_region_code: geoHeader(request, 'cf-region-code', 12), geo_city: geoHeader(request, 'cf-ipcity'), geo_latitude: geoHeader(request, 'cf-iplatitude', 24), geo_longitude: geoHeader(request, 'cf-iplongitude', 24) };
    const session = await catalog.createPublicCheckoutSession({ storeSlug, checkoutSlug, quantity, tokenHash: sha256(token), source: 'DIRECT', trackingParameters: sessionTracking, expiresAt: new Date(Date.now() + 30 * 60_000), ...(variantPublicId ? { variantPublicId } : {}) });
    if (!session) return reply.code(409).send(errorBody(request, 'CHECKOUT_UNAVAILABLE', 'Produto, variante ou estoque indisponível.'));
    return reply.header('cache-control', 'no-store').code(201).send({ session, token });
  });

  app.get<{ Params: { sessionId: string }; Headers: { authorization?: string } }>('/public/checkout-sessions/:sessionId', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const sessionId = publicId(request.params.sessionId);
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!sessionId || token.length < 32 || token.length > 128) return reply.code(401).send(errorBody(request, 'INVALID_SESSION', 'Sessão inválida.'));
    const session = await catalog.getPublicCheckoutSession(sessionId, sha256(token), new Date());
    if (!session) return reply.code(404).send(errorBody(request, 'SESSION_NOT_FOUND', 'Sessão expirada ou indisponível.'));
    return reply.header('cache-control', 'no-store').send({ session });
  });

  app.get<{ Params: { sessionId: string }; Headers: { authorization?: string } }>('/public/checkout-sessions/:sessionId/social-proof', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization);
    if (!credentials) return reply.code(401).send(errorBody(request, 'INVALID_SESSION', 'Sessão inválida.'));
    if (!database || !environment.APP_ENCRYPTION_KEY) return reply.header('cache-control', 'private, no-store').send({ items: [] });
    const current = await database.checkoutSession.findFirst({
      where: { publicId: credentials.sessionId, tokenHash: credentials.tokenHash, expiresAt: { gt: new Date() } },
      select: { checkoutId: true, checkout: { select: { publishedConfig: true } } },
    });
    if (!current) return reply.code(404).send(errorBody(request, 'SESSION_NOT_FOUND', 'Sessão indisponível.'));
    const publishedConfig = typeof current.checkout.publishedConfig === 'object' && current.checkout.publishedConfig !== null && !Array.isArray(current.checkout.publishedConfig) ? current.checkout.publishedConfig as Record<string, unknown> : {};
    if (publishedConfig.socialProofEnabled !== true) return reply.header('cache-control', 'private, no-store').send({ items: [] });
    const attempts = await database.paymentAttempt.findMany({
      where: {
        status: 'PAID',
        paidAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60_000) },
        session: { checkoutId: current.checkoutId, publicId: { not: credentials.sessionId }, customerDataEncrypted: { not: null } },
      },
      orderBy: { paidAt: 'desc' },
      take: 12,
      select: {
        paidAt: true,
        session: {
          select: {
            customerDataEncrypted: true,
            shippingAddressEncrypted: true,
            trackingParameters: true,
            checkout: { select: { product: { select: { checkoutTitle: true } } } },
          },
        },
      },
    });
    const decryptObject = (encrypted: string | null): Record<string, unknown> => {
      if (!encrypted) return {};
      try {
        const parsed = JSON.parse(decryptSecret(encrypted, environment.APP_ENCRYPTION_KEY!)) as unknown;
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
      } catch (error) {
        request.log.warn({ err: error }, 'social_proof_decrypt_failed');
        return {};
      }
    };
    const items = attempts.flatMap((attempt) => {
      const customer = decryptObject(attempt.session.customerDataEncrypted);
      const address = decryptObject(attempt.session.shippingAddressEncrypted);
      const tracking = typeof attempt.session.trackingParameters === 'object' && attempt.session.trackingParameters !== null && !Array.isArray(attempt.session.trackingParameters) ? attempt.session.trackingParameters as Record<string, unknown> : {};
      const anonymousName = anonymizeSocialProofName(customer.name);
      if (!anonymousName || !attempt.paidAt) return [];
      return [{
        name: anonymousName,
        product: sanitizeSocialProofProduct(attempt.session.checkout.product?.checkoutTitle || 'um produto'),
        city: anonymizeSocialProofLocation(address, tracking),
        occurredAt: attempt.paidAt.toISOString(),
      }];
    });
    return reply.header('cache-control', 'private, no-store').send({ items });
  });

  app.put<{ Params: { sessionId: string }; Headers: { authorization?: string } }>('/public/checkout-sessions/:sessionId/presence', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (request, reply) => {
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization);
    if (!credentials) return reply.code(401).send(errorBody(request, 'INVALID_SESSION', 'Sessão inválida.'));
    if (!catalog.touchPublicCheckoutSession) return reply.code(503).send(errorBody(request, 'PRESENCE_UNAVAILABLE', 'Presença temporariamente indisponível.'));
    const touched = await catalog.touchPublicCheckoutSession(credentials.sessionId, credentials.tokenHash, new Date());
    if (!touched) return reply.code(404).send(errorBody(request, 'SESSION_NOT_FOUND', 'Sessão expirada ou indisponível.'));
    return reply.header('cache-control', 'no-store').code(204).send();
  });

  app.get<{ Params: { sessionId: string }; Headers: { authorization?: string } }>('/public/checkout-sessions/:sessionId/tracking/meta', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization);
    if (!credentials || !gateways || !environment.APP_ENCRYPTION_KEY) return reply.code(401).send(errorBody(request, 'INVALID_SESSION', 'Sessão inválida.'));
    const storeId = await gateways.publicTrackingStore(credentials.sessionId, credentials.tokenHash);
    if (!storeId) return reply.code(404).send(errorBody(request, 'SESSION_NOT_FOUND', 'Sessão indisponível.'));
    const meta = await gateways.credentials(storeId, 'META');
    const pixelId = meta ? decryptSecret(meta.publicKeyEncrypted, environment.APP_ENCRYPTION_KEY) : null;
    return reply.header('cache-control', 'no-store').send({ pixelId });
  });

  app.get<{ Params: { sessionId: string }; Headers: { authorization?: string } }>('/public/checkout-sessions/:sessionId/delivery', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization);
    if (!credentials) return reply.code(401).send(errorBody(request, 'INVALID_SESSION', 'Sessão inválida.'));
    const delivery = await catalog.getPaidDigitalDelivery(credentials.sessionId, credentials.tokenHash);
    if (!delivery) return reply.code(404).send(errorBody(request, 'DELIVERY_NOT_AVAILABLE', 'O acesso ainda não está disponível.'));
    return reply.header('cache-control', 'no-store').send({ delivery });
  });

  app.put<{ Params: { sessionId: string }; Headers: { authorization?: string }; Body: Record<string, unknown> }>('/public/checkout-sessions/:sessionId/customer', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Proteção de dados indisponível.'));
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization); const name = typeof request.body?.name === 'string' ? request.body.name.trim().replace(/\s+/g, ' ') : ''; const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''; const phone = brazilianMobile(request.body?.phone); const document = digits(request.body?.document);
    if (!credentials || name.length < 3 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 || !phone || (document.length > 0 && !validCpf(document))) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Confira nome, e-mail, celular com DDD e CPF.'));
    const hmacKey = createHmac('sha256', Buffer.from(environment.APP_ENCRYPTION_KEY, 'base64')).update('solid-checkout-pii-index-v1').digest();
    const hmac = (value: string) => createHmac('sha256', hmacKey).update(value).digest('hex');
    const encryptedData = encryptSecret(JSON.stringify({ name, email, phone, document }), environment.APP_ENCRYPTION_KEY);
    const result = await catalog.updatePublicCheckoutCustomer(credentials.sessionId, credentials.tokenHash, new Date(), { encryptedData, emailHash: hmac(email), documentHash: document ? hmac(document) : null });
    if (!result) return reply.code(404).send(errorBody(request, 'SESSION_NOT_FOUND', 'Sessão expirada ou indisponível.'));
    if (gateways) { const tracking = await gateways.publicTrackingSession(credentials.sessionId, credentials.tokenHash); if (tracking) await syncMetaEvent(environment, gateways, tracking.id, 'InitiateCheckout', request.log); }
    return reply.header('cache-control', 'no-store').send(result);
  });

  app.put<{ Params: { sessionId: string }; Headers: { authorization?: string }; Body: Record<string, unknown> }>('/public/checkout-sessions/:sessionId/shipping', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Proteção de dados indisponível.'));
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization); const postalCode = digits(request.body?.postalCode); const state = typeof request.body?.state === 'string' ? request.body.state.trim().toUpperCase() : ''; const read = (key: string, max: number) => { const value = request.body?.[key]; return typeof value === 'string' && value.trim().length <= max ? value.trim() : ''; };
    const street = read('street', 180); const number = read('number', 30); const complement = read('complement', 120); const neighborhood = read('neighborhood', 120); const city = read('city', 120);
    if (!credentials || postalCode.length !== 8 || street.length < 3 || !number || neighborhood.length < 2 || city.length < 2 || !/^[A-Z]{2}$/.test(state)) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Endereço de entrega inválido.'));
    const encryptedData = encryptSecret(JSON.stringify({ postalCode, street, number, complement, neighborhood, city, state, country: 'BR' }), environment.APP_ENCRYPTION_KEY);
    const result = await catalog.updatePublicCheckoutShipping(credentials.sessionId, credentials.tokenHash, new Date(), { encryptedData });
    if (!result) return reply.code(409).send(errorBody(request, 'CUSTOMER_REQUIRED', 'Informe a identificação antes do endereço.'));
    return reply.header('cache-control', 'no-store').send(result);
  });

  app.get<{ Params: { sessionId: string }; Headers: { authorization?: string } }>('/public/checkout-sessions/:sessionId/shipping-methods', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization);
    if (!credentials) return reply.code(401).send(errorBody(request, 'INVALID_SESSION', 'Sessão inválida.'));
    const methods = await catalog.listPublicShippingMethods(credentials.sessionId, credentials.tokenHash, new Date());
    if (!methods) return reply.code(409).send(errorBody(request, 'SHIPPING_ADDRESS_REQUIRED', 'Informe o endereço antes de escolher o frete.'));
    return reply.header('cache-control', 'no-store').send({ items: methods });
  });

  app.put<{ Params: { sessionId: string }; Headers: { authorization?: string }; Body: Record<string, unknown> }>('/public/checkout-sessions/:sessionId/shipping-method', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (request, reply) => {
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization); const methodId = publicId(request.body?.methodId);
    if (!credentials || !methodId) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Método de frete inválido.'));
    const result = await catalog.selectPublicShippingMethod(credentials.sessionId, credentials.tokenHash, methodId, new Date());
    if (!result) return reply.code(409).send(errorBody(request, 'SHIPPING_METHOD_UNAVAILABLE', 'Este método de frete não está mais disponível.'));
    return reply.header('cache-control', 'no-store').send(result);
  });

  app.post<{ Params: { sessionId: string }; Headers: { authorization?: string } }>('/public/checkout-sessions/:sessionId/payments/westpay/pix', { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } }, async (request, reply) => {
    if (!gateways || !environment.APP_ENCRYPTION_KEY || !environment.API_PUBLIC_URL) return reply.code(503).send(errorBody(request, 'PAYMENT_NOT_CONFIGURED', 'Pagamento ainda não configurado no servidor.'));
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization); if (!credentials) return reply.code(401).send(errorBody(request, 'INVALID_SESSION', 'Sessão inválida.'));
    const context = await gateways.paymentContext(credentials.sessionId, credentials.tokenHash, new Date()); if (!context) return reply.code(409).send(errorBody(request, 'CHECKOUT_INCOMPLETE', 'Confirme os dados necessários antes do pagamento.'));
    if (database && !await storeOnboardingComplete(database, context.checkout.storeId, environment.APP_ENCRYPTION_KEY)) return reply.code(403).send(errorBody(request, 'STORE_ONBOARDING_REQUIRED', 'Esta loja ainda não concluiu o cadastro obrigatório.'));
    if (!await gateways.billingAccessAllowed(context.checkout.storeId)) return reply.code(402).send(errorBody(request, 'STORE_BILLING_BLOCKED', 'Esta loja está temporariamente indisponível para novos pagamentos.'));
    const providers = await gateways.paymentProviders(context.checkout.storeId); if (!providers.length) return reply.code(409).send(errorBody(request, 'GATEWAY_UNAVAILABLE', 'A loja ainda não configurou um gateway Pix.'));
    const previous = await gateways.latestAttempt(context.id); if (previous?.pixCodeEncrypted && previous.status === 'PENDING') return reply.header('cache-control', 'no-store').send({ payment: { publicId: previous.publicId, status: 'pending', amountCents: previous.amountCents, pixCode: decryptSecret(previous.pixCodeEncrypted, environment.APP_ENCRYPTION_KEY), expiresAt: previous.expiresAt } });
    const amountCents = context.totalCents - context.discountCents + context.shippingPriceCents;
    const fallbackProduct = context.checkout.product;
    const paymentItems = context.items.length ? context.items : fallbackProduct ? [{ productId: fallbackProduct.id, titleSnapshot: fallbackProduct.checkoutTitle, unitPriceCents: context.unitPriceCents, quantity: context.quantity, product: { fulfillmentType: fallbackProduct.fulfillmentType } }] : [];
    if (!paymentItems.length) return reply.code(409).send(errorBody(request, 'CHECKOUT_EMPTY', 'O carrinho não possui itens válidos.'));
    const customer = JSON.parse(decryptSecret(context.customerDataEncrypted!, environment.APP_ENCRYPTION_KEY)) as Record<string, string>; const address = context.shippingAddressEncrypted ? JSON.parse(decryptSecret(context.shippingAddressEncrypted, environment.APP_ENCRYPTION_KEY)) as Record<string, string> : null;
    if (!validCpf(digits(customer.document))) return reply.code(409).send(errorBody(request, 'CPF_REQUIRED', 'Informe um CPF válido para gerar o Pix.'));
    for (const provider of providers) {
      const encryptedCredentials = await gateways.credentials(context.checkout.storeId, provider); if (!encryptedCredentials) continue;
      const westpayCredentials = { apiKey: decryptSecret(encryptedCredentials.apiKeyEncrypted, environment.APP_ENCRYPTION_KEY), publicKey: decryptSecret(encryptedCredentials.publicKeyEncrypted, environment.APP_ENCRYPTION_KEY) };
      const roasCredentials = { secretKey: decryptSecret(encryptedCredentials.apiKeyEncrypted, environment.APP_ENCRYPTION_KEY), publicKey: decryptSecret(encryptedCredentials.publicKeyEncrypted, environment.APP_ENCRYPTION_KEY) };
      let attempt = await gateways.latestAttempt(context.id, provider); if (!attempt || attempt.status !== 'PENDING') attempt = await gateways.createAttempt(context.id, provider, amountCents, `${provider.toLowerCase()}:${context.id}:${Date.now()}`);
      const externalRef = `solid-${attempt.publicId}`;
      try {
      if (provider === 'ROAS') {
        const transaction = await createRoasPix(roasCredentials, { payment_method: 'pix', customer: { document: { type: digits(customer.document).length === 14 ? 'cnpj' : 'cpf', number: digits(customer.document) }, name: customer.name, email: customer.email, phone: digits(customer.phone).startsWith('55') ? digits(customer.phone) : `55${digits(customer.phone)}` }, items: paymentItems.map(item => ({ title: item.titleSnapshot, unit_price: item.unitPriceCents, quantity: item.quantity })), amount: amountCents, postback_url: `${environment.API_PUBLIC_URL.replace(/\/$/, '')}/webhooks/roas`, metadata: { provider_name: 'SOLID Checkout', checkout_session: context.publicId } });
        if (!transaction.id || !transaction.pixCode) throw new Error('Roas returned an incomplete PIX response');
        const expiresAt = transaction.expiresAt ? new Date(transaction.expiresAt) : null; const saved = await gateways.completeAttempt(attempt.id, transaction.id, encryptSecret(transaction.pixCode, environment.APP_ENCRYPTION_KEY), expiresAt); if (typeof gateways.recordPendingPayment === 'function') await gateways.recordPendingPayment(attempt.id, provider, request.id);
        await syncUtmifyOrder(environment, gateways, context.id, 'waiting_payment', request.log);
        await syncMetaEvent(environment, gateways, context.id, 'AddPaymentInfo', request.log);
        if (shopify) { try { await syncPaidShopifyOrder(environment, shopify, context.id); } catch (error) { request.log.error({ err: error, checkoutSessionId: context.id }, 'shopify_pending_order_sync_failed'); } }
        return reply.header('cache-control', 'no-store').code(201).send({ payment: { ...saved, status: 'pending', pixCode: transaction.pixCode } });
      }
      let transaction = await findWestPayPix(westpayCredentials, externalRef);
      if (!transaction) transaction = await createWestPayPix(westpayCredentials, {
        amount: amountCents,
        paymentMethod: 'pix',
        customer: { name: customer.name, email: customer.email, phone: digits(customer.phone), document: { number: digits(customer.document), type: digits(customer.document).length === 14 ? 'cnpj' : 'cpf' }, externalRef: context.publicId },
        items: paymentItems.map(item => ({ title: item.titleSnapshot, unitPrice: item.unitPriceCents, quantity: item.quantity, tangible: (item.product?.fulfillmentType ?? fallbackProduct?.fulfillmentType ?? 'PHYSICAL') !== 'DIGITAL', externalRef: item.productId })),
        ...(address ? { shipping: { fee: context.shippingPriceCents, address: { street: address.street, streetNumber: address.number, complement: address.complement || undefined, zipCode: digits(address.postalCode), neighborhood: address.neighborhood, city: address.city, state: address.state, country: 'br' } } } : {}),
        pix: { expiresInSeconds: Math.max(30, Math.min(1800, Math.floor((context.expiresAt.getTime() - Date.now()) / 1000))) },
        externalRef,
        postbackUrl: `${environment.API_PUBLIC_URL.replace(/\/$/, '')}/webhooks/westpay`,
        metadata: { checkoutSession: context.publicId, platform: 'solid' },
        ...(request.ip && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(request.ip) ? { ip: request.ip } : {})
      });
      if (!transaction.id || !transaction.pix?.qrcode) throw new Error('WestPay returned an incomplete PIX response');
      const expiresAt = transaction.pix.expiresAt ? new Date(transaction.pix.expiresAt) : null; const saved = await gateways.completeAttempt(attempt.id, transaction.id, encryptSecret(transaction.pix.qrcode, environment.APP_ENCRYPTION_KEY), expiresAt); if (typeof gateways.recordPendingPayment === 'function') await gateways.recordPendingPayment(attempt.id, provider, request.id);
      await syncUtmifyOrder(environment, gateways, context.id, 'waiting_payment', request.log);
      await syncMetaEvent(environment, gateways, context.id, 'AddPaymentInfo', request.log);
      if (shopify) {
        try { await syncPaidShopifyOrder(environment, shopify, context.id); }
        catch (error) { request.log.error({ err: error, checkoutSessionId: context.id }, 'shopify_pending_order_sync_failed'); }
      }
      return reply.header('cache-control', 'no-store').code(201).send({ payment: { ...saved, status: 'pending', pixCode: transaction.pix.qrcode } });
      } catch (error) {
        request.log.warn({ err: error, provider, checkoutSession: context.publicId }, 'pix_creation_failed');
        if (error instanceof WestPayRequestError && error.status === 422) {
          const detail = error.details.find(value => /m[ií]nim|minimum|amount|valor/i.test(value)) ?? '';
          const amount = detail.match(/R\$\s*\d+(?:[.,]\d{1,2})?/i)?.[0];
          const message = amount ? `O valor mínimo permitido pela WestPay para este Pix é ${amount}.` : 'O valor ou os dados do pagamento não foram aceitos pela WestPay.';
          return reply.code(422).send(errorBody(request, 'WESTPAY_VALIDATION_ERROR', message));
        }
        await gateways.failAttempt(attempt.id);
      }
    }
    return reply.code(502).send(errorBody(request, 'GATEWAY_UNAVAILABLE', 'Os gateways configurados estão temporariamente indisponíveis. Tente novamente.'));
  });

  app.get<{ Params: { sessionId: string }; Headers: { authorization?: string } }>('/public/checkout-sessions/:sessionId/payments/latest', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!gateways) return reply.code(503).send(errorBody(request, 'PAYMENT_NOT_CONFIGURED', 'Pagamento ainda não configurado no servidor.'));
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization);
    if (!credentials) return reply.code(401).send(errorBody(request, 'INVALID_SESSION', 'Sessão inválida.'));
    const verification = environment.APP_ENCRYPTION_KEY ? await gateways.publicPaymentVerification(credentials.sessionId, credentials.tokenHash) : null;
    // ROAS is webhook-first. Polling this public endpoint every few seconds must
    // only read our database, otherwise one open checkout can exhaust the
    // provider rate limit and also prevent webhook verification.
    if (verification && verification.status === 'PENDING' && verification.provider !== 'ROAS') {
      const provider = 'WESTPAY';
      const encryptedCredentials = await gateways.credentials(verification.storeId, provider);
      if (encryptedCredentials) {
        try {
          const official = await getWestPayPix({ apiKey: decryptSecret(encryptedCredentials.apiKeyEncrypted, environment.APP_ENCRYPTION_KEY!), publicKey: decryptSecret(encryptedCredentials.publicKeyEncrypted, environment.APP_ENCRYPTION_KEY!) }, verification.providerTransactionId);
          const mapped = westPayPaymentStatus(official?.status);
          if (mapped && official && westPayAmountMatches(official.amount, verification.amountCents)) {
            await gateways.confirmPayment(verification.id, verification.checkoutSessionId, mapped, mapped === 'PAID' ? new Date() : undefined);
            await syncUtmifyOrder(environment, gateways, verification.checkoutSessionId, mapped === 'PAID' ? 'paid' : mapped === 'REFUNDED' ? 'refunded' : 'refused', request.log);
            if (mapped === 'PAID') await syncMetaEvent(environment, gateways, verification.checkoutSessionId, 'Purchase', request.log);
            if (mapped === 'PAID' && shopify) {
              try { await syncPaidShopifyOrder(environment, shopify, verification.checkoutSessionId); }
              catch (error) { request.log.error({ err: error, checkoutSessionId: verification.checkoutSessionId }, 'shopify_order_sync_failed'); }
            }
          }
        } catch (error) { request.log.warn({ err: error, provider, paymentAttemptId: verification.id }, 'payment_status_check_failed'); }
      }
    }
    const payment = await gateways.publicPaymentStatus(credentials.sessionId, credentials.tokenHash);
    if (!payment) return reply.code(404).send(errorBody(request, 'PAYMENT_NOT_FOUND', 'Pagamento ainda não gerado.'));
    return reply.header('cache-control', 'no-store').send({ payment });
  });

  app.put<{ Params: { sessionId: string }; Headers: { authorization?: string }; Body: { productId?: unknown; enabled?: unknown } }>('/public/checkout-sessions/:sessionId/order-bump', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization);
    if (!credentials || typeof request.body?.enabled !== 'boolean' || typeof request.body?.productId !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(request.body.productId)) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Oferta complementar inválida.'));
    const update = await catalog.setPublicOrderBump(credentials.sessionId, credentials.tokenHash, request.body.productId, request.body.enabled, new Date());
    if (!update) return reply.code(404).send(errorBody(request, 'ORDER_BUMP_UNAVAILABLE', 'Esta oferta complementar não está disponível.'));
    const session = await catalog.getPublicCheckoutSession(credentials.sessionId, credentials.tokenHash, new Date());
    return reply.header('cache-control', 'no-store').send({ update, session });
  });

  app.put<{ Params: { sessionId: string }; Headers: { authorization?: string }; Body: { quantity?: unknown } }>('/public/checkout-sessions/:sessionId/quantity', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization); const quantity = request.body?.quantity;
    if (!credentials || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Quantidade inválida.'));
    if (!catalog.updatePublicCheckoutQuantity) return reply.code(503).send(errorBody(request, 'QUANTITY_UNAVAILABLE', 'Alteração de quantidade temporariamente indisponível.'));
    const update = await catalog.updatePublicCheckoutQuantity(credentials.sessionId, credentials.tokenHash, quantity, new Date());
    if (!update) return reply.code(409).send(errorBody(request, 'QUANTITY_UNAVAILABLE', 'A quantidade não está disponível ou o pagamento já foi iniciado.'));
    const session = await catalog.getPublicCheckoutSession(credentials.sessionId, credentials.tokenHash, new Date());
    return reply.header('cache-control', 'no-store').send({ update, session });
  });

  app.post<{ Body: Record<string, unknown> }>('/webhooks/westpay', { config: { rateLimit: { max: 180, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!gateways || !environment.APP_ENCRYPTION_KEY) return reply.code(503).send();
    const objectId = typeof request.body?.objectId === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(request.body.objectId) ? request.body.objectId : null;
    if (!objectId) return reply.code(400).send();
    const context = await gateways.webhookContext(objectId); if (!context) return reply.code(200).send({ received: true });
    const encryptedCredentials = await gateways.credentials(context.session.checkout.storeId); if (!encryptedCredentials) return reply.code(200).send({ received: true });
    try {
      const official = await getWestPayPix({ apiKey: decryptSecret(encryptedCredentials.apiKeyEncrypted, environment.APP_ENCRYPTION_KEY), publicKey: decryptSecret(encryptedCredentials.publicKeyEncrypted, environment.APP_ENCRYPTION_KEY) }, objectId);
      if (!official || official.id !== objectId || !westPayAmountMatches(official.amount, context.amountCents) || official.externalRef && official.externalRef !== `solid-${context.publicId}`) return reply.code(200).send({ received: true });
      const mapped = westPayPaymentStatus(official.status);
      if (mapped) {
        try { await gateways.recordWebhookEvent(context, 'WESTPAY', official.status, request.id); }
        catch (auditError) { request.log.warn({ err: auditError, providerTransactionId: objectId }, 'westpay_webhook_audit_failed'); }
        await gateways.confirmPayment(context.id, context.checkoutSessionId, mapped, mapped === 'PAID' ? new Date() : undefined);
        await syncUtmifyOrder(environment, gateways, context.checkoutSessionId, mapped === 'PAID' ? 'paid' : mapped === 'REFUNDED' ? 'refunded' : 'refused', request.log);
        if (mapped === 'PAID') await syncMetaEvent(environment, gateways, context.checkoutSessionId, 'Purchase', request.log);
        if (mapped === 'PAID' && shopify) {
          try { await syncPaidShopifyOrder(environment, shopify, context.checkoutSessionId); }
          catch (error) { request.log.error({ err: error, checkoutSessionId: context.checkoutSessionId }, 'shopify_order_sync_failed'); }
        }
      }
      return reply.code(200).send({ received: true });
    } catch (error) { request.log.warn({ err: error, providerTransactionId: objectId }, 'westpay_webhook_verification_failed'); return reply.code(503).send(); }
  });

  // A notificação da Roas é somente um gatilho: o status real sempre é conferido
  // diretamente na API do provedor antes de alterar um pedido.
  app.post<{ Body: Record<string, unknown> }>('/webhooks/roas', { config: { rateLimit: { max: 180, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!gateways || !environment.APP_ENCRYPTION_KEY) return reply.code(503).send();
    const objectIdValue = request.body?.Id ?? request.body?.id ?? request.body?.transaction_id ?? request.body?.transactionId;
    const objectId = (typeof objectIdValue === 'string' || typeof objectIdValue === 'number') ? String(objectIdValue) : null;
    if (!objectId || objectId.length > 128) return reply.code(400).send();
    const context = await gateways.webhookContext(objectId); if (!context) return reply.code(200).send({ received: true });
    const encryptedCredentials = await gateways.credentials(context.session.checkout.storeId, 'ROAS'); if (!encryptedCredentials) return reply.code(200).send({ received: true });
    try {
      const official = await getRoasPix({ secretKey: decryptSecret(encryptedCredentials.apiKeyEncrypted, environment.APP_ENCRYPTION_KEY), publicKey: decryptSecret(encryptedCredentials.publicKeyEncrypted, environment.APP_ENCRYPTION_KEY) }, objectId);
      if (!official || official.id !== objectId || !roasAmountMatches(official.amount, context.amountCents)) return reply.code(200).send({ received: true });
      const mapped = westPayPaymentStatus(official.status);
      if (mapped) { try { await gateways.recordWebhookEvent(context, 'ROAS', official.status, request.id); } catch (auditError) { request.log.warn({ err: auditError, providerTransactionId: objectId }, 'roas_webhook_audit_failed'); } await gateways.confirmPayment(context.id, context.checkoutSessionId, mapped, mapped === 'PAID' ? new Date() : undefined); await syncUtmifyOrder(environment, gateways, context.checkoutSessionId, mapped === 'PAID' ? 'paid' : mapped === 'REFUNDED' ? 'refunded' : 'refused', request.log); if (mapped === 'PAID') await syncMetaEvent(environment, gateways, context.checkoutSessionId, 'Purchase', request.log); if (mapped === 'PAID' && shopify) { try { await syncPaidShopifyOrder(environment, shopify, context.checkoutSessionId); } catch (error) { request.log.error({ err: error, checkoutSessionId: context.checkoutSessionId }, 'shopify_order_sync_failed'); } } }
      return reply.code(200).send({ received: true });
    } catch (error) {
      // A 429 is transient. Acknowledge the notification so ROAS does not add
      // more retries to the burst; the reconciliation worker will verify the
      // transaction again with backoff. Other failures remain retryable.
      if (error instanceof RoasRequestError && error.status === 429) {
        request.log.warn({ err: error, providerTransactionId: objectId }, 'roas_webhook_verification_deferred');
        return reply.code(202).send({ received: true, verification: 'deferred' });
      }
      request.log.warn({ err: error, providerTransactionId: objectId }, 'roas_webhook_verification_failed');
      return reply.code(503).send();
    }
  });

  app.post<{ Querystring: Record<string, string | string[] | undefined>; Body: Record<string, unknown> }>('/integrations/shopify/proxy/checkout-session', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const timestamp = typeof request.query.timestamp === 'string' ? Number(request.query.timestamp) : 0;
    const shopDomain = typeof request.query.shop === 'string' && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(request.query.shop) ? request.query.shop : null;
    const checkoutSlug = slug(request.body?.checkoutSlug); const rawLines = Array.isArray(request.body?.lines) ? request.body.lines : [];
    const lines = rawLines.flatMap(value => { if (typeof value !== 'object' || value === null) return []; const line = value as Record<string, unknown>; return typeof line.variantId === 'string' && /^\d{1,20}$/.test(line.variantId) && typeof line.quantity === 'number' && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 1000 ? [{ variantId: line.variantId, quantity: line.quantity }] : []; });
    if (!shopDomain || rawLines.length < 1 || rawLines.length > 50 || lines.length !== rawLines.length || !Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Carrinho Shopify inválido.'));
    let proxySecret: string | null = null;
    if (database && environment.APP_ENCRYPTION_KEY) {
      const connection = await database.shopifyConnection.findFirst({ where: { shopDomain, revokedAt: null, reconnectRequiredAt: null }, select: { authMode: true, clientSecretEncrypted: true } });
      try { if (connection?.authMode === 'CLIENT_CREDENTIALS' && connection.clientSecretEncrypted) proxySecret = decryptSecret(connection.clientSecretEncrypted, environment.APP_ENCRYPTION_KEY); } catch (error) { request.log.warn({ err: error, shopDomain }, 'shopify_proxy_secret_decryption_failed'); }
    }
    proxySecret ??= environment.SHOPIFY_CLIENT_SECRET ?? null;
    if (!proxySecret || !validProxySignature(request.query, proxySecret)) return reply.code(401).send(errorBody(request, 'INVALID_PROXY_SIGNATURE', 'Solicitação Shopify inválida.'));
    const token = randomBytes(32).toString('base64url');
    const session = await catalog.createShopifyCartSession({ shopDomain, lines, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000), ...(checkoutSlug ? { checkoutSlug } : {}) });
    if (!session) return reply.code(409).send(errorBody(request, 'CHECKOUT_UNAVAILABLE', 'Checkout, produto ou estoque indisponível.'));
    return reply.header('cache-control', 'no-store').code(201).send({ session, token });
  });
}
