import { parseEnvironment } from '@solid/config';
import { buildApp } from './app.js';
import { createDatabaseClient } from '@solid/database';
import { PrismaAuthRepository } from './auth-repository.js';
import { registerAdminOperationRoutes } from './admin-operation-routes.js';
import { PrismaCatalogRepository } from './catalog-repository.js';
import { PrismaStoreRepository } from './store-repository.js';
import { PrismaShopifyRepository } from './shopify-repository.js';
import { PrismaGatewayRepository } from './gateway-repository.js';
import { PrismaOrderRepository } from './order-repository.js';
import { startWestPayReconciliation } from './westpay-reconciliation.js';
import { startRoasReconciliation } from './roas-reconciliation.js';
import { startShopifyOrderReconciliation } from './shopify-order-reconciliation.js';
import { startConfirmationEmailDelivery } from './confirmation-email.js';
import { startIntegrationDelivery } from './integration-delivery.js';
import { startSecurityCleanup } from './security-cleanup.js';
import { startAbandonedRecovery } from './abandoned-recovery.js';
import { createStorePushDispatcher } from './web-push-service.js';
import { startJobLeader } from './job-leader.js';

const environment = parseEnvironment(process.env);
if (!environment.DATABASE_URL) throw new Error('DATABASE_URL é obrigatória para iniciar a API');
const database = createDatabaseClient(environment.DATABASE_URL);
const gatewayRepository = new PrismaGatewayRepository(database);
const shopifyRepository = new PrismaShopifyRepository(database);
const app = buildApp(environment, { authRepository: new PrismaAuthRepository(database), catalogRepository: new PrismaCatalogRepository(database), storeRepository: new PrismaStoreRepository(database), shopifyRepository, gatewayRepository, orderRepository: new PrismaOrderRepository(database), database });
gatewayRepository.setPushDispatcher(createStorePushDispatcher(environment, database, app.log));
const stopJobLeader = startJobLeader(environment.DATABASE_URL, app.log, () => {
  const stops = [
    startWestPayReconciliation(environment, gatewayRepository, shopifyRepository, app.log),
    startRoasReconciliation(environment, gatewayRepository, shopifyRepository, app.log),
    startShopifyOrderReconciliation(environment, shopifyRepository, app.log),
    startConfirmationEmailDelivery(environment, database, app.log),
    startIntegrationDelivery(environment, gatewayRepository, app.log),
    startSecurityCleanup(database, app.log),
    startAbandonedRecovery(environment, database, app.log)
  ];
  return () => stops.forEach(stop => stop());
});

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutdown_started');
  stopJobLeader();
  await app.close();
  await database.$disconnect();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

const adminAuthRepository = new PrismaAuthRepository(database);

try {
  registerAdminOperationRoutes(app, environment, adminAuthRepository, database);
  await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
} catch (error: unknown) {
  const safeError = error instanceof Error ? error : new Error('Unknown startup error');
  app.log.fatal({ err: safeError }, 'startup_failed');
  process.exit(1);
}
