import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client.js';

export * from '../generated/client/client.js';

export function createDatabaseClient(connectionString: string): PrismaClient {
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    throw new Error('DATABASE_URL deve usar PostgreSQL');
  }
  // Keep timestamp parameters consistent even when the host/database defaults to a local zone.
  const adapter = new PrismaPg({ connectionString, options: '-c timezone=UTC' });
  return new PrismaClient({ adapter });
}
