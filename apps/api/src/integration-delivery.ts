import type { AppEnvironment } from '@solid/config';
import type { FastifyBaseLogger } from 'fastify';
import type { PendingIntegrationDelivery, PrismaGatewayRepository } from './gateway-repository.js';
import type { ShopifyRepository } from './shopify-repository.js';
import type { DeliveryProvider } from './payment-delivery.js';
import { syncPaidShopifyOrder } from './shopify-order-sync.js';
import { syncMetaEvent } from './meta-sync.js';
import { syncUtmifyOrder } from './utmify-sync.js';

const utmifyEvents = ['waiting_payment', 'paid', 'refunded', 'refused'] as const;
const metaEvents = ['InitiateCheckout', 'AddPaymentInfo', 'Purchase'] as const;

export async function deliverIntegrationJob(environment: AppEnvironment, repository: PrismaGatewayRepository, log: FastifyBaseLogger, job: PendingIntegrationDelivery, shopify?: ShopifyRepository): Promise<void> {
  const valid = job.provider === 'UTMIFY' && utmifyEvents.includes(job.event as typeof utmifyEvents[number])
    || job.provider === 'META' && metaEvents.includes(job.event as typeof metaEvents[number])
    || job.provider === 'SHOPIFY' && ['created', 'paid'].includes(job.event)
    || job.provider === 'SOLID' && job.event === 'pix_created';
  if (!valid) { await repository.discardIntegrationDelivery(job.publicId, `Entrega inválida: ${job.provider}/${job.event}`); return; }
  const provider = job.provider as DeliveryProvider;
  try {
    if (provider === 'UTMIFY') {
      const state = await repository.deliveryPaymentStatus(job.checkoutSessionId);
      // Never replay waiting/refused after payment or paid after refund.
      const obsolete = job.event === 'waiting_payment' && state !== 'PENDING'
        || job.event === 'paid' && state === 'REFUNDED'
        || job.event === 'refused' && !['FAILED', 'CANCELLED', 'EXPIRED'].includes(state ?? '');
      if (obsolete) { await repository.markIntegrationDeliverySuccess(job.storeId, job.checkoutSessionId, provider, job.event); return; }
      await syncUtmifyOrder(environment, repository, job.checkoutSessionId, job.event as typeof utmifyEvents[number], log, true);
    } else if (provider === 'META') {
      await syncMetaEvent(environment, repository, job.checkoutSessionId, job.event as typeof metaEvents[number], log, true);
    } else {
      if (provider === 'SHOPIFY') {
        if (!shopify) throw new Error('Shopify repository unavailable');
        await syncPaidShopifyOrder(environment, shopify, job.checkoutSessionId);
      } else {
        const attempt = await repository.latestAttempt(job.checkoutSessionId);
        if (!attempt?.pixCodeEncrypted || !['ROAS', 'WESTPAY'].includes(attempt.provider)) throw new Error('Pix indisponível para notificação');
        await repository.recordPendingPayment(attempt.id, attempt.provider as 'ROAS' | 'WESTPAY', job.publicId);
      }
      await repository.markIntegrationDeliverySuccess(job.storeId, job.checkoutSessionId, provider, job.event);
    }
  } catch (error) {
    await repository.markIntegrationDeliveryFailure(job.storeId, job.checkoutSessionId, provider, job.event, error instanceof Error ? error.message : 'Falha de entrega');
    log.warn({ err: error, deliveryJobId: job.publicId }, 'integration_delivery_item_failed');
  }
}

export function startIntegrationDelivery(environment: AppEnvironment, repository: PrismaGatewayRepository, log: FastifyBaseLogger, shopify?: ShopifyRepository): () => void {
  if (!environment.APP_ENCRYPTION_KEY) { log.info('integration_delivery_disabled'); return () => undefined; }
  let running = false;
  const run = async () => {
    if (running) return; running = true;
    try {
      const jobs = await repository.claimPendingIntegrationDeliveries(new Date());
      for (const job of jobs) {
        await deliverIntegrationJob(environment, repository, log, job, shopify);
      }
    } catch (error) { log.error({ err: error }, 'integration_delivery_worker_failed'); }
    finally { running = false; }
  };
  void run(); const interval = setInterval(() => void run(), 30_000); interval.unref(); return () => clearInterval(interval);
}
