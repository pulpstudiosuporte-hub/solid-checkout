import type { AppEnvironment } from '@solid/config';
import type { FastifyBaseLogger } from 'fastify';
import type { PrismaGatewayRepository } from './gateway-repository.js';
import type { ShopifyRepository } from './shopify-repository.js';
import { startPaymentReconciliation } from './payment-reconciliation.js';
export function startRoasReconciliation(environment: AppEnvironment, gateways: PrismaGatewayRepository, _shopify: ShopifyRepository, log: FastifyBaseLogger): () => void {
  return startPaymentReconciliation(environment, gateways, 'ROAS', log);
}
