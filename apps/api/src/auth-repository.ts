import type { PrismaClient } from '@solid/database';

export type LoginUser = Readonly<{ id: string; publicId: string; name: string; email: string; passwordHash: string | null; disabledAt: Date | null }>;
export type SessionUser = Readonly<{ sessionId: string; csrfTokenHash: string; user: { publicId: string; name: string; email: string }; expiresAt: Date; absoluteExpiresAt: Date }>;

export interface AuthRepository {
  findUserByEmail(email: string): Promise<LoginUser | null>;
  createSession(input: { tokenHash: string; csrfTokenHash: string; userId: string; userAgent?: string; expiresAt: Date; absoluteExpiresAt: Date }): Promise<void>;
  findActiveSession(tokenHash: string, now: Date): Promise<SessionUser | null>;
  touchSession(sessionId: string, expiresAt: Date, now: Date): Promise<void>;
  revokeSession(tokenHash: string, now: Date): Promise<void>;
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly database: PrismaClient) {}
  findUserByEmail(email: string): Promise<LoginUser | null> {
    return this.database.user.findUnique({ where: { email }, select: { id: true, publicId: true, name: true, email: true, passwordHash: true, disabledAt: true } });
  }
  async createSession(input: { tokenHash: string; csrfTokenHash: string; userId: string; userAgent?: string; expiresAt: Date; absoluteExpiresAt: Date }): Promise<void> {
    await this.database.session.create({ data: input });
  }
  async findActiveSession(tokenHash: string, now: Date): Promise<SessionUser | null> {
    const session = await this.database.session.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now }, user: { disabledAt: null } },
      select: { id: true, csrfTokenHash: true, expiresAt: true, absoluteExpiresAt: true, user: { select: { publicId: true, name: true, email: true } } }
    });
    return session ? { sessionId: session.id, csrfTokenHash: session.csrfTokenHash, expiresAt: session.expiresAt, absoluteExpiresAt: session.absoluteExpiresAt, user: session.user } : null;
  }
  async touchSession(sessionId: string, expiresAt: Date, now: Date): Promise<void> {
    await this.database.session.update({ where: { id: sessionId }, data: { expiresAt, lastSeenAt: now } });
  }
  async revokeSession(tokenHash: string, now: Date): Promise<void> {
    await this.database.session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: now } });
  }
}
