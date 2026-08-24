import type { AppEnvironment } from '@solid/config';
import type { FastifyBaseLogger } from 'fastify';
import type { ShopifyRepository } from './shopify-repository.js';
import { syncPaidShopifyOrder } from './shopify-order-sync.js';

export function startShopifyOrderReconciliation(environment: AppEnvironment, shopify: ShopifyRepository, log: FastifyBaseLogger): () => void {
  let running = false;
  const reconcile = async () => {
    if (running) return;
    running = true;
    try {
      const pending = await shopify.paidOrdersAwaitingSync(new Date());
      for (const checkoutSessionId of pending) {
        try { await syncPaidShopifyOrder(environment, shopify, checkoutSessionId); }
        catch (error) { log.warn({ err: error, checkoutSessionId }, 'shopify_order_reconciliation_item_failed'); }
      }
    } catch (error) { log.error({ err: error }, 'shopify_order_reconciliation_failed'); }
    finally { running = false; }
  };
  void reconcile();
  const interval = setInterval(() => void reconcile(), 60_000);
  interval.unref();
  return () => clearInterval(interval);
}
