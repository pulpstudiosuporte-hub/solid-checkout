import type { PrismaClient } from '@solid/database';

export type ShopifyContext = Readonly<{ storeId: string; storePublicId: string; role: 'OWNER' | 'ADMIN' | 'ANALYST' }>;
export type ShopifyStatus = Readonly<{ connected: boolean; shopDomain?: string; scopes?: string; connectedAt?: Date }>;
export type OAuthStateRecord = Readonly<{ id: string; storeId: string; userId: string; sessionId: string; shopDomain: string }>;

export interface ShopifyRepository {
  context(userId: string, sessionId: string): Promise<ShopifyContext | null>;
  status(storeId: string): Promise<ShopifyStatus>;
  createState(input: { stateHash: string; storeId: string; userId: string; sessionId: string; shopDomain: string; expiresAt: Date }): Promise<void>;
  consumeState(stateHash: string, userId: string, sessionId: string, now: Date): Promise<OAuthStateRecord | null>;
  connect(input: { storeId: string; userId: string; shopDomain: string; accessTokenEncrypted: string; refreshTokenEncrypted?: string; scopes: string; accessTokenExpiresAt?: Date; refreshTokenExpiresAt?: Date; requestId: string }): Promise<void>;
  disconnect(storeId: string, userId: string, requestId: string): Promise<void>;
}

export class PrismaShopifyRepository implements ShopifyRepository {
  constructor(private readonly database: PrismaClient) {}
  async context(userId: string, sessionId: string): Promise<ShopifyContext | null> {
    const session = await this.database.session.findFirst({ where: { id: sessionId, userId, revokedAt: null }, select: { activeStoreId: true } });
    if (!session?.activeStoreId) return null;
    const membership = await this.database.storeMember.findUnique({ where: { storeId_userId: { storeId: session.activeStoreId, userId } }, select: { role: true, store: { select: { id: true, publicId: true, active: true } } } });
    return membership?.store.active ? { storeId: membership.store.id, storePublicId: membership.store.publicId, role: membership.role } : null;
  }
  async status(storeId: string): Promise<ShopifyStatus> {
    const connection = await this.database.shopifyConnection.findFirst({ where: { storeId, revokedAt: null }, select: { shopDomain: true, scopes: true, connectedAt: true } });
    return connection ? { connected: true, ...connection } : { connected: false };
  }
  async createState(input: { stateHash: string; storeId: string; userId: string; sessionId: string; shopDomain: string; expiresAt: Date }): Promise<void> {
    await this.database.$transaction([this.database.shopifyOAuthState.deleteMany({ where: { sessionId: input.sessionId } }), this.database.shopifyOAuthState.create({ data: input })]);
  }
  async consumeState(stateHash: string, userId: string, sessionId: string, now: Date): Promise<OAuthStateRecord | null> {
    return this.database.$transaction(async tx => {
      const state = await tx.shopifyOAuthState.findFirst({ where: { stateHash, userId, sessionId, usedAt: null, expiresAt: { gt: now } }, select: { id: true, storeId: true, userId: true, sessionId: true, shopDomain: true } });
      if (!state) return null;
      const consumed = await tx.shopifyOAuthState.updateMany({ where: { id: state.id, usedAt: null }, data: { usedAt: now } });
      return consumed.count === 1 ? state : null;
    });
  }
  async connect(input: { storeId: string; userId: string; shopDomain: string; accessTokenEncrypted: string; refreshTokenEncrypted?: string; scopes: string; accessTokenExpiresAt?: Date; refreshTokenExpiresAt?: Date; requestId: string }): Promise<void> {
    await this.database.$transaction(async tx => {
      const tokenData = { accessTokenEncrypted: input.accessTokenEncrypted, ...(input.refreshTokenEncrypted ? { refreshTokenEncrypted: input.refreshTokenEncrypted } : {}), scopes: input.scopes, ...(input.accessTokenExpiresAt ? { accessTokenExpiresAt: input.accessTokenExpiresAt } : {}), ...(input.refreshTokenExpiresAt ? { refreshTokenExpiresAt: input.refreshTokenExpiresAt } : {}) };
      await tx.shopifyConnection.upsert({ where: { storeId: input.storeId }, create: { storeId: input.storeId, shopDomain: input.shopDomain, ...tokenData }, update: { shopDomain: input.shopDomain, ...tokenData, revokedAt: null, connectedAt: new Date() } });
      await tx.auditLog.create({ data: { storeId: input.storeId, actorUserId: input.userId, actorType: 'USER', action: 'integration.shopify_connected', targetType: 'shopify_connection', targetId: input.shopDomain, requestId: input.requestId } });
    });
  }
  async disconnect(storeId: string, userId: string, requestId: string): Promise<void> {
    await this.database.$transaction([this.database.shopifyConnection.updateMany({ where: { storeId, revokedAt: null }, data: { revokedAt: new Date() } }), this.database.auditLog.create({ data: { storeId, actorUserId: userId, actorType: 'USER', action: 'integration.shopify_disconnected', targetType: 'shopify_connection', requestId } })]);
  }
}
