import type { AppEnvironment } from '@solid/config';
import type { FastifyBaseLogger } from 'fastify';
import { decryptSecret } from './shopify-crypto.js';
import type { PaymentProvider, PrismaGatewayRepository } from './gateway-repository.js';
import { mapProviderPaymentStatus, providerAmountMatches } from './payment-rules.js';
import { getRoasPix, RoasRequestError } from './roas-client.js';
import { getWestPayPix } from './westpay-client.js';

export function startPaymentReconciliation(environment: AppEnvironment, gateways: PrismaGatewayRepository, provider: PaymentProvider, log: FastifyBaseLogger): () => void {
  if (!environment.APP_ENCRYPTION_KEY) return () => undefined;
  let running = false;
  const reconcile = async () => {
    if (running) return;
    running = true;
    try {
      const attempts = await gateways.pendingPaymentVerifications(new Date(0), provider);
      for (const attempt of attempts) {
        try {
          await gateways.resumeSavedCreation(attempt.id);
          const encrypted = await gateways.credentials(attempt.session.checkout.storeId, provider);
          if (!encrypted) { await gateways.rescheduleVerification(attempt.id, 15 * 60_000); continue; }
          const key = decryptSecret(encrypted.apiKeyEncrypted, environment.APP_ENCRYPTION_KEY!);
          const publicKey = decryptSecret(encrypted.publicKeyEncrypted, environment.APP_ENCRYPTION_KEY!);
          const payment = provider === 'ROAS' ? await getRoasPix({ secretKey: key, publicKey }, attempt.providerTransactionId) : await getWestPayPix({ apiKey: key, publicKey }, attempt.providerTransactionId);
          if (!payment || payment.id !== attempt.providerTransactionId || !providerAmountMatches(payment.amount, attempt.amountCents)) {
            log.warn({ paymentAttemptId: attempt.id, provider }, 'payment_reconciliation_unverified');
            await gateways.rescheduleVerification(attempt.id, 5 * 60_000, true);
            continue;
          }
          if (payment.status.toUpperCase() === 'PARTIALLY_REFUNDED') await gateways.recordPartialRefund(attempt.id, attempt.checkoutSessionId, payment.refundedAmountCents);
          else {
            const status = mapProviderPaymentStatus(payment.status);
            if (status) await gateways.confirmPayment(attempt.id, attempt.checkoutSessionId, status, status === 'PAID' ? new Date() : undefined);
          }
          await gateways.rescheduleVerification(attempt.id, 2 * 60_000);
          if (Date.now() - attempt.createdAt.getTime() > 24 * 60 * 60_000) log.warn({ paymentAttemptId: attempt.id, provider }, 'payment_pending_over_24h');
        } catch (error) {
          const base = error instanceof RoasRequestError && error.status === 429 ? 60_000 : 30_000;
          await gateways.rescheduleVerification(attempt.id, Math.min(15 * 60_000, base * 2 ** Math.min((attempt.verificationFailures ?? 0) + 1, 5)), true);
          log.warn({ err: error, paymentAttemptId: attempt.id, provider }, 'payment_reconciliation_item_failed');
        }
      }
    } catch (error) { log.error({ err: error, provider }, 'payment_reconciliation_failed'); }
    finally { running = false; }
  };
  void reconcile();
  const interval = setInterval(() => void reconcile(), 60_000);
  interval.unref();
  return () => clearInterval(interval);
}
