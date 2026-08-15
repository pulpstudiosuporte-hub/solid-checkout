import { AuditActorType, createDatabaseClient, StoreRole } from '@solid/database';

const databaseUrl = process.env['DATABASE_URL'];
const email = process.env['SOLID_ROLE_EMAIL']?.trim().toLowerCase();
const storeSlug = process.env['SOLID_ROLE_STORE_SLUG']?.trim().toLowerCase();
const confirmation = process.env['SOLID_ROLE_CONFIRM'];

if (!databaseUrl || !email || !storeSlug) {
  throw new Error('DATABASE_URL, SOLID_ROLE_EMAIL e SOLID_ROLE_STORE_SLUG são obrigatórias');
}
if (confirmation !== 'PROMOTE_TO_OWNER') {
  throw new Error('Promoção recusada: defina SOLID_ROLE_CONFIRM=PROMOTE_TO_OWNER');
}
if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) throw new Error('SOLID_ROLE_EMAIL inválido');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(storeSlug) || storeSlug.length > 80) throw new Error('SOLID_ROLE_STORE_SLUG inválido');

const database = createDatabaseClient(databaseUrl);
try {
  const membership = await database.storeMember.findFirst({
    where: { user: { email, disabledAt: null }, store: { slug: storeSlug, active: true } },
    select: { id: true, userId: true, storeId: true, role: true },
  });
  if (!membership) throw new Error('Promoção recusada: usuário ativo ou loja não encontrados');

  await database.$transaction([
    database.storeMember.update({ where: { id: membership.id }, data: { role: StoreRole.OWNER } }),
    database.auditLog.create({ data: {
      storeId: membership.storeId,
      actorType: AuditActorType.SYSTEM,
      action: 'store.member_promoted_to_owner',
      targetType: 'store_member',
      targetId: membership.id,
      metadata: { source: 'one_time_cli', userId: membership.userId, previousRole: membership.role },
    } }),
  ]);
  process.stdout.write('Usuário promovido a proprietário da loja. Remova imediatamente as variáveis SOLID_ROLE_* do ambiente.\n');
} finally {
  await database.$disconnect();
}
