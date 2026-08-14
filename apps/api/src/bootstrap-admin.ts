import { createDatabaseClient, StoreRole } from '@solid/database';
import { hashPassword } from './password.js';

const databaseUrl = process.env['DATABASE_URL'];
const email = process.env['SOLID_ADMIN_EMAIL']?.trim().toLowerCase();
const password = process.env['SOLID_ADMIN_PASSWORD'];
const name = process.env['SOLID_ADMIN_NAME']?.trim();
const storeName = process.env['SOLID_STORE_NAME']?.trim() ?? 'Solid Store';
const storeSlug = process.env['SOLID_STORE_SLUG']?.trim() ?? 'solid-store';

if (!databaseUrl || !email || !password || !name) throw new Error('DATABASE_URL, SOLID_ADMIN_EMAIL, SOLID_ADMIN_PASSWORD e SOLID_ADMIN_NAME são obrigatórias');
if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) throw new Error('SOLID_ADMIN_EMAIL inválido');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(storeSlug)) throw new Error('SOLID_STORE_SLUG inválido');

const database = createDatabaseClient(databaseUrl);
try {
  const existingUsers = await database.user.count();
  if (existingUsers > 0) throw new Error('Bootstrap recusado: já existe um usuário no banco');
  const passwordHash = await hashPassword(password);
  await database.user.create({ data: {
    email, name, passwordHash, emailVerifiedAt: new Date(),
    memberships: { create: { role: StoreRole.OWNER, store: { create: { name: storeName, slug: storeSlug } } } }
  } });
  process.stdout.write('Administrador inicial criado. Remova imediatamente as variáveis SOLID_ADMIN_* do ambiente.\n');
} finally { await database.$disconnect(); }
