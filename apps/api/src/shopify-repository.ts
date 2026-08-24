import type { PrismaClient } from '@solid/database';

export type ShopifyContext = Readonly<{ storeId: string; storePublicId: string; role: 'OWNER' | 'ADMIN' | 'ANALYST' }>;
export type ShopifyStatus = Readonly<{ connected: boolean; shopDomain?: string; scopes?: string; connectedAt?: Date; lastSyncedAt?: Date }>;
export type OAuthStateRecord = Readonly<{ id: string; storeId: string; userId: string; sessionId: string; shopDomain: string }>;
export type ShopifyCredentials = Readonly<{ shopDomain: string; accessTokenEncrypted: string; refreshTokenEncrypted?: string; accessTokenExpiresAt?: Date; refreshTokenExpiresAt?: Date }>;
export type ShopifyCatalog = Readonly<{
  products: readonly Readonly<{ id: string; title: string; handle: string; descriptionHtml: string; vendor: string; productType: string; tags: readonly string[]; status: string; updatedAt: string; featuredImage?: string | undefined; variants: readonly Readonly<{ id: string; title: string; sku?: string | undefined; barcode?: string | undefined; price: string; compareAtPrice?: string | undefined; inventoryQuantity?: number | undefined; availableForSale: boolean; imageUrl?: string | undefined; selectedOptions: readonly Readonly<{ name: string; value: string }>[] }>[]; images: readonly Readonly<{ id: string; url: string; altText?: string | undefined; width?: number | undefined; height?: number | undefined }>[]; collectionIds: readonly string[] }>[];
  collections: readonly Readonly<{ id: string; title: string; handle: string; descriptionHtml: string; imageUrl?: string | undefined; updatedAt: string }>[];
}>;
export type ShopifySyncResult = Readonly<{ products: number; variants: number; images: number; collections: number; syncedAt: Date }>;
export type ShopifyOrderSyncContext = Readonly<{ checkoutSessionId: string; publicId: string; storeId: string; paid: boolean; currency: string; shippingPriceCents: number; shippingMethodName: string | null; customerDataEncrypted: string; shippingAddressEncrypted: string; items: readonly Readonly<{ variantExternalId: string; quantity: number; title: string; unitPriceCents: number }>[] }>;

export class ShopifyDomainInUseError extends Error {
  constructor() { super('Shopify domain is already connected'); this.name = 'ShopifyDomainInUseError'; }
}

