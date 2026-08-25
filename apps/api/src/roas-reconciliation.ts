import type { AppEnvironment } from '@solid/config';
import type { FastifyBaseLogger } from 'fastify';
import { decryptSecret } from './shopify-crypto.js';
import { PrismaGatewayRepository } from './gateway-repository.js';
import type { ShopifyRepository } from './shopify-repository.js';
import { syncPaidShopifyOrder } from './shopify-order-sync.js';
import { getRoasPix } from './roas-client.js';

const statusOf = (value: string | undefined) => {
  const status = value?.toUpperCase();
  if (['PAID', 'APPROVED', 'CONFIRMED', 'COMPLETED', 'SUCCESS', 'SUCCEEDED', 'SETTLED'].includes(status ?? '')) return 'PAID' as const;
  if (['FAILED', 'ERROR', 'REFUSED'].includes(status ?? '')) return 'FAILED' as const;
  if (status === 'CANCELLED') return 'CANCELLED' as const;
  if (status === 'EXPIRED') return 'EXPIRED' as const;
  if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(status ?? '')) return 'REFUNDED' as const;
  return null;
};

const isPendingStatus = (value: string | undefined): boolean => ['PENDING', 'PROCESSING', 'WAITING_PAYMENT'].includes(value?.toUpperCase() ?? '');
const amountMatches = (providerAmount: number | undefined, expectedCents: number): boolean => Number(providerAmount) === expectedCents || Number(providerAmount) * 100 === expectedCents;

export function startRoasReconciliation(environment: AppEnvironment, gateways: PrismaGatewayRepository, shopify: ShopifyRepository, log: FastifyBaseLogger): () => void {
  if (!environment.APP_ENCRYPTION_KEY) return () => undefined;
  let running = false;
  const reconcile = async () => {
    if (running) return; running = true;
    try {
      const pending = await gateways.pendingPaymentVerifications(new Date(Date.now() - 24 * 60 * 60_000), 'ROAS');
      for (const attempt of pending) try {
        const credentials = await gateways.credentials(attempt.session.checkout.storeId, 'ROAS'); if (!credentials) continue;
        const payment = await getRoasPix({ secretKey: decryptSecret(credentials.apiKeyEncrypted, environment.APP_ENCRYPTION_KEY!), publicKey: decryptSecret(credentials.publicKeyEncrypted, environment.APP_ENCRYPTION_KEY!) }, attempt.providerTransactionId);
        const status = statusOf(payment?.status); const validAmount = payment && amountMatches(payment.amount, attempt.amountCents);
        if (payment && validAmount && isPendingStatus(payment.status)) continue;
        if (!status || !validAmount) { log.warn({ paymentAttemptId: attempt.id, providerStatus: payment?.status ?? null, providerAmount: payment?.amount ?? null, expectedAmountCents: attempt.amountCents }, 'roas_reconciliation_unrecognized_payment'); continue; }
        await gateways.confirmPayment(attempt.id, attempt.checkoutSessionId, status, status === 'PAID' ? new Date() : undefined);
        if (status === 'PAID') await syncPaidShopifyOrder(environment, shopify, attempt.checkoutSessionId);
      } catch (error) { log.warn({ err: error, paymentAttemptId: attempt.id }, 'roas_reconciliation_item_failed'); }
    } catch (error) { log.error({ err: error }, 'roas_reconciliation_failed'); } finally { running = false; }
  };
  void reconcile(); const interval = setInterval(() => void reconcile(), 60_000); interval.unref(); return () => clearInterval(interval);
}
