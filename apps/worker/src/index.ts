import { parseEnvironment } from '@solid/config';

const environment = parseEnvironment(process.env);
let stopping = false;

function shutdown(signal: string): void {
  if (stopping) return;
  stopping = true;
  process.stdout.write(`${JSON.stringify({ level: 'info', service: 'solid-worker', signal, message: 'shutdown_complete' })}\n`);
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.stdout.write(`${JSON.stringify({ level: environment.LOG_LEVEL, service: 'solid-worker', environment: environment.NODE_ENV, message: 'worker_ready_no_queues_registered' })}\n`);
