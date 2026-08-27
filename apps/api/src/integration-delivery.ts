import type { AppEnvironment } from '@solid/config';
import type { FastifyBaseLogger } from 'fastify';
import type { PrismaGatewayRepository } from './gateway-repository.js';
import { syncMetaEvent } from './meta-sync.js';
import { syncUtmifyOrder } from './utmify-sync.js';

const utmifyEvents = ['waiting_payment', 'paid', 'refunded', 'refused'] as const;
const metaEvents = ['InitiateCheckout', 'AddPaymentInfo', 'Purchase'] as const;

export function startIntegrationDelivery(environment: AppEnvironment, repository: PrismaGatewayRepository, log: FastifyBaseLogger): () => void {
  if (!environment.APP_ENCRYPTION_KEY) { log.info('integration_delivery_disabled'); return () => undefined; }
  let running = false;
  const run = async () => {
    if (running) return; running = true;
    try {
      const jobs = await repository.claimPendingIntegrationDeliveries(new Date());
      for (const job of jobs) {
        if (job.provider === 'UTMIFY' && utmifyEvents.includes(job.event as typeof utmifyEvents[number])) await syncUtmifyOrder(environment, repository, job.checkoutSessionId, job.event as typeof utmifyEvents[number], log, true);
        else if (job.provider === 'META' && metaEvents.includes(job.event as typeof metaEvents[number])) await syncMetaEvent(environment, repository, job.checkoutSessionId, job.event as typeof metaEvents[number], log, true);
        else {
          await repository.discardIntegrationDelivery(job.publicId, `Entrega inválida: ${job.provider}/${job.event}`);
          log.error({ deliveryJobId: job.publicId, provider: job.provider, event: job.event }, 'integration_delivery_invalid_job');
        }
      }
    } catch (error) { log.error({ err: error }, 'integration_delivery_worker_failed'); }
    finally { running = false; }
  };
  void run(); const interval = setInterval(() => void run(), 30_000); interval.unref(); return () => clearInterval(interval);
}
