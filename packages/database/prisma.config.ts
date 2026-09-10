import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  // Client generation does not connect to a database. Database commands still
  // require a URL and fail when no datasource is configured.
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {})
});
