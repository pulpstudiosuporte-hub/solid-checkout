import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client.js';

export * from '../generated/client/client.js';

export function createDatabaseClient(connectionString: string): PrismaClient {
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    throw new Error('DATABASE_URL deve usar PostgreSQL');
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
