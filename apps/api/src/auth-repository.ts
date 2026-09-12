import type { PrismaClient } from '@solid/database';
import { hasPlatformPermission, permissionsFor, platformStaff } from './platform-permissions.js';
import type { PlatformIdentity } from './platform-permissions.js';

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LoginUser = Readonly<PlatformIdentity & { id: string; publicId: string; name: string; email: string; passwordHash: string | null; disabledAt: Date | null; accountStatus?: AccountStatus; mfaSecretEncrypted?: string | null; mfaEnabledAt?: Date | null }>;
export type SupportContext = Readonly<{ parentSessionId: string; actorUserId: string; actorPublicId: string; actorName: string; mode: 'READ_ONLY' | 'MAINTENANCE'; reason: string; expiresAt: Date }>;
export type SessionUser = Readonly<{ sessionId: string; userId: string; csrfTokenHash: string; mfaVerifiedAt?: Date | null; user: PlatformIdentity & { publicId: string; name: string; email: string; accountStatus?: AccountStatus; mfaEnabled?: boolean }; support?: SupportContext; expiresAt: Date; absoluteExpiresAt: Date }>;

export interface AuthRepository {
  findUserByEmail(email: string): Promise<LoginUser | null>;
  createSession(input: { tokenHash: string; csrfTokenHash: string; userId: string; userAgent?: string; ipHash?: string; expiresAt: Date; absoluteExpiresAt: Date; mfaVerifiedAt?: Date }): Promise<void>;
  findActiveSession(tokenHash: string, now: Date): Promise<SessionUser | null>;
  touchSession(sessionId: string, expiresAt: Date, now: Date): Promise<void>;
  revokeSession(tokenHash: string, now: Date): Promise<void>;
  updatePasswordAndRevokeOtherSessions(userId: string, passwordHash: string, currentSessionId: string, now: Date): Promise<void>;
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly database: PrismaClient) {}
  findUserByEmail(email: string): Promise<LoginUser | null> {
    return this.database.user.findUnique({ where: { email }, select: { id: true, publicId: true, name: true, email: true, passwordHash: true, disabledAt: true, accountStatus: true, platformAdmin: true, platformRole: { select: { publicId: true, name: true, permissions: true } }, mfaSecretEncrypted: true, mfaEnabledAt: true } });
  }
  async createSession(input: { tokenHash: string; csrfTokenHash: string; userId: string; userAgent?: string; ipHash?: string; expiresAt: Date; absoluteExpiresAt: Date; mfaVerifiedAt?: Date }): Promise<void> {
    await this.database.session.create({ data: input });
  }
  async findActiveSession(tokenHash: string, now: Date): Promise<SessionUser | null> {
    const session = await this.database.session.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now }, user: { disabledAt: null, accountStatus: 'APPROVED' } },
      select: { id: true, userId: true, csrfTokenHash: true, mfaVerifiedAt: true, expiresAt: true, absoluteExpiresAt: true, supportParentId: true, supportMode: true, supportReason: true,
        supportParent: { select: { id: true, userId: true, supportParentId: true, revokedAt: true, expiresAt: true, absoluteExpiresAt: true, user: { select: { publicId: true, name: true, disabledAt: true, accountStatus: true, platformAdmin: true, platformRole: { select: { publicId: true, name: true, permissions: true } } } } } },
        user: { select: { publicId: true, name: true, email: true, accountStatus: true, platformAdmin: true, platformRole: { select: { publicId: true, name: true, permissions: true } }, mfaEnabledAt: true } } }
    });
    if (!session) return null;
    let support: SupportContext | undefined;
    if (session.supportParentId) {
      const parent = session.supportParent;
      if (!parent || parent.supportParentId || parent.revokedAt || parent.expiresAt <= now || parent.absoluteExpiresAt <= now || parent.user.disabledAt || parent.user.accountStatus !== 'APPROVED' || platformStaff(session.user)) return null;
      if (!hasPlatformPermission(parent.user, 'support.read') || (session.supportMode === 'MAINTENANCE' && !hasPlatformPermission(parent.user, 'support.write'))) return null;
      if (session.supportMode !== 'READ_ONLY' && session.supportMode !== 'MAINTENANCE') return null;
      support = { parentSessionId: parent.id, actorUserId: parent.userId, actorPublicId: parent.user.publicId, actorName: parent.user.name, mode: session.supportMode, reason: session.supportReason ?? '', expiresAt: session.absoluteExpiresAt };
    }
    return { sessionId: session.id, userId: session.userId, csrfTokenHash: session.csrfTokenHash, mfaVerifiedAt: session.mfaVerifiedAt, expiresAt: session.expiresAt, absoluteExpiresAt: session.absoluteExpiresAt, ...(support ? { support } : {}), user: { publicId: session.user.publicId, name: session.user.name, email: session.user.email, accountStatus: session.user.accountStatus, platformAdmin: session.user.platformAdmin, platformRole: session.user.platformRole, platformPermissions: permissionsFor(session.user), mfaEnabled: Boolean(session.user.mfaEnabledAt) } };
  }
  async touchSession(sessionId: string, expiresAt: Date, now: Date): Promise<void> {
    await this.database.session.update({ where: { id: sessionId }, data: { expiresAt, lastSeenAt: now } });
  }
  async revokeSession(tokenHash: string, now: Date): Promise<void> {
    await this.database.session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: now } });
  }
  async updatePasswordAndRevokeOtherSessions(userId: string, passwordHash: string, currentSessionId: string, now: Date): Promise<void> {
    await this.database.$transaction([
      this.database.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.database.session.updateMany({ where: { userId, id: { not: currentSessionId }, revokedAt: null }, data: { revokedAt: now } }),
      this.database.auditLog.create({ data: { actorType: 'USER', actorUserId: userId, action: 'auth.password_changed', targetType: 'user', targetId: userId, metadata: { otherSessionsRevoked: true } } }),
    ]);
  }
}
