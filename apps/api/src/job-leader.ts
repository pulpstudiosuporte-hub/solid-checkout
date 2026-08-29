import { Client } from 'pg';
import type { FastifyBaseLogger } from 'fastify';

const LOCK_ID = 7_316_644_903;

/**
 * Keeps a PostgreSQL advisory lock for the lifetime of the background-job
 * leader. Only one API replica can own this lock at a time.
 */
export function startJobLeader(databaseUrl: string, log: FastifyBaseLogger, start: () => () => void): () => void {
  let stopped = false;
  let client: Client | null = null;
  let stopJobs: (() => void) | null = null;
  let retry: NodeJS.Timeout | null = null;

  const relinquish = (): void => {
    stopJobs?.();
    stopJobs = null;
    if (client) void client.end().catch(() => undefined);
    client = null;
  };

  const elect = async (): Promise<void> => {
    if (stopped || client) return;
    const candidate = new Client({ connectionString: databaseUrl, application_name: 'solid-job-leader' });
    try {
      await candidate.connect();
      const result = await candidate.query<{ acquired: boolean }>('SELECT pg_try_advisory_lock($1) AS acquired', [LOCK_ID]);
      if (!result.rows[0]?.acquired) {
        await candidate.end();
        retry = setTimeout(() => void elect(), 30_000);
        retry.unref();
        return;
      }
      client = candidate;
      candidate.once('error', error => {
        log.error({ err: error }, 'background_job_leader_connection_lost');
        relinquish();
        if (!stopped) { retry = setTimeout(() => void elect(), 5_000); retry.unref(); }
      });
      stopJobs = start();
      log.info('background_job_leader_acquired');
    } catch (error) {
      await candidate.end().catch(() => undefined);
      log.error({ err: error }, 'background_job_leader_election_failed');
      if (!stopped) { retry = setTimeout(() => void elect(), 15_000); retry.unref(); }
    }
  };

  void elect();
  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    relinquish();
  };
}
