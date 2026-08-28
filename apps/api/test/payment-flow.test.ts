import { describe, expect, it, vi } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import type { CatalogRepository } from '../src/catalog-repository.js';
import type { PrismaGatewayRepository } from '../src/gateway-repository.js';
import { buildApp } from '../src/app.js';
import { encryptSecret } from '../src/shopify-crypto.js';
import { canTransitionPayment, type PaymentState } from '../src/payment-rules.js';

const { createRoasPix, getRoasPix } = vi.hoisted(() => ({ createRoasPix: vi.fn(), getRoasPix: vi.fn() }));
vi.mock('../src/roas-client.js', () => ({
  createRoasPix,
  getRoasPix,
  RoasRequestError: class RoasRequestError extends Error { constructor(readonly status: number, readonly details: readonly string[]) { super(`Roas request failed (${status})`); } }
}));

const key = Buffer.alloc(32, 7).toString('base64');
const env: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, API_PUBLIC_URL: 'https://api.solidcheckout.xyz', LOG_LEVEL: 'silent', CORS_ORIGINS: ['https://pay.solidcheckout.xyz'], TRUST_PROXY: false, APP_ENCRYPTION_KEY: key };
const token = 't'.repeat(43);

function fixture() {
  let paymentState: PaymentState = 'PENDING'; let completedAttempt: Record<string, unknown> | null = null; let confirmations = 0;
  const customer = encryptSecret(JSON.stringify({ name: 'Cliente Teste', email: 'cliente@example.com', phone: '11999999999', document: '49257810810' }), key);
  const credentials = { apiKeyEncrypted: encryptSecret('secret-key', key), publicKeyEncrypted: encryptSecret('public-key', key) };
  const context = { id: 'internal-session', publicId: 'session-public', totalCents: 500, discountCents: 0, shippingPriceCents: 0, customerDataEncrypted: customer, shippingAddressEncrypted: null, expiresAt: new Date(Date.now() + 600_000), quantity: 1, unitPriceCents: 500, checkout: { storeId: 'store-a', store: { name: 'Loja' }, product: { id: 'product-internal', checkoutTitle: 'Produto teste', fulfillmentType: 'DIGITAL' } }, items: [{ productId: 'product-internal', titleSnapshot: 'Produto teste', unitPriceCents: 500, quantity: 1 }] };
  const gateway = {
    paymentContext: vi.fn().mockResolvedValue(context), primaryProvider: vi.fn().mockResolvedValue('ROAS'),
    billingAccessAllowed: vi.fn().mockResolvedValue(true),
    credentials: vi.fn((_storeId: string, provider = 'WESTPAY') => Promise.resolve(provider === 'ROAS' ? credentials : null)),
    latestAttempt: vi.fn(() => Promise.resolve(completedAttempt)),
    createAttempt: vi.fn().mockResolvedValue({ id: 'attempt-internal', publicId: 'attempt-public', provider: 'ROAS', status: 'PENDING', amountCents: 500, pixCodeEncrypted: null, expiresAt: null }),
    completeAttempt: vi.fn((_id: string, _providerId: string, pixCodeEncrypted: string, expiresAt: Date | null) => { completedAttempt = { id: 'attempt-internal', publicId: 'attempt-public', provider: 'ROAS', status: 'PENDING', amountCents: 500, pixCodeEncrypted, expiresAt }; return Promise.resolve({ publicId: 'attempt-public', status: 'PENDING', amountCents: 500, expiresAt }); }),
    utmifyOrderContext: vi.fn().mockResolvedValue(null),
    webhookContext: vi.fn().mockResolvedValue({ id: 'attempt-internal', publicId: 'attempt-public', checkoutSessionId: 'internal-session', amountCents: 500, status: paymentState, session: { checkout: { storeId: 'store-a' } } }),
    recordWebhookEvent: vi.fn().mockResolvedValue(undefined),
    confirmPayment: vi.fn((_attemptId: string, _sessionId: string, next: Exclude<PaymentState, 'PENDING'>) => { if (canTransitionPayment(paymentState, next)) { paymentState = next; confirmations += 1; } return Promise.resolve(); })
  };
  return { gateway: gateway as unknown as PrismaGatewayRepository, catalog: {} as CatalogRepository, counters: () => ({ confirmations, paymentState }), raw: gateway };
}

describe('fluxo Pix integrado com Roas simulada', () => {
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

  it('ignora valor divergente e confirma uma única vez quando o webhook é repetido', async () => {
    const test = fixture(); const app = buildApp(env, { catalogRepository: test.catalog, gatewayRepository: test.gateway });
    getRoasPix.mockResolvedValueOnce({ id: 'roas-transaction', status: 'PAID', amount: 499 }).mockResolvedValue({ id: 'roas-transaction', status: 'PAID', amount: 500 });
    const request = { method: 'POST' as const, url: '/webhooks/roas', payload: { Id: 'roas-transaction' } };
    expect((await app.inject(request)).statusCode).toBe(200); expect(test.counters().confirmations).toBe(0);
    expect((await app.inject(request)).statusCode).toBe(200); expect((await app.inject(request)).statusCode).toBe(200); await app.close();
    expect(test.counters()).toEqual({ confirmations: 1, paymentState: 'PAID' });
  });
});
