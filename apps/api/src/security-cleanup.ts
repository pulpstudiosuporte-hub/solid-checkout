import type { FastifyBaseLogger } from 'fastify';
import type { PrismaClient } from '@solid/database';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export async function runSecurityCleanup(database: PrismaClient, logger: FastifyBaseLogger): Promise<void> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - DAY);
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const pushLimit = new Date(now.getTime() - 90 * DAY);
  const auditLimit = new Date(now.getTime() - 400 * DAY);
  const [signups, resetTokens, challenges, pushSubscriptions, sessions, expiredCheckouts, anonymizedCheckouts, audits] = await database.$transaction([
    database.pendingSignup.deleteMany({ where: { expiresAt: { lt: dayAgo } } }),
    database.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lt: dayAgo } }, { usedAt: { lt: dayAgo } }] } }),
    database.mfaChallenge.deleteMany({ where: { OR: [{ expiresAt: { lt: dayAgo } }, { consumedAt: { lt: dayAgo } }] } }),
    database.pushSubscription.deleteMany({ where: { OR: [{ lastUsedAt: { lt: pushLimit } }, { sessionId: null }, { session: { revokedAt: { not: null } } }, { session: { absoluteExpiresAt: { lte: now } } }] } }),
    database.session.deleteMany({ where: { OR: [{ revokedAt: { lt: monthAgo } }, { absoluteExpiresAt: { lt: monthAgo } }] } }),
    database.checkoutSession.updateMany({ where: { status: 'OPEN', expiresAt: { lte: now } }, data: { status: 'EXPIRED' } }),
    database.checkoutSession.updateMany({ where: { status: { in: ['EXPIRED', 'CANCELLED'] }, expiresAt: { lt: monthAgo } }, data: { customerDataEncrypted: null, customerEmailHash: null, customerDocumentHash: null, shippingAddressEncrypted: null } }),
    database.auditLog.deleteMany({ where: { createdAt: { lt: auditLimit } } })
  ]);
  logger.info({ deleted: { signups: signups.count, resetTokens: resetTokens.count, challenges: challenges.count, pushSubscriptions: pushSubscriptions.count, sessions: sessions.count, audits: audits.count }, updated: { expiredCheckouts: expiredCheckouts.count, anonymizedCheckouts: anonymizedCheckouts.count } }, 'security_cleanup_completed');
}

export function startSecurityCleanup(database: PrismaClient, logger: FastifyBaseLogger): () => void {
  const execute = () => void runSecurityCleanup(database, logger).catch(error => logger.error({ err: error }, 'security_cleanup_failed'));
  const initial = setTimeout(execute, 30_000);
  const interval = setInterval(execute, 6 * HOUR);
  return () => { clearTimeout(initial); clearInterval(interval); };
}
