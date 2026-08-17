import type { PrismaClient } from '@solid/database';

export type StoreSummary = Readonly<{ publicId: string; name: string; slug: string; role: 'OWNER' | 'ADMIN' | 'ANALYST'; active: boolean }>;

export interface StoreRepository {
  listForUser(userId: string, sessionId: string): Promise<readonly StoreSummary[]>;
  createForUser(userId: string, sessionId: string, name: string, slug: string, requestId: string): Promise<StoreSummary | null>;
  selectForUser(userId: string, sessionId: string, storePublicId: string, requestId: string): Promise<StoreSummary | null>;
  archiveForUser(userId: string, sessionId: string, storePublicId: string, requestId: string): Promise<boolean>;
}

export class PrismaStoreRepository implements StoreRepository {
  constructor(private readonly database: PrismaClient) {}

  async listForUser(userId: string, sessionId: string): Promise<readonly StoreSummary[]> {
    const [session, memberships] = await Promise.all([
      this.database.session.findFirst({ where: { id: sessionId, userId, revokedAt: null }, select: { activeStoreId: true } }),
      this.database.storeMember.findMany({ where: { userId, store: { active: true } }, orderBy: { createdAt: 'asc' }, select: { role: true, store: { select: { id: true, publicId: true, name: true, slug: true } } } }),
    ]);
    return memberships.map(({ role, store }, index) => ({ publicId: store.publicId, name: store.name, slug: store.slug, role, active: session?.activeStoreId ? session.activeStoreId === store.id : index === 0 }));
  }

  async createForUser(userId: string, sessionId: string, name: string, slug: string, requestId: string): Promise<StoreSummary | null> {
    const membershipCount = await this.database.storeMember.count({ where: { userId } });
    if (membershipCount >= 20) return null;
    return this.database.$transaction(async transaction => {
      const store = await transaction.store.create({ data: { name, slug }, select: { id: true, publicId: true, name: true, slug: true } });
      await transaction.storeMember.create({ data: { userId, storeId: store.id, role: 'OWNER' } });
      const updated = await transaction.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { activeStoreId: store.id } });
      if (updated.count !== 1) throw new Error('Sessão ativa não encontrada');
      await transaction.auditLog.create({ data: { storeId: store.id, actorUserId: userId, actorType: 'USER', action: 'store.created', targetType: 'store', targetId: store.publicId, requestId } });
      return { publicId: store.publicId, name: store.name, slug: store.slug, role: 'OWNER', active: true };
    });
  }

  async selectForUser(userId: string, sessionId: string, storePublicId: string, requestId: string): Promise<StoreSummary | null> {
    const membership = await this.database.storeMember.findFirst({ where: { userId, store: { publicId: storePublicId, active: true } }, select: { role: true, store: { select: { id: true, publicId: true, name: true, slug: true } } } });
    if (!membership) return null;
    const updated = await this.database.$transaction(async transaction => {
      const result = await transaction.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { activeStoreId: membership.store.id } });
      if (result.count === 1) await transaction.auditLog.create({ data: { storeId: membership.store.id, actorUserId: userId, actorType: 'USER', action: 'store.selected', targetType: 'store', targetId: membership.store.publicId, requestId } });
      return result.count;
    });
    return updated === 1 ? { publicId: membership.store.publicId, name: membership.store.name, slug: membership.store.slug, role: membership.role, active: true } : null;
  }
  async archiveForUser(userId: string, sessionId: string, storePublicId: string, requestId: string): Promise<boolean> {
    return this.database.$transaction(async transaction => {
      const membership = await transaction.storeMember.findFirst({ where: { userId, store: { publicId: storePublicId, active: true } }, select: { role: true, storeId: true } });
      if (!membership || membership.role !== 'OWNER') return false;
      const owned = await transaction.storeMember.count({ where: { userId, role: 'OWNER', store: { active: true } } }); if (owned < 2) return false;
      await transaction.store.update({ where: { id: membership.storeId }, data: { active: false } });
      const next = await transaction.storeMember.findFirst({ where: { userId, store: { active: true } }, orderBy: { createdAt: 'asc' }, select: { storeId: true } });
      await transaction.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { activeStoreId: next?.storeId ?? null } });
      await transaction.auditLog.create({ data: { storeId: membership.storeId, actorUserId: userId, actorType: 'USER', action: 'store.archived', targetType: 'store', targetId: storePublicId, requestId } });
      return true;
    });
  }
}
