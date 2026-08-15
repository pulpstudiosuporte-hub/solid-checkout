import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { CatalogRepository } from './catalog-repository.js';
import { decryptSecret, encryptSecret } from './shopify-crypto.js';
import type { PrismaGatewayRepository } from './gateway-repository.js';
import { createWestPayPix, findWestPayPix, getWestPayPix } from './westpay-client.js';
import { lookupBrazilianPostalCode, PostalCodeLookupError } from './postal-code.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const slug = (value: unknown): string | null => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80 ? value : null;
const publicId = (value: unknown): string | null => typeof value === 'string' && /^[A-Za-z0-9_-]{8,32}$/.test(value) ? value : null;
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const digits = (value: unknown): string => typeof value === 'string' ? value.replace(/\D/g, '') : '';
const validCpf = (value: string): boolean => { if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false; const check = (length: number) => { let sum = 0; for (let index = 0; index < length; index += 1) sum += Number(value[index]) * (length + 1 - index); const mod = sum % 11; return mod < 2 ? 0 : 11 - mod; }; return check(9) === Number(value[9]) && check(10) === Number(value[10]); };
const validCnpj = (value: string): boolean => { if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false; const calculate = (length: number) => { const weights = length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0); const mod = sum % 11; return mod < 2 ? 0 : 11 - mod; }; return calculate(12) === Number(value[12]) && calculate(13) === Number(value[13]); };
const sessionCredentials = (sessionIdValue: unknown, authorization: string | undefined): { sessionId: string; tokenHash: string } | null => { const sessionId = publicId(sessionIdValue); const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''; return sessionId && token.length >= 32 && token.length <= 128 ? { sessionId, tokenHash: sha256(token) } : null; };
const validProxySignature = (query: Record<string, string | string[] | undefined>, secret: string): boolean => {
  const signature = query.signature; if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const message = Object.entries(query).filter(([key]) => key !== 'signature').map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value ?? ''}`).sort().join('');
  const expected = createHmac('sha256', secret).update(message).digest('hex');
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
};

export function registerPublicCheckoutRoutes(app: FastifyInstance, environment: AppEnvironment, catalog: CatalogRepository, gateways?: PrismaGatewayRepository): void {
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
    const session = await catalog.createPublicCheckoutSession({ storeSlug, checkoutSlug, quantity, tokenHash: sha256(token), source: 'DIRECT', expiresAt: new Date(Date.now() + 30 * 60_000), ...(variantPublicId ? { variantPublicId } : {}) });
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

  app.put<{ Params: { sessionId: string }; Headers: { authorization?: string }; Body: Record<string, unknown> }>('/public/checkout-sessions/:sessionId/customer', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Proteção de dados indisponível.'));
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization); const name = typeof request.body?.name === 'string' ? request.body.name.trim().replace(/\s+/g, ' ') : ''; const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''; const phone = digits(request.body?.phone); const document = digits(request.body?.document);
    if (!credentials || name.length < 3 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 || phone.length < 10 || phone.length > 13 || (!validCpf(document) && !validCnpj(document))) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Dados de identificação inválidos.'));
    const hmacKey = createHmac('sha256', Buffer.from(environment.APP_ENCRYPTION_KEY, 'base64')).update('solid-checkout-pii-index-v1').digest();
    const hmac = (value: string) => createHmac('sha256', hmacKey).update(value).digest('hex');
    const encryptedData = encryptSecret(JSON.stringify({ name, email, phone, document }), environment.APP_ENCRYPTION_KEY);
    const result = await catalog.updatePublicCheckoutCustomer(credentials.sessionId, credentials.tokenHash, new Date(), { encryptedData, emailHash: hmac(email), documentHash: hmac(document) });
    if (!result) return reply.code(404).send(errorBody(request, 'SESSION_NOT_FOUND', 'Sessão expirada ou indisponível.'));
    return reply.header('cache-control', 'no-store').send(result);
  });

  app.put<{ Params: { sessionId: string }; Headers: { authorization?: string }; Body: Record<string, unknown> }>('/public/checkout-sessions/:sessionId/shipping', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Proteção de dados indisponível.'));
    const credentials = sessionCredentials(request.params.sessionId, request.headers.authorization); const postalCode = digits(request.body?.postalCode); const state = typeof request.body?.state === 'string' ? request.body.state.trim().toUpperCase() : ''; const read = (key: string, max: number) => typeof request.body?.[key] === 'string' && (request.body[key] as string).trim().length <= max ? (request.body[key] as string).trim() : '';
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
    const context = await gateways.paymentContext(credentials.sessionId, credentials.tokenHash, new Date()); if (!context) return reply.code(409).send(errorBody(request, 'CHECKOUT_INCOMPLETE', 'Confirme identificação, endereço e frete antes do pagamento.'));
    const encryptedCredentials = await gateways.credentials(context.checkout.storeId); if (!encryptedCredentials) return reply.code(409).send(errorBody(request, 'GATEWAY_UNAVAILABLE', 'A loja ainda não configurou a WestPay.'));
    const westpayCredentials = { apiKey: decryptSecret(encryptedCredentials.apiKeyEncrypted, environment.APP_ENCRYPTION_KEY), publicKey: decryptSecret(encryptedCredentials.publicKeyEncrypted, environment.APP_ENCRYPTION_KEY) };
    const amountCents = context.totalCents + context.shippingPriceCents; let attempt = await gateways.latestAttempt(context.id);
    if (attempt?.pixCodeEncrypted && attempt.status === 'PENDING') return reply.header('cache-control', 'no-store').send({ payment: { publicId: attempt.publicId, status: 'pending', amountCents: attempt.amountCents, pixCode: decryptSecret(attempt.pixCodeEncrypted, environment.APP_ENCRYPTION_KEY), expiresAt: attempt.expiresAt } });
    if (!attempt || attempt.status !== 'PENDING') attempt = await gateways.createAttempt(context.id, amountCents, `westpay:${context.id}:${Date.now()}`);
    const externalRef = `solid-${attempt.publicId}`;
    try {
      const customer = JSON.parse(decryptSecret(context.customerDataEncrypted!, environment.APP_ENCRYPTION_KEY)) as Record<string, string>; const address = JSON.parse(decryptSecret(context.shippingAddressEncrypted!, environment.APP_ENCRYPTION_KEY)) as Record<string, string>;
      let transaction = await findWestPayPix(westpayCredentials, externalRef);
      if (!transaction) transaction = await createWestPayPix(westpayCredentials, {
        amount: amountCents,
        paymentMethod: 'pix',
        customer: { name: customer.name, email: customer.email, phone: digits(customer.phone), document: { number: digits(customer.document), type: digits(customer.document).length === 14 ? 'cnpj' : 'cpf' }, externalRef: context.publicId },
        items: context.items.map(item => ({ title: item.titleSnapshot, unitPrice: item.unitPriceCents, quantity: item.quantity, tangible: true, externalRef: item.productId })),
        shipping: { fee: context.shippingPriceCents, address: { street: address.street, streetNumber: address.number, complement: address.complement || undefined, zipCode: digits(address.postalCode), neighborhood: address.neighborhood, city: address.city, state: address.state, country: 'br' } },
        pix: { expiresInSeconds: Math.max(30, Math.min(1800, Math.floor((context.expiresAt.getTime() - Date.now()) / 1000))) },
        externalRef,
        postbackUrl: `${environment.API_PUBLIC_URL.replace(/\/$/, '')}/webhooks/westpay`,
        metadata: { checkoutSession: context.publicId, platform: 'solid' },
        ...(request.ip && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(request.ip) ? { ip: request.ip } : {})
      });
      if (!transaction.id || !transaction.pix?.qrcode) throw new Error('WestPay returned an incomplete PIX response');
      const expiresAt = transaction.pix.expiresAt ? new Date(transaction.pix.expiresAt) : null; const saved = await gateways.completeAttempt(attempt.id, transaction.id, encryptSecret(transaction.pix.qrcode, environment.APP_ENCRYPTION_KEY), expiresAt);
      return reply.header('cache-control', 'no-store').code(201).send({ payment: { ...saved, status: 'pending', pixCode: transaction.pix.qrcode } });
    } catch (error) { request.log.warn({ err: error, checkoutSession: context.publicId }, 'westpay_pix_creation_failed'); return reply.code(502).send(errorBody(request, 'WESTPAY_UNAVAILABLE', 'Não foi possível gerar o Pix agora. Tente novamente.')); }
  });

  app.post<{ Body: Record<string, unknown> }>('/webhooks/westpay', { config: { rateLimit: { max: 180, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!gateways || !environment.APP_ENCRYPTION_KEY) return reply.code(503).send();
    const objectId = typeof request.body?.objectId === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(request.body.objectId) ? request.body.objectId : null;
    if (!objectId) return reply.code(400).send();
    const context = await gateways.webhookContext(objectId); if (!context) return reply.code(200).send({ received: true });
    const encryptedCredentials = await gateways.credentials(context.session.checkout.storeId); if (!encryptedCredentials) return reply.code(200).send({ received: true });
    try {
      const official = await getWestPayPix({ apiKey: decryptSecret(encryptedCredentials.apiKeyEncrypted, environment.APP_ENCRYPTION_KEY), publicKey: decryptSecret(encryptedCredentials.publicKeyEncrypted, environment.APP_ENCRYPTION_KEY) }, objectId);
      if (!official || official.id !== objectId || official.amount !== context.amountCents) return reply.code(200).send({ received: true });
      const normalized = official.status.toUpperCase(); const mapped = normalized === 'PAID' ? 'PAID' : normalized === 'FAILED' ? 'FAILED' : normalized === 'CANCELLED' ? 'CANCELLED' : normalized === 'EXPIRED' ? 'EXPIRED' : normalized === 'REFUNDED' || normalized === 'PARTIALLY_REFUNDED' ? 'REFUNDED' : null;
      if (mapped) await gateways.confirmPayment(context.id, context.checkoutSessionId, mapped, mapped === 'PAID' ? new Date() : undefined);
      return reply.code(200).send({ received: true });
    } catch (error) { request.log.warn({ err: error, providerTransactionId: objectId }, 'westpay_webhook_verification_failed'); return reply.code(503).send(); }
  });

  app.post<{ Querystring: Record<string, string | string[] | undefined>; Body: Record<string, unknown> }>('/integrations/shopify/proxy/checkout-session', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!environment.SHOPIFY_CLIENT_SECRET || !validProxySignature(request.query, environment.SHOPIFY_CLIENT_SECRET)) return reply.code(401).send(errorBody(request, 'INVALID_PROXY_SIGNATURE', 'Solicitação Shopify inválida.'));
    const timestamp = typeof request.query.timestamp === 'string' ? Number(request.query.timestamp) : 0;
    const shopDomain = typeof request.query.shop === 'string' && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(request.query.shop) ? request.query.shop : null;
    const checkoutSlug = slug(request.body?.checkoutSlug); const rawLines = Array.isArray(request.body?.lines) ? request.body.lines : [];
    const lines = rawLines.flatMap(value => { if (typeof value !== 'object' || value === null) return []; const line = value as Record<string, unknown>; return typeof line.variantId === 'string' && /^\d{1,20}$/.test(line.variantId) && typeof line.quantity === 'number' && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 1000 ? [{ variantId: line.variantId, quantity: line.quantity }] : []; });
    if (!shopDomain || !checkoutSlug || rawLines.length < 1 || rawLines.length > 50 || lines.length !== rawLines.length || !Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Carrinho Shopify inválido.'));
    const token = randomBytes(32).toString('base64url');
    const session = await catalog.createShopifyCartSession({ shopDomain, checkoutSlug, lines, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000) });
    if (!session) return reply.code(409).send(errorBody(request, 'CHECKOUT_UNAVAILABLE', 'Checkout, produto ou estoque indisponível.'));
    return reply.header('cache-control', 'no-store').code(201).send({ session, token });
  });
}
