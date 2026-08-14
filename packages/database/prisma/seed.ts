import { createDatabaseClient, StoreRole } from '../src/index.js';

const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL é obrigatória para executar o seed');
if (process.env['NODE_ENV'] === 'production') throw new Error('Seed de demonstração proibido em produção');

const database = createDatabaseClient(url);
try {
  await database.user.upsert({
    where: { email: 'owner@solid.local' },
    update: {},
    create: {
      email: 'owner@solid.local', name: 'Owner de desenvolvimento',
      memberships: { create: { role: StoreRole.OWNER, store: { create: { name: 'Solid Demo', slug: 'solid-demo' } } } }
    }
  });
} finally {
  await database.$disconnect();
}
