import { AuditActorType, createDatabaseClient, StoreRole } from '@solid/database';
import { hashPassword } from './password.js';

const databaseUrl = process.env['DATABASE_URL'];
const email = process.env['SOLID_RESET_EMAIL']?.trim().toLowerCase();
const password = process.env['SOLID_RESET_PASSWORD'];
const confirmation = process.env['SOLID_RESET_CONFIRM'];

if (!databaseUrl || !email || !password) {
  throw new Error('DATABASE_URL, SOLID_RESET_EMAIL e SOLID_RESET_PASSWORD são obrigatórias');
}
if (confirmation !== 'RESET_PASSWORD') {
  throw new Error('Reset recusado: defina SOLID_RESET_CONFIRM=RESET_PASSWORD');
}
if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) throw new Error('SOLID_RESET_EMAIL inválido');

const database = createDatabaseClient(databaseUrl);
try {
  const user = await database.user.findUnique({
    where: { email },
    select: { id: true, disabledAt: true, memberships: { select: { role: true } } },
  });
  const isAdministrator = user?.memberships.some(({ role }) => role === StoreRole.OWNER || role === StoreRole.ADMIN);
  if (!user || user.disabledAt || !isAdministrator) throw new Error('Reset recusado: administrador ativo não encontrado');

  const passwordHash = await hashPassword(password);
  const now = new Date();
  await database.$transaction([
    database.user.update({ where: { id: user.id }, data: { passwordHash } }),
    database.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } }),
    database.auditLog.create({ data: {
      actorType: AuditActorType.SYSTEM,
      action: 'auth.admin_password_reset',
      targetType: 'user',
      targetId: user.id,
      metadata: { source: 'one_time_cli', sessionsRevoked: true },
    } }),
  ]);
  process.stdout.write('Senha administrativa redefinida e sessões existentes revogadas. Remova imediatamente as variáveis SOLID_RESET_* do ambiente.\n');
} finally {
  await database.$disconnect();
}
