import type { PrismaClient } from '@solid/database';

export type StoreSummary = Readonly<{ publicId: string; name: string; slug: string; role: 'OWNER' | 'ADMIN' | 'ANALYST'; active: boolean }>;
export type StoreDomainSummary = Readonly<{ publicId: string; hostname: string; status: string; verifiedAt: Date | null; activatedAt: Date | null; lastCheckedAt: Date | null; dokployDomainId: string | null }>;

export interface StoreRepository {
  listForUser(userId: string, sessionId: string): Promise<readonly StoreSummary[]>;
  createForUser(userId: string, sessionId: string, name: string, slug: string, requestId: string): Promise<StoreSummary | null>;
  selectForUser(userId: string, sessionId: string, storePublicId: string, requestId: string): Promise<StoreSummary | null>;
  archiveForUser(userId: string, sessionId: string, storePublicId: string, requestId: string): Promise<boolean>;
  getDomainForUser(userId: string, sessionId: string): Promise<StoreDomainSummary | null>;
  saveDomainForUser(userId: string, sessionId: string, hostname: string, requestId: string): Promise<StoreDomainSummary | null>;
  updateDomainVerification(userId: string, sessionId: string, domainPublicId: string, verified: boolean, requestId: string): Promise<StoreDomainSummary | null>;
  activateDomainForUser(userId: string, sessionId: string, domainPublicId: string, dokployDomainId: string, requestId: string): Promise<StoreDomainSummary | null>;
  deleteDomainForUser(userId: string, sessionId: string, domainPublicId: string, requestId: string): Promise<boolean>;
  isCheckoutDomainAllowed?(hostname: string): Promise<boolean>;
}

export class PrismaStoreRepository implements StoreRepository {
  constructor(private readonly database: PrismaClient) {}

  async listForUser(userId: string, sessionId: string): Promise<readonly StoreSummary[]> {
    const [session, memberships] = await Promise.all([
      this.database.session.findFirst({ where: { id: sessionId, userId, revokedAt: null }, select: { activeStoreId: true } }),
      this.database.storeMember.findMany({ where: { userId, store: { active: true } }, orderBy: { createdAt: 'asc' }, select: { role: true, store: { select: { id: true, publicId: true, name: true, slug: true } } } }),
    ]);
    const fallbackStoreId = memberships[0]?.store.id;
    if (!session?.activeStoreId && fallbackStoreId) await this.database.session.updateMany({ where: { id: sessionId, userId, revokedAt: null, activeStoreId: null }, data: { activeStoreId: fallbackStoreId } });
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

  private async activeStoreMember(userId: string, sessionId: string) {
    const session = await this.database.session.findFirst({ where: { id: sessionId, userId, revokedAt: null }, select: { activeStoreId: true } });
    if (!session?.activeStoreId) return null;
    return this.database.storeMember.findFirst({ where: { userId, storeId: session.activeStoreId, store: { active: true } }, select: { role: true, storeId: true } });
  }

  async getDomainForUser(userId: string, sessionId: string): Promise<StoreDomainSummary | null> {
    const membership = await this.activeStoreMember(userId, sessionId); if (!membership) return null;
    return this.database.storeDomain.findUnique({ where: { storeId: membership.storeId }, select: { publicId: true, hostname: true, status: true, verifiedAt: true, activatedAt: true, lastCheckedAt: true, dokployDomainId: true } });
  }

  async saveDomainForUser(userId: string, sessionId: string, hostname: string, requestId: string): Promise<StoreDomainSummary | null> {
    const membership = await this.activeStoreMember(userId, sessionId); if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) return null;
    return this.database.$transaction(async transaction => {
      const domain = await transaction.storeDomain.upsert({ where: { storeId: membership.storeId }, create: { storeId: membership.storeId, hostname }, update: { hostname, status: 'PENDING_DNS', verifiedAt: null, activatedAt: null, dokployDomainId: null, lastCheckedAt: null }, select: { publicId: true, hostname: true, status: true, verifiedAt: true, activatedAt: true, lastCheckedAt: true, dokployDomainId: true } });
      await transaction.auditLog.create({ data: { storeId: membership.storeId, actorUserId: userId, actorType: 'USER', action: 'store_domain.saved', targetType: 'store_domain', targetId: domain.publicId, requestId } });
      return domain;
    });
  }

  async updateDomainVerification(userId: string, sessionId: string, domainPublicId: string, verified: boolean, requestId: string): Promise<StoreDomainSummary | null> {
    const membership = await this.activeStoreMember(userId, sessionId); if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) return null;
    return this.database.$transaction(async transaction => {
      const existing = await transaction.storeDomain.findFirst({ where: { publicId: domainPublicId, storeId: membership.storeId }, select: { id: true, publicId: true } }); if (!existing) return null;
      const now = new Date();
      const domain = await transaction.storeDomain.update({ where: { id: existing.id }, data: { status: verified ? 'VERIFIED_DNS' : 'PENDING_DNS', verifiedAt: verified ? now : null, lastCheckedAt: now }, select: { publicId: true, hostname: true, status: true, verifiedAt: true, activatedAt: true, lastCheckedAt: true, dokployDomainId: true } });
      await transaction.auditLog.create({ data: { storeId: membership.storeId, actorUserId: userId, actorType: 'USER', action: verified ? 'store_domain.verified' : 'store_domain.not_verified', targetType: 'store_domain', targetId: domain.publicId, requestId } });
      return domain;
    });
  }

  async activateDomainForUser(userId: string, sessionId: string, domainPublicId: string, dokployDomainId: string | null, requestId: string): Promise<StoreDomainSummary | null> {
    const membership = await this.activeStoreMember(userId, sessionId); if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) return null;
    return this.database.$transaction(async transaction => {
      const domain = await transaction.storeDomain.updateMany({ where: { publicId: domainPublicId, storeId: membership.storeId, status: 'VERIFIED_DNS' }, data: { status: 'ACTIVE', dokployDomainId, activatedAt: new Date() } }); if (!domain.count) return null;
      const result = await transaction.storeDomain.findFirst({ where: { publicId: domainPublicId, storeId: membership.storeId }, select: { publicId: true, hostname: true, status: true, verifiedAt: true, activatedAt: true, lastCheckedAt: true, dokployDomainId: true } });
      await transaction.auditLog.create({ data: { storeId: membership.storeId, actorUserId: userId, actorType: 'SYSTEM', action: 'store_domain.activated', targetType: 'store_domain', targetId: domainPublicId, requestId } }); return result;
    });
  }

  async deleteDomainForUser(userId: string, sessionId: string, domainPublicId: string, requestId: string): Promise<boolean> {
    const membership = await this.activeStoreMember(userId, sessionId); if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) return false;
    return this.database.$transaction(async transaction => {
      const deleted = await transaction.storeDomain.deleteMany({ where: { publicId: domainPublicId, storeId: membership.storeId } }); if (!deleted.count) return false;
      await transaction.auditLog.create({ data: { storeId: membership.storeId, actorUserId: userId, actorType: 'USER', action: 'store_domain.deleted', targetType: 'store_domain', targetId: domainPublicId, requestId } });
      return true;
    });
  }

  async isCheckoutDomainAllowed(hostname: string): Promise<boolean> { return (await this.database.storeDomain.count({ where: { hostname, status: 'VERIFIED_DNS' } })) > 0; }
}