export interface ShopifyRepository {
  context(userId: string, sessionId: string): Promise<ShopifyContext | null>;
  status(storeId: string): Promise<ShopifyStatus>;
  credentials(storeId: string): Promise<ShopifyCredentials | null>;
  createState(input: { stateHash: string; storeId: string; userId: string; sessionId: string; shopDomain: string; expiresAt: Date }): Promise<void>;
  consumeState(stateHash: string, userId: string, sessionId: string, now: Date): Promise<OAuthStateRecord | null>;
  connect(input: { storeId: string; userId: string; shopDomain: string; accessTokenEncrypted: string; refreshTokenEncrypted?: string; scopes: string; accessTokenExpiresAt?: Date; refreshTokenExpiresAt?: Date; requestId: string }): Promise<void>;
  disconnect(storeId: string, userId: string, requestId: string): Promise<void>;
  syncCatalog(storeId: string, userId: string, requestId: string, catalog: ShopifyCatalog): Promise<ShopifySyncResult>;
  claimPaidOrderSync(checkoutSessionId: string, now: Date): Promise<ShopifyOrderSyncContext | null>;
  markOrderSynced(checkoutSessionId: string, order: { id: string; name?: string | null }, now: Date): Promise<void>;
  markOrderPaymentSynced(checkoutSessionId: string, now: Date): Promise<void>;
  markOrderSyncFailed(checkoutSessionId: string, message: string): Promise<void>;
  shopifyOrderId(checkoutSessionId: string): Promise<{ storeId: string; orderId: string } | null>;
  paidOrdersAwaitingSync(now: Date): Promise<readonly string[]>;
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
    const connection = await this.database.shopifyConnection.findFirst({ where: { storeId, revokedAt: null }, select: { shopDomain: true, scopes: true, connectedAt: true, lastSyncedAt: true } });
    return connection ? { connected: true, shopDomain: connection.shopDomain, scopes: connection.scopes, connectedAt: connection.connectedAt, ...(connection.lastSyncedAt ? { lastSyncedAt: connection.lastSyncedAt } : {}) } : { connected: false };
  }
  async credentials(storeId: string): Promise<ShopifyCredentials | null> {
    const value = await this.database.shopifyConnection.findFirst({ where: { storeId, revokedAt: null }, select: { shopDomain: true, accessTokenEncrypted: true, refreshTokenEncrypted: true, accessTokenExpiresAt: true, refreshTokenExpiresAt: true } });
    return value ? { shopDomain: value.shopDomain, accessTokenEncrypted: value.accessTokenEncrypted, ...(value.refreshTokenEncrypted ? { refreshTokenEncrypted: value.refreshTokenEncrypted } : {}), ...(value.accessTokenExpiresAt ? { accessTokenExpiresAt: value.accessTokenExpiresAt } : {}), ...(value.refreshTokenExpiresAt ? { refreshTokenExpiresAt: value.refreshTokenExpiresAt } : {}) } : null;
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
      const domainConnection = await tx.shopifyConnection.findUnique({ where: { shopDomain: input.shopDomain }, select: { id: true, storeId: true, revokedAt: true } });
      if (domainConnection && domainConnection.storeId !== input.storeId) {
        if (!domainConnection.revokedAt) throw new ShopifyDomainInUseError();
        await tx.shopifyConnection.deleteMany({ where: { storeId: input.storeId, id: { not: domainConnection.id } } });
        await tx.shopifyConnection.update({ where: { id: domainConnection.id }, data: { storeId: input.storeId, ...tokenData, revokedAt: null, connectedAt: new Date(), lastSyncedAt: null } });
      } else {
        await tx.shopifyConnection.upsert({ where: { storeId: input.storeId }, create: { storeId: input.storeId, shopDomain: input.shopDomain, ...tokenData }, update: { shopDomain: input.shopDomain, ...tokenData, revokedAt: null, connectedAt: new Date() } });
      }
      await tx.auditLog.create({ data: { storeId: input.storeId, actorUserId: input.userId, actorType: 'USER', action: 'integration.shopify_connected', targetType: 'shopify_connection', targetId: input.shopDomain, requestId: input.requestId } });
    });
  }
  async disconnect(storeId: string, userId: string, requestId: string): Promise<void> {
    await this.database.$transaction([this.database.shopifyConnection.updateMany({ where: { storeId, revokedAt: null }, data: { revokedAt: new Date() } }), this.database.auditLog.create({ data: { storeId, actorUserId: userId, actorType: 'USER', action: 'integration.shopify_disconnected', targetType: 'shopify_connection', requestId } })]);
  }
  async syncCatalog(storeId: string, userId: string, requestId: string, catalog: ShopifyCatalog): Promise<ShopifySyncResult> {
    const syncedAt = new Date(); let variantCount = 0; let imageCount = 0;
    await this.database.$transaction(async tx => {
      const collectionIds = new Map<string, string>();
      for (const collection of catalog.collections) {
        const saved = await tx.shopifyCollection.upsert({ where: { storeId_sourceExternalId: { storeId, sourceExternalId: collection.id } }, create: { storeId, sourceExternalId: collection.id, title: collection.title, handle: collection.handle, descriptionHtml: collection.descriptionHtml || null, imageUrl: collection.imageUrl ?? null, sourceUpdatedAt: new Date(collection.updatedAt), syncedAt }, update: { title: collection.title, handle: collection.handle, descriptionHtml: collection.descriptionHtml || null, imageUrl: collection.imageUrl ?? null, sourceUpdatedAt: new Date(collection.updatedAt), syncedAt } });
        collectionIds.set(collection.id, saved.id);
      }
      const seenProducts: string[] = [];
      for (const item of catalog.products) {
        const firstVariant = item.variants[0]; const priceCents = moneyToCents(firstVariant?.price); const compareAtCents = moneyToOptionalCents(firstVariant?.compareAtPrice);
        const product = await tx.product.upsert({ where: { storeId_source_sourceExternalId: { storeId, source: 'SHOPIFY', sourceExternalId: item.id } }, create: { storeId, source: 'SHOPIFY', sourceExternalId: item.id, sourceTitle: item.title, checkoutTitle: item.title, checkoutDescription: item.descriptionHtml || null, sourceDescriptionHtml: item.descriptionHtml || null, handle: item.handle, vendor: item.vendor || null, productType: item.productType || null, tags: [...item.tags], sourceStatus: item.status, sourceUpdatedAt: new Date(item.updatedAt), syncedAt, imageUrl: item.featuredImage ?? null, priceCents, compareAtCents, stockQuantity: totalInventory(item.variants), trackInventory: item.variants.some(variant => variant.inventoryQuantity !== undefined), active: item.status === 'ACTIVE' }, update: { sourceTitle: item.title, sourceDescriptionHtml: item.descriptionHtml || null, handle: item.handle, vendor: item.vendor || null, productType: item.productType || null, tags: [...item.tags], sourceStatus: item.status, sourceUpdatedAt: new Date(item.updatedAt), syncedAt, imageUrl: item.featuredImage ?? null, priceCents, compareAtCents, stockQuantity: totalInventory(item.variants), trackInventory: item.variants.some(variant => variant.inventoryQuantity !== undefined), active: item.status === 'ACTIVE' } });
        seenProducts.push(product.id);
        const seenVariants: string[] = [];
        for (const variant of item.variants) { await tx.productVariant.upsert({ where: { productId_sourceExternalId: { productId: product.id, sourceExternalId: variant.id } }, create: { productId: product.id, sourceExternalId: variant.id, title: variant.title, sku: variant.sku ?? null, barcode: variant.barcode ?? null, priceCents: moneyToCents(variant.price), compareAtCents: moneyToOptionalCents(variant.compareAtPrice), inventoryQuantity: variant.inventoryQuantity ?? null, availableForSale: variant.availableForSale, imageUrl: variant.imageUrl ?? null, selectedOptions: [...variant.selectedOptions] }, update: { title: variant.title, sku: variant.sku ?? null, barcode: variant.barcode ?? null, priceCents: moneyToCents(variant.price), compareAtCents: moneyToOptionalCents(variant.compareAtPrice), inventoryQuantity: variant.inventoryQuantity ?? null, availableForSale: variant.availableForSale, imageUrl: variant.imageUrl ?? null, selectedOptions: [...variant.selectedOptions] } }); seenVariants.push(variant.id); variantCount += 1; }
        await tx.productVariant.deleteMany({ where: { productId: product.id, sourceExternalId: { notIn: seenVariants } } });
        await tx.productImage.deleteMany({ where: { productId: product.id } });
        if (item.images.length) await tx.productImage.createMany({ data: item.images.map((image, position) => ({ productId: product.id, sourceExternalId: image.id, url: image.url, altText: image.altText ?? null, width: image.width ?? null, height: image.height ?? null, position })) });
        imageCount += item.images.length;
        await tx.productCollection.deleteMany({ where: { productId: product.id } });
        const memberships = item.collectionIds.map(id => collectionIds.get(id)).filter((id): id is string => Boolean(id));
        if (memberships.length) await tx.productCollection.createMany({ data: memberships.map(collectionId => ({ productId: product.id, collectionId })), skipDuplicates: true });
      }
      await tx.product.updateMany({ where: { storeId, source: 'SHOPIFY', id: { notIn: seenProducts } }, data: { active: false, syncedAt } });
      await tx.shopifyConnection.update({ where: { storeId }, data: { lastSyncedAt: syncedAt } });
      await tx.auditLog.create({ data: { storeId, actorUserId: userId, actorType: 'USER', action: 'integration.shopify_catalog_synced', targetType: 'shopify_connection', requestId, metadata: { products: catalog.products.length, variants: variantCount, images: imageCount, collections: catalog.collections.length } } });
    }, { timeout: 60_000 });
    return { products: catalog.products.length, variants: variantCount, images: imageCount, collections: catalog.collections.length, syncedAt };
  }
  async claimPaidOrderSync(checkoutSessionId: string, now: Date): Promise<ShopifyOrderSyncContext | null> {
    return this.database.$transaction(async transaction => {
      const session = await transaction.checkoutSession.findUnique({ where: { id: checkoutSessionId }, select: { id: true, publicId: true, status: true, source: true, currency: true, shippingPriceCents: true, shippingMethodName: true, customerDataEncrypted: true, shippingAddressEncrypted: true, shopifyOrderId: true, shopifySyncStatus: true, shopifySyncStartedAt: true, checkout: { select: { storeId: true } }, items: { select: { quantity: true, titleSnapshot: true, unitPriceCents: true, variant: { select: { sourceExternalId: true } } } } } });
      if (!session || !['OPEN', 'COMPLETED'].includes(session.status) || session.source !== 'SHOPIFY' || session.shopifyOrderId || !session.customerDataEncrypted || !session.shippingAddressEncrypted) return null;
      const staleBefore = new Date(now.getTime() - 10 * 60_000);
      if (session.shopifySyncStatus === 'SYNCING' && session.shopifySyncStartedAt && session.shopifySyncStartedAt > staleBefore) return null;
      const updated = await transaction.checkoutSession.updateMany({ where: { id: session.id, shopifyOrderId: null, OR: [{ shopifySyncStatus: null }, { shopifySyncStatus: 'FAILED' }, { shopifySyncStatus: 'SYNCING', shopifySyncStartedAt: { lte: staleBefore } }] }, data: { shopifySyncStatus: 'SYNCING', shopifySyncStartedAt: now, shopifySyncError: null } });
      if (updated.count !== 1 || session.items.some(item => !item.variant.sourceExternalId)) return null;
      return { checkoutSessionId: session.id, publicId: session.publicId, storeId: session.checkout.storeId, paid: session.status === 'COMPLETED', currency: session.currency, shippingPriceCents: session.shippingPriceCents, shippingMethodName: session.shippingMethodName, customerDataEncrypted: session.customerDataEncrypted, shippingAddressEncrypted: session.shippingAddressEncrypted, items: session.items.map(item => ({ variantExternalId: item.variant.sourceExternalId, quantity: item.quantity, title: item.titleSnapshot, unitPriceCents: item.unitPriceCents })) };
    });
  }
  async markOrderSynced(checkoutSessionId: string, order: { id: string; name?: string | null }, now: Date): Promise<void> {
    await this.database.checkoutSession.updateMany({ where: { id: checkoutSessionId, shopifyOrderId: null }, data: { shopifyOrderId: order.id, shopifyOrderName: order.name ?? null, shopifySyncStatus: 'SYNCED', shopifySyncedAt: now, shopifySyncError: null } });
  }
  async markOrderPaymentSynced(checkoutSessionId: string, now: Date): Promise<void> {
    await this.database.checkoutSession.updateMany({ where: { id: checkoutSessionId, shopifyOrderId: { not: null } }, data: { shopifySyncStatus: 'SYNCED', shopifySyncedAt: now, shopifySyncError: null } });
  }
  async markOrderSyncFailed(checkoutSessionId: string, message: string): Promise<void> {
    await this.database.checkoutSession.updateMany({ where: { id: checkoutSessionId }, data: { shopifySyncStatus: 'FAILED', shopifySyncError: message.slice(0, 500) } });
  }
  async shopifyOrderId(checkoutSessionId: string): Promise<{ storeId: string; orderId: string } | null> {
    const session = await this.database.checkoutSession.findUnique({ where: { id: checkoutSessionId }, select: { shopifyOrderId: true, checkout: { select: { storeId: true } } } });
    return session?.shopifyOrderId ? { storeId: session.checkout.storeId, orderId: session.shopifyOrderId } : null;
  }
  async paidOrdersAwaitingSync(now: Date): Promise<readonly string[]> {
    const staleBefore = new Date(now.getTime() - 2 * 60_000);
    const sessions = await this.database.checkoutSession.findMany({ where: { source: 'SHOPIFY', status: 'COMPLETED', OR: [{ shopifySyncStatus: null }, { shopifySyncStatus: 'FAILED', updatedAt: { lte: staleBefore } }, { shopifySyncStatus: 'SYNCING', shopifySyncStartedAt: { lte: new Date(now.getTime() - 10 * 60_000) } }] }, orderBy: { updatedAt: 'asc' }, take: 50, select: { id: true } });
    return sessions.map(session => session.id);
  }
}

const moneyToCents = (value?: string): number => value && /^\d+(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : 0;
const moneyToOptionalCents = (value?: string): number | null => value && /^\d+(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : null;
const totalInventory = (variants: ShopifyCatalog['products'][number]['variants']): number | null => { const known = variants.flatMap(variant => variant.inventoryQuantity === undefined ? [] : [variant.inventoryQuantity]); return known.length ? known.reduce((total, quantity) => total + quantity, 0) : null; };
