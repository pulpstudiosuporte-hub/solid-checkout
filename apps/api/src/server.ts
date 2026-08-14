import { parseEnvironment } from '@solid/config';
import { buildApp } from './app.js';
import { createDatabaseClient } from '@solid/database';
import { PrismaAuthRepository } from './auth-repository.js';

const environment = parseEnvironment(process.env);
if (!environment.DATABASE_URL) throw new Error('DATABASE_URL é obrigatória para iniciar a API');
const database = createDatabaseClient(environment.DATABASE_URL);
const app = buildApp(environment, { authRepository: new PrismaAuthRepository(database) });

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutdown_started');
  await app.close();
  await database.$disconnect();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
} catch (error: unknown) {
  const safeError = error instanceof Error ? error : new Error('Unknown startup error');
  app.log.fatal({ err: safeError }, 'startup_failed');
  process.exit(1);
}
