import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@solid/database';
import type { AppEnvironment } from '@solid/config';
import type { FastifyBaseLogger } from 'fastify';
import { PrismaGatewayRepository, type PendingIntegrationDelivery } from '../src/gateway-repository.js';
import { deliverIntegrationJob } from '../src/integration-delivery.js';

const { syncUtmifyOrder, syncMetaEvent } = vi.hoisted(() => ({ syncUtmifyOrder: vi.fn(), syncMetaEvent: vi.fn() }));
vi.mock('../src/utmify-sync.js', () => ({ syncUtmifyOrder }));
vi.mock('../src/meta-sync.js', () => ({ syncMetaEvent }));
const environment: AppEnvironment = { NODE_ENV: 'test', API_HOST: 'localhost', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: [], TRUST_PROXY: false };
const log = { warn: vi.fn() } as unknown as FastifyBaseLogger;

describe('fila persistente após gerar Pix', () => {
  it('grava pagamento e entregas na mesma transação, sem fazer chamadas externas', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 4 });
    const transaction = {
      paymentAttempt: { update: vi.fn().mockResolvedValue({ checkoutSessionId: 'session-a', publicId: 'payment-a', status: 'PENDING', amountCents: 500, expiresAt: null }) },
      checkoutSession: { findUniqueOrThrow: vi.fn().mockResolvedValue({ source: 'SHOPIFY', checkout: { storeId: 'store-a', store: { gatewayConnections: [{ provider: 'UTMIFY' }, { provider: 'META' }] } } }) },
      integrationDeliveryJob: { createMany }
    };
    const database = { $transaction: vi.fn((fn: (tx: typeof transaction) => unknown) => fn(transaction)) };
    const repository = new PrismaGatewayRepository(database as unknown as PrismaClient);
    const result = await repository.completeAttempt('attempt-a', 'provider-id', 'encrypted-pix', null);
    expect(result).toEqual({ publicId: 'payment-a', status: 'PENDING', amountCents: 500, expiresAt: null });
    expect(database.$transaction).toHaveBeenCalledTimes(1);
    const [query] = createMany.mock.calls[0] as [{ data: object[]; skipDuplicates: boolean }];
    expect(query.skipDuplicates).toBe(true);
    expect(query.data).toMatchObject([
      { storeId: 'store-a', checkoutSessionId: 'session-a', provider: 'UTMIFY', event: 'waiting_payment' },
      { provider: 'META', event: 'AddPaymentInfo' }, { provider: 'SHOPIFY', event: 'created' }, { provider: 'SOLID', event: 'pix_created' }
    ]);
    // The transaction must reject if the durable queue could not be written.
    createMany.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(repository.completeAttempt('attempt-a', 'provider-id', 'encrypted-pix', null)).rejects.toThrow('database unavailable');
  });
  it.each([
    ['PAID', 'waiting_payment'], ['PAID', 'refused'], ['REFUNDED', 'waiting_payment'], ['REFUNDED', 'paid'], ['PENDING', 'refused']
  ])('não reenvia %s como %s', async (status, event) => {
    syncUtmifyOrder.mockClear();
    const repository = { deliveryPaymentStatus: vi.fn().mockResolvedValue(status), markIntegrationDeliverySuccess: vi.fn().mockResolvedValue(undefined) };
    const job: PendingIntegrationDelivery = { id: 'job-a', publicId: 'public-job', storeId: 'store-a', checkoutSessionId: 'session-a', provider: 'UTMIFY', event, attempts: 0 };
    await deliverIntegrationJob(environment, repository as unknown as PrismaGatewayRepository, log, job);
    expect(syncUtmifyOrder).not.toHaveBeenCalled();
    expect(repository.markIntegrationDeliverySuccess).toHaveBeenCalledWith('store-a', 'session-a', 'UTMIFY', event);
  });
  it('mantém a entrega em retry quando a integração falha', async () => {
    syncMetaEvent.mockRejectedValueOnce(new Error('provider offline'));
    const repository = { markIntegrationDeliveryFailure: vi.fn().mockResolvedValue(undefined) };
    const job: PendingIntegrationDelivery = { id: 'job-a', publicId: 'public-job', storeId: 'store-a', checkoutSessionId: 'session-a', provider: 'META', event: 'AddPaymentInfo', attempts: 0 };
    await deliverIntegrationJob(environment, repository as unknown as PrismaGatewayRepository, log, job);
    expect(repository.markIntegrationDeliveryFailure).toHaveBeenCalledWith('store-a', 'session-a', 'META', 'AddPaymentInfo', 'provider offline');
  });
});
