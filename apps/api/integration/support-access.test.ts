import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient } from '@solid/database';
import { PrismaAuthRepository } from '../src/auth-repository.js';
import { hashToken } from '../src/admin-access.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must name an isolated *_test database.');
const db = createDatabaseClient(url);
const auth = new PrismaAuthRepository(db);
const suffix = randomUUID();
let roleId: string, operatorId: string, customerId: string, parentId: string;
const childToken = `support-${suffix}`;
const expiry = new Date(Date.now() + 1800000);
beforeAll(async () => {
  const role = await db.platformRole.create({ data: { name: `Support test ${suffix}`, permissions: ['users.read', 'support.read', 'support.write'] } }); roleId = role.id;
  const operator = await db.user.create({ data: { name: 'Test operator', email: `operator-${suffix}@example.test`, accountStatus: 'APPROVED', platformRoleId: roleId } }); operatorId = operator.id;
  const customer = await db.user.create({ data: { name: 'Test customer', email: `customer-${suffix}@example.test`, accountStatus: 'APPROVED' } }); customerId = customer.id;
  const parent = await db.session.create({ data: { userId: operatorId, tokenHash: hashToken(`parent-${suffix}`), csrfTokenHash: hashToken('csrf'), expiresAt: expiry, absoluteExpiresAt: expiry } }); parentId = parent.id;
  await db.session.create({ data: { userId: customerId, tokenHash: hashToken(childToken), csrfTokenHash: hashToken('csrf'), supportParentId: parentId, supportMode: 'MAINTENANCE', supportReason: 'Investigate test ticket', expiresAt: expiry, absoluteExpiresAt: expiry } });
});
afterAll(async () => {
  if (operatorId || customerId) await db.user.deleteMany({ where: { id: { in: [operatorId, customerId].filter(Boolean) } } });
  if (roleId) await db.platformRole.delete({ where: { id: roleId } });
  await db.$disconnect();
});
describe('support grants in PostgreSQL', () => {
  it('loads the real parent and enforces permission changes, expiry and revocation', async () => {
    expect((await auth.findActiveSession(hashToken(childToken), new Date()))?.support?.actorUserId).toBe(operatorId);
    await db.platformRole.update({ where: { id: roleId }, data: { permissions: ['users.read', 'support.read'] } });
    expect(await auth.findActiveSession(hashToken(childToken), new Date())).toBeNull();
    await db.platformRole.update({ where: { id: roleId }, data: { permissions: ['users.read', 'support.read', 'support.write'] } });
    expect(await auth.findActiveSession(hashToken(childToken), new Date())).not.toBeNull();
    expect(await auth.findActiveSession(hashToken(childToken), new Date(expiry.getTime() + 1))).toBeNull();
    await db.session.update({ where: { id: parentId }, data: { revokedAt: new Date() } });
    expect(await auth.findActiveSession(hashToken(childToken), new Date())).toBeNull();
  });
  it('rejects incomplete support grants at the database boundary', async () => {
    await expect(db.session.create({ data: { userId: customerId, tokenHash: hashToken(`invalid-${suffix}`), csrfTokenHash: hashToken('csrf'), supportParentId: parentId, expiresAt: expiry, absoluteExpiresAt: expiry } })).rejects.toThrow();
  });
});
