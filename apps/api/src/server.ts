import { parseEnvironment } from '@solid/config';
import { buildApp } from './app.js';

const environment = parseEnvironment(process.env);
const app = buildApp(environment);

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutdown_started');
  await app.close();
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
