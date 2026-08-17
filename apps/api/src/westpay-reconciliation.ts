import type { AppEnvironment } from '@solid/config';
import type { FastifyBaseLogger } from 'fastify';
import { decryptSecret } from './shopify-crypto.js';
import { PrismaGatewayRepository } from './gateway-repository.js';
import type { ShopifyRepository } from './shopify-repository.js';
import { syncPaidShopifyOrder } from './shopify-order-sync.js';
import { getWestPayPix } from './westpay-client.js';

const paymentStatus = (value: string | undefined) => {
  const status = value?.toUpperCase();
  if (['PAID', 'APPROVED', 'CONFIRMED', 'COMPLETED', 'SUCCESS'].includes(status ?? '')) return 'PAID' as const;
  if (status === 'FAILED') return 'FAILED' as const;
  if (status === 'CANCELLED') return 'CANCELLED' as const;
  if (status === 'EXPIRED') return 'EXPIRED' as const;
  if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(status ?? '')) return 'REFUNDED' as const;
  return null;
};

export function startWestPayReconciliation(environment: AppEnvironment, gateways: PrismaGatewayRepository, shopify: ShopifyRepository, log: FastifyBaseLogger): () => void {
  if (!environment.APP_ENCRYPTION_KEY) return () => undefined;
  let running = false;
  const reconcile = async () => {
    if (running) return;
    running = true;
    try {
      const pending = await gateways.pendingPaymentVerifications(new Date(Date.now() - 24 * 60 * 60_000));
      for (const attempt of pending) {
        try {
          const credentials = await gateways.credentials(attempt.session.checkout.storeId);
          if (!credentials) continue;
          const payment = await getWestPayPix({ apiKey: decryptSecret(credentials.apiKeyEncrypted, environment.APP_ENCRYPTION_KEY!), publicKey: decryptSecret(credentials.publicKeyEncrypted, environment.APP_ENCRYPTION_KEY!) }, attempt.providerTransactionId);
          const status = paymentStatus(payment?.status);
          if (!status || payment?.amount !== attempt.amountCents) continue;
          await gateways.confirmPayment(attempt.id, attempt.checkoutSessionId, status, status === 'PAID' ? new Date() : undefined);
          if (status === 'PAID') await syncPaidShopifyOrder(environment, shopify, attempt.checkoutSessionId);
        } catch (error) { log.warn({ err: error, paymentAttemptId: attempt.id }, 'westpay_reconciliation_item_failed'); }
      }
    } catch (error) { log.error({ err: error }, 'westpay_reconciliation_failed'); }
    finally { running = false; }
  };
  void reconcile();
  const interval = setInterval(() => void reconcile(), 60_000);
  interval.unref();
  return () => clearInterval(interval);
}
