import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import type { CatalogRepository } from '../src/catalog-repository.js';
import type { PrismaGatewayRepository } from '../src/gateway-repository.js';
import { buildApp } from '../src/app.js';
import { RoasRequestError } from '../src/roas-client.js';
import { encryptSecret } from '../src/shopify-crypto.js';
import { canTransitionPayment, type PaymentState } from '../src/payment-rules.js';

const { createRoasPix, getRoasPix } = vi.hoisted(() => ({ createRoasPix: vi.fn(), getRoasPix: vi.fn() }));
const { createWestPayPix, findWestPayPix } = vi.hoisted(() => ({ createWestPayPix: vi.fn(), findWestPayPix: vi.fn() }));
vi.mock('../src/roas-client.js', () => ({
  createRoasPix,
  getRoasPix,
  RoasRequestError: class RoasRequestError extends Error { constructor(readonly status: number, readonly details: readonly string[]) { super(`Roas request failed (${status})`); } }
}));
vi.mock('../src/westpay-client.js', () => ({
  createWestPayPix,
  findWestPayPix,
  getWestPayPix: vi.fn(),
  WestPayRequestError: class WestPayRequestError extends Error { constructor(readonly status: number, readonly details: readonly string[]) { super(`WestPay request failed (${status})`); } }
}));

const key = Buffer.alloc(32, 7).toString('base64');
const env: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, API_PUBLIC_URL: 'https://api.solidcheckout.xyz', LOG_LEVEL: 'silent', CORS_ORIGINS: ['https://pay.solidcheckout.xyz'], TRUST_PROXY: false, APP_ENCRYPTION_KEY: key };
const token = 't'.repeat(43);
beforeEach(() => vi.clearAllMocks());

function fixture(document = '49257810810') {
  let reserved = false;
  let paymentState: PaymentState = 'PENDING'; let completedAttempt: Record<string, unknown> | null = null; let confirmations = 0;
  const customer = encryptSecret(JSON.stringify({ name: 'Cliente Teste', email: 'cliente@example.com', phone: '11999999999', document }), key);
  const credentials = { apiKeyEncrypted: encryptSecret('secret-key', key), publicKeyEncrypted: encryptSecret('public-key', key) };
  const context = { id: 'internal-session', publicId: 'session-public', totalCents: 500, discountCents: 0, shippingPriceCents: 0, customerDataEncrypted: customer, shippingAddressEncrypted: null, shippingMethodPublicId: null, expiresAt: new Date(Date.now() + 600_000), quantity: 1, unitPriceCents: 500, checkout: { storeId: 'store-a', store: { name: 'Loja' }, product: { id: 'product-internal', checkoutTitle: 'Produto teste', fulfillmentType: 'DIGITAL' } }, items: [{ productId: 'product-internal', titleSnapshot: 'Produto teste', unitPriceCents: 500, quantity: 1, product: { fulfillmentType: 'DIGITAL' } }] };
  const gateway = {
    paymentContext: vi.fn().mockResolvedValue(context), primaryProvider: vi.fn().mockResolvedValue('ROAS'), paymentProviders: vi.fn().mockResolvedValue(['ROAS']),
    billingAccessAllowed: vi.fn().mockResolvedValue(true),
    publicPaymentStatus: vi.fn().mockResolvedValue({ publicId: 'attempt-public', status: 'pending', amountCents: 500 }),
    publicPaymentVerification: vi.fn().mockRejectedValue(new Error('Provider verification must not run in a public read')),
    credentials: vi.fn(() => Promise.resolve(credentials)),
    latestAttempt: vi.fn(() => Promise.resolve(completedAttempt)),
    createAttempt: vi.fn((_sessionId: string, provider: 'ROAS' | 'WESTPAY', _amountCents: number, _key: string) => Promise.resolve({ id: `attempt-${provider.toLowerCase()}`, publicId: `attempt-${provider.toLowerCase()}-public`, provider, status: 'PENDING', amountCents: _amountCents, idempotencyKey: _key, pixCodeEncrypted: null, expiresAt: null })),
    claimPaymentCreation: vi.fn(async (_sessionId: string, provider: 'ROAS' | 'WESTPAY', amountCents: number) => {
      if (reserved) return { claimed: false, attempt: { id: 'reserved', publicId: 'reserved-public', status: 'PENDING', pixCodeEncrypted: null, amountCents } };
      reserved = true;
      const attempt = await gateway.createAttempt(_sessionId, provider, amountCents, 'stable-reservation-key');
      return { claimed: true, attempt };
    }),
    saveProviderResponse: vi.fn((_id: string, _providerId: string, pixCodeEncrypted: string, expiresAt: Date | null) => { completedAttempt = { id: 'attempt-internal', publicId: 'attempt-public', provider: 'ROAS', status: 'PENDING', amountCents: 500, pixCodeEncrypted, expiresAt }; return Promise.resolve(); }),
    markCreationUncertain: vi.fn().mockResolvedValue(undefined),
    recordPartialRefund: vi.fn().mockResolvedValue(undefined),
    completeAttempt: vi.fn((_id: string, _providerId: string, pixCodeEncrypted: string, expiresAt: Date | null) => { completedAttempt = { id: 'attempt-internal', publicId: 'attempt-public', provider: 'ROAS', status: 'PENDING', amountCents: 500, pixCodeEncrypted, expiresAt }; return Promise.resolve({ publicId: 'attempt-public', status: 'PENDING', amountCents: 500, expiresAt }); }),
    failAttempt: vi.fn(() => { reserved = false; return Promise.resolve(); }),
    utmifyOrderContext: vi.fn().mockResolvedValue(null),
    webhookContext: vi.fn().mockResolvedValue({ id: 'attempt-internal', publicId: 'attempt-public', checkoutSessionId: 'internal-session', amountCents: 500, status: paymentState, session: { checkout: { storeId: 'store-a' } } }),
    recordWebhookEvent: vi.fn().mockResolvedValue(undefined),
    confirmPayment: vi.fn((_attemptId: string, _sessionId: string, next: Exclude<PaymentState, 'PENDING'>) => { if (canTransitionPayment(paymentState, next)) { paymentState = next; confirmations += 1; } return Promise.resolve(); })
  };
  return { gateway: gateway as unknown as PrismaGatewayRepository, catalog: {} as CatalogRepository, context, counters: () => ({ confirmations, paymentState }), raw: gateway };
}

describe('fluxo Pix integrado com Roas simulada', () => {
  it('blocks concurrent creation before a provider response exists', async () => {
    const test = fixture();
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    createRoasPix.mockImplementation(async () => { await barrier; return { id: 'roas-single', pixCode: 'pix-single' }; });
    const app = buildApp(env, { catalogRepository: test.catalog, gatewayRepository: test.gateway });
    const request = { method: 'POST' as const, url: '/public/checkout-sessions/session-public/payments/westpay/pix', headers: { authorization: `Bearer ${token}` } };
    try {
      const first = app.inject(request);
      await vi.waitFor(() => expect(createRoasPix).toHaveBeenCalledTimes(1));
      expect((await app.inject(request)).statusCode).toBe(409);
      release();
      expect((await first).statusCode).toBe(201);
      expect(createRoasPix).toHaveBeenCalledTimes(1);
    } finally { release(); await app.close(); }
  });
  it('does not retry or fail over an uncertain provider response', async () => {
    const test = fixture(); test.raw.paymentProviders.mockResolvedValue(['ROAS', 'WESTPAY']);
    createRoasPix.mockRejectedValue(new Error('connection closed after request'));
    const app = buildApp(env, { catalogRepository: test.catalog, gatewayRepository: test.gateway });
    const request = { method: 'POST' as const, url: '/public/checkout-sessions/session-public/payments/westpay/pix', headers: { authorization: `Bearer ${token}` } };
    try {
      expect((await app.inject(request)).statusCode).toBe(503);
      expect((await app.inject(request)).statusCode).toBe(409);
      expect(createRoasPix).toHaveBeenCalledTimes(1);
      expect(createWestPayPix).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
  it('reuses a saved provider response after integration enqueueing fails', async () => {
    const test = fixture(); test.raw.completeAttempt.mockRejectedValueOnce(new Error('queue unavailable'));
    createRoasPix.mockResolvedValue({ id: 'roas-created', pixCode: 'original-pix' });
    const app = buildApp(env, { catalogRepository: test.catalog, gatewayRepository: test.gateway });
    const request = { method: 'POST' as const, url: '/public/checkout-sessions/session-public/payments/westpay/pix', headers: { authorization: `Bearer ${token}` } };
    try {
      expect((await app.inject(request)).statusCode).toBe(503);
      expect((await app.inject(request)).json<{payment:{pixCode:string}}>().payment.pixCode).toBe('original-pix');
      expect(createRoasPix).toHaveBeenCalledTimes(1);
    } finally { await app.close(); }
  });
  it('não aciona fallback se o Pix foi criado mas a persistência falhou', async () => {
    const test = fixture();
    test.raw.paymentProviders.mockResolvedValue(['ROAS', 'WESTPAY']);
    test.raw.completeAttempt.mockRejectedValueOnce(new Error('queue unavailable'));
    createRoasPix.mockResolvedValue({ id: 'roas-created', pixCode: 'pix-code' });
    const app = buildApp(env, { catalogRepository: test.catalog, gatewayRepository: test.gateway });
    const response = await app.inject({ method: 'POST', url: '/public/checkout-sessions/session-public/payments/westpay/pix', headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(503);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('PAYMENT_SAVE_FAILED');
    expect(createWestPayPix).not.toHaveBeenCalled();
    expect(test.raw.failAttempt).not.toHaveBeenCalled();
    await app.close();
  });
  it('consulta status somente no banco, sem consultar gateway nem integrações', async () => {
    const test = fixture();
    const app = buildApp(env, { catalogRepository: test.catalog, gatewayRepository: test.gateway });
    const response = await app.inject({ url: '/public/checkout-sessions/session-public/payments/latest', headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(200);
    expect(test.raw.publicPaymentStatus).toHaveBeenCalled();
    expect(test.raw.publicPaymentVerification).not.toHaveBeenCalled();
    expect(test.raw.credentials).not.toHaveBeenCalled();
    await app.close();
  });
  it('informa exatamente qual dado está pendente antes do pagamento', async () => {
    const test = fixture();
    const physicalItem = { ...test.context.items[0], product: { fulfillmentType: 'PHYSICAL' } };
    test.raw.paymentContext.mockResolvedValueOnce({ ...test.context, items: [physicalItem], shippingAddressEncrypted: null, shippingMethodPublicId: null });
    const app = buildApp(env, { catalogRepository: test.catalog, gatewayRepository: test.gateway });
    const addressResponse = await app.inject({ method: 'POST', url: '/public/checkout-sessions/session-public/payments/westpay/pix', headers: { authorization: `Bearer ${token}` } });
    test.raw.paymentContext.mockResolvedValueOnce({ ...test.context, items: [physicalItem], shippingAddressEncrypted: encryptSecret(JSON.stringify({ postalCode: '01310100' }), key), shippingMethodPublicId: null });
    const methodResponse = await app.inject({ method: 'POST', url: '/public/checkout-sessions/session-public/payments/westpay/pix', headers: { authorization: `Bearer ${token}` } });
    await app.close();
    expect(addressResponse.statusCode).toBe(409);
    expect(addressResponse.json<{ error: { code: string } }>().error.code).toBe('SHIPPING_ADDRESS_REQUIRED');
    expect(methodResponse.statusCode).toBe(409);
    expect(methodResponse.json<{ error: { code: string } }>().error.code).toBe('SHIPPING_METHOD_REQUIRED');
    expect(createRoasPix).not.toHaveBeenCalled();
  });

  it('exige CPF válido somente ao gerar a cobrança', async () => {
    const test = fixture('');
    const app = buildApp(env, { catalogRepository: test.catalog, gatewayRepository: test.gateway });
    const response = await app.inject({ method: 'POST', url: '/public/checkout-sessions/session-public/payments/westpay/pix', headers: { authorization: `Bearer ${token}` } });
    await app.close();
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('CPF_REQUIRED');
    expect(createRoasPix).not.toHaveBeenCalled();
  });

  it('envia ao gateway o total após cupom e desconto Pix, mais frete', async () => {
    const test = fixture();
    test.raw.paymentContext.mockResolvedValueOnce({ ...test.context, discountCents: 140, shippingPriceCents: 50 });
    createRoasPix.mockResolvedValue({ id: 'roas-discount', status: 'PENDING', amount: 410, pixCode: 'pix-discount' });
    const app = buildApp(env, { catalogRepository: test.catalog, gatewayRepository: test.gateway });
    const response = await app.inject({ method: 'POST', url: '/public/checkout-sessions/session-public/payments/westpay/pix', headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(201);
    const [, input] = createRoasPix.mock.calls[0] as [unknown, { amount: number }];
    expect(input.amount).toBe(410);
    expect(test.raw.createAttempt).toHaveBeenCalledWith('internal-session', 'ROAS', 410, expect.any(String));
    await app.close();
  });

  it('reutiliza a cobrança pendente em chamadas repetidas', async () => {
    createRoasPix.mockResolvedValue({ id: 'roas-transaction', status: 'PENDING', amount: 500, pixCode: 'pix-copia-e-cola' });
    const test = fixture(); const app = buildApp(env, { catalogRepository: test.catalog, gatewayRepository: test.gateway });
    const request = { method: 'POST' as const, url: '/public/checkout-sessions/session-public/payments/westpay/pix', headers: { authorization: `Bearer ${token}` } };
    const first = await app.inject(request); const second = await app.inject(request); await app.close();
    expect(first.statusCode).toBe(201); expect(second.statusCode).toBe(200);
    const firstBody = first.json<{ payment: { pixCode: string } }>(); const secondBody = second.json<{ payment: { pixCode: string } }>();
    expect(firstBody.payment.pixCode).toBe('pix-copia-e-cola'); expect(secondBody.payment.pixCode).toBe('pix-copia-e-cola');
    expect(createRoasPix).toHaveBeenCalledTimes(1); expect(test.raw.createAttempt).toHaveBeenCalledTimes(1);
  });

  it('usa o gateway de contingência quando o principal está indisponível', async () => {
    createRoasPix.mockRejectedValueOnce(new RoasRequestError(403, ['not authorized']));
    findWestPayPix.mockResolvedValue(null);
    createWestPayPix.mockResolvedValue({ id: 'westpay-transaction', pix: { qrcode: 'pix-contingencia', expiresAt: null } });
    const test = fixture(); test.raw.paymentProviders.mockResolvedValue(['ROAS', 'WESTPAY']);
    const app = buildApp(env, { catalogRepository: test.catalog, gatewayRepository: test.gateway });
    const response = await app.inject({ method: 'POST', url: '/public/checkout-sessions/session-public/payments/westpay/pix', headers: { authorization: `Bearer ${token}` } }); await app.close();
    expect(response.statusCode).toBe(201); expect(response.json<{ payment: { pixCode: string } }>().payment.pixCode).toBe('pix-contingencia');
    expect(createRoasPix).toHaveBeenCalledTimes(1); expect(createWestPayPix).toHaveBeenCalledTimes(1);
    expect(test.raw.failAttempt).toHaveBeenCalledWith('attempt-roas');
  });

  it('ignora valor divergente e confirma uma única vez quando o webhook é repetido', async () => {
    const test = fixture(); const app = buildApp(env, { catalogRepository: test.catalog, gatewayRepository: test.gateway });
    getRoasPix.mockResolvedValueOnce({ id: 'roas-transaction', status: 'PAID', amount: 499 }).mockResolvedValue({ id: 'roas-transaction', status: 'PAID', amount: 500 });
    const request = { method: 'POST' as const, url: '/webhooks/roas', payload: { Id: 'roas-transaction' } };
    expect((await app.inject(request)).statusCode).toBe(200); expect(test.counters().confirmations).toBe(0);
    expect((await app.inject(request)).statusCode).toBe(200); expect((await app.inject(request)).statusCode).toBe(200); await app.close();
    expect(test.counters()).toEqual({ confirmations: 1, paymentState: 'PAID' });
  });
});
