import type { Prisma, PrismaClient } from '@solid/database';
import { planLimits } from './plan-entitlements.js';
import { effectiveBilling } from './billing-entitlements.js';

export type StoreContext = Readonly<{ storeId: string; userId: string; sessionId: string; role: 'OWNER' | 'ADMIN' | 'ANALYST' }>;
export type ProductInput = Readonly<{ title: string; description?: string; imageUrl?: string; priceCents: number; compareAtCents?: number; stockQuantity?: number; trackInventory: boolean; maxPerOrder: number; active: boolean; fulfillmentType: 'PHYSICAL' | 'DIGITAL'; externalDeliveryUrl?: string }>;
export type CheckoutInput = Readonly<{ name: string; slug: string; draftConfig: Record<string, unknown> } & ({ mode: 'DIRECT_LINK'; productPublicId: string } | { mode: 'SHOPIFY_CART'; productPublicId?: never })>;
export type CheckoutConfigInput = Readonly<Record<string, unknown>>;
export type CheckoutSessionInput = Readonly<{ storeSlug: string; checkoutSlug: string; variantPublicId?: string; quantity: number; tokenHash: string; source: 'DIRECT' | 'SHOPIFY'; sourceCartId?: string; trackingParameters?: Record<string, string | null>; expiresAt: Date }>;
export type ShopifyCartSessionInput = Readonly<{ shopDomain: string; checkoutSlug?: string; lines: readonly Readonly<{ variantId: string; quantity: number }>[]; tokenHash: string; sourceCartId?: string; expiresAt: Date }>;
export type CheckoutCustomerInput = Readonly<{ encryptedData: string; emailHash: string; documentHash: string }>;
export type CheckoutShippingInput = Readonly<{ encryptedData: string }>;
export type ShippingMethodInput = Readonly<{ name: string; priceCents: number; minDays: number; maxDays: number; active: boolean }>;
export type ProductListQuery = Readonly<{ search?: string; status?: 'active' | 'inactive'; source?: 'MANUAL' | 'SHOPIFY'; page: number; pageSize: number }>;
export type ProductListResult = Readonly<{ items: readonly object[]; total: number }>;

export interface CatalogRepository {
  hasActiveDomain?(context: StoreContext): Promise<boolean>;
  resolveStoreContext(userId: string, sessionId: string): Promise<StoreContext | null>;
  listProducts(context: StoreContext, query: ProductListQuery): Promise<ProductListResult>;
  getProduct(context: StoreContext, publicId: string): Promise<object | null>;
  createProduct(context: StoreContext, input: ProductInput, requestId: string): Promise<object>;
  deleteManualProduct(context: StoreContext, publicId: string, requestId: string): Promise<'deleted' | 'archived' | 'not_found'>;
  listCheckouts(context: StoreContext): Promise<readonly object[]>;
  createCheckout(context: StoreContext, input: CheckoutInput, requestId: string): Promise<object | 'limit_reached' | null>;
  deleteCheckout(context: StoreContext, publicId: string, requestId: string): Promise<'deleted' | 'archived' | 'not_found'>;
  updateCheckoutDraft(context: StoreContext, publicId: string, config: CheckoutConfigInput, requestId: string): Promise<object | null>;
  publishCheckout(context: StoreContext, publicId: string, requestId: string): Promise<object | null>;
  getPublicCheckout(storeSlug: string, checkoutSlug: string): Promise<object | null>;
  createPublicCheckoutSession(input: CheckoutSessionInput): Promise<object | null>;
  getPublicCheckoutSession(publicId: string, tokenHash: string, now: Date): Promise<object | null>;
  touchPublicCheckoutSession?(publicId: string, tokenHash: string, now: Date): Promise<boolean>;
  getPaidDigitalDelivery(publicId: string, tokenHash: string): Promise<object | null>;
  createShopifyCartSession(input: ShopifyCartSessionInput): Promise<object | null>;
  updatePublicCheckoutCustomer(publicId: string, tokenHash: string, now: Date, input: CheckoutCustomerInput): Promise<object | null>;
  updatePublicCheckoutShipping(publicId: string, tokenHash: string, now: Date, input: CheckoutShippingInput): Promise<object | null>;
  listShippingMethods(context: StoreContext): Promise<readonly object[]>;
  createShippingMethod(context: StoreContext, input: ShippingMethodInput, requestId: string): Promise<object>;
  updateShippingMethod(context: StoreContext, publicId: string, input: ShippingMethodInput, requestId: string): Promise<object | null>;
  deleteShippingMethod(context: StoreContext, publicId: string, requestId: string): Promise<boolean>;
  listPublicShippingMethods(publicId: string, tokenHash: string, now: Date): Promise<readonly object[] | null>;
  selectPublicShippingMethod(publicId: string, tokenHash: string, methodPublicId: string, now: Date): Promise<object | null>;
  setPublicOrderBump(publicId: string, tokenHash: string, productPublicId: string, enabled: boolean, now: Date): Promise<object | null>;
  updatePublicCheckoutQuantity?(publicId: string, tokenHash: string, quantity: number, now: Date): Promise<object | null>;
}

const productSelect = { publicId: true, sourceTitle: true, checkoutTitle: true, checkoutDescription: true, handle: true, vendor: true, productType: true, tags: true, fulfillmentType: true, externalDeliveryUrl: true, imageUrl: true, priceCents: true, compareAtCents: true, stockQuantity: true, trackInventory: true, maxPerOrder: true, active: true, source: true, syncedAt: true, createdAt: true, updatedAt: true, _count: { select: { variants: true, images: true, collections: true } } } as const;
const checkoutSelect = { publicId: true, name: true, slug: true, mode: true, isDefault: true, status: true, draftConfig: true, publishedConfig: true, publishedAt: true, createdAt: true, updatedAt: true, product: { select: { publicId: true, checkoutTitle: true, priceCents: true, active: true, fulfillmentType: true } } } as const;
type OrderBumpConfig = Readonly<{ productId: string; title: string; message: string }>;
const configuredOrderBumps = (config: Record<string, unknown>): readonly OrderBumpConfig[] => {
  const configured = Array.isArray(config.orderBumps) ? config.orderBumps.flatMap((value): OrderBumpConfig[] => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
    const bump = value as Record<string, unknown>;
    return typeof bump.productId === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(bump.productId) ? [{ productId: bump.productId, title: typeof bump.title === 'string' ? bump.title : '', message: typeof bump.message === 'string' ? bump.message : '' }] : [];
  }) : [];
  if (configured.length) return configured;
  return typeof config.orderBumpProductId === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(config.orderBumpProductId) ? [{ productId: config.orderBumpProductId, title: typeof config.orderBumpTitle === 'string' ? config.orderBumpTitle : '', message: typeof config.orderBumpMessage === 'string' ? config.orderBumpMessage : '' }] : [];
};
const sessionDiscount = (subtotal: number, coupon: { type: 'PERCENT' | 'FIXED'; value: number; maxDiscountCents: number | null } | null): number => {
  if (!coupon) return 0;
  let discount = coupon.type === 'PERCENT' ? Math.floor(subtotal * coupon.value / 10_000) : coupon.value;
  if (coupon.maxDiscountCents) discount = Math.min(discount, coupon.maxDiscountCents);
  return Math.max(0, Math.min(discount, subtotal - 1));
};
const checkoutSessionExpiry = (publishedConfig: unknown, fallback: Date): Date => {
  if (typeof publishedConfig !== 'object' || publishedConfig === null || Array.isArray(publishedConfig)) return fallback;
  const minutes = (publishedConfig as Record<string, unknown>).timerMinutes;
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 1 || minutes > 60) return fallback;
  return new Date(Date.now() + minutes * 60_000);
};

export class PrismaCatalogRepository implements CatalogRepository {
  async hasActiveDomain(context: StoreContext): Promise<boolean> {
    return (await this.database.storeDomain.count({ where: { storeId: context.storeId, status: 'ACTIVE' } })) > 0;
  }
  constructor(private readonly database: PrismaClient) {}
  async resolveStoreContext(userId: string, sessionId: string): Promise<StoreContext | null> {
    const session = await this.database.session.findFirst({ where: { id: sessionId, userId, revokedAt: null }, select: { activeStoreId: true } });
    const membership = session?.activeStoreId
      ? await this.database.storeMember.findFirst({ where: { userId, storeId: session.activeStoreId, store: { active: true } }, select: { storeId: true, role: true } })
      : await this.database.storeMember.findFirst({ where: { userId, store: { active: true } }, orderBy: { createdAt: 'asc' }, select: { storeId: true, role: true } });
    return membership ? { storeId: membership.storeId, userId, sessionId, role: membership.role } : null;
  }
  async listProducts(context: StoreContext, query: ProductListQuery): Promise<ProductListResult> {
    const where: Prisma.ProductWhereInput = { storeId: context.storeId, archivedAt: null, ...(query.status ? { active: query.status === 'active' } : {}), ...(query.source ? { source: query.source } : {}), ...(query.search ? { OR: [{ checkoutTitle: { contains: query.search, mode: 'insensitive' } }, { sourceTitle: { contains: query.search, mode: 'insensitive' } }, { vendor: { contains: query.search, mode: 'insensitive' } }, { handle: { contains: query.search, mode: 'insensitive' } }] } : {}) };
    const [items, total] = await this.database.$transaction([this.database.product.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: productSelect }), this.database.product.count({ where })]);
    return { items, total };
  }
  getProduct(context: StoreContext, publicId: string): Promise<object | null> {
    return this.database.product.findFirst({ where: { storeId: context.storeId, publicId, archivedAt: null }, select: { ...productSelect, sourceDescriptionHtml: true, tags: true, variants: { orderBy: { createdAt: 'asc' }, select: { publicId: true, title: true, sku: true, barcode: true, priceCents: true, compareAtCents: true, inventoryQuantity: true, availableForSale: true, imageUrl: true, selectedOptions: true } }, images: { orderBy: { position: 'asc' }, select: { id: true, url: true, altText: true, width: true, height: true, position: true } }, collections: { select: { collection: { select: { publicId: true, title: true, handle: true, imageUrl: true } } } } } });
  }
  async createProduct(context: StoreContext, input: ProductInput, requestId: string): Promise<object> {
    return this.database.$transaction(async transaction => {
      const product = await transaction.product.create({ data: { storeId: context.storeId, sourceTitle: input.title, checkoutTitle: input.title, priceCents: input.priceCents, trackInventory: input.trackInventory, maxPerOrder: input.maxPerOrder, active: input.active, fulfillmentType: input.fulfillmentType, ...(input.externalDeliveryUrl !== undefined ? { externalDeliveryUrl: input.externalDeliveryUrl } : {}), ...(input.description !== undefined ? { checkoutDescription: input.description } : {}), ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}), ...(input.compareAtCents !== undefined ? { compareAtCents: input.compareAtCents } : {}), ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}), variants: { create: { sourceExternalId: 'manual-default', title: 'Padrão', priceCents: input.priceCents, ...(input.compareAtCents !== undefined ? { compareAtCents: input.compareAtCents } : {}), ...(input.stockQuantity !== undefined ? { inventoryQuantity: input.stockQuantity } : {}), ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}) } } }, select: productSelect });
      await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'product.created', targetType: 'product', targetId: product.publicId, requestId } });
      return product;
    });
  }

  async deleteManualProduct(context: StoreContext, publicId: string, requestId: string): Promise<'deleted' | 'archived' | 'not_found'> {
    const product = await this.database.product.findFirst({ where: { storeId: context.storeId, publicId, source: 'MANUAL', archivedAt: null }, select: { id: true } });
    if (!product) return 'not_found';
    return this.database.$transaction(async transaction => {
      const [checkoutCount, itemCount] = await Promise.all([
        transaction.checkout.count({ where: { productId: product.id } }),
        transaction.checkoutSessionItem.count({ where: { productId: product.id } })
      ]);
      if (checkoutCount || itemCount) {
        await transaction.product.update({ where: { id: product.id }, data: { active: false, archivedAt: new Date() } });
        await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'product.manual_archived', targetType: 'product', targetId: publicId, requestId } });
        return 'archived';
      }
      await transaction.product.delete({ where: { id: product.id } });
      await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'product.manual_deleted', targetType: 'product', targetId: publicId, requestId } });
      return 'deleted';
    });
  }
  listShippingMethods(context: StoreContext): Promise<readonly object[]> {
    return this.database.shippingMethod.findMany({ where: { storeId: context.storeId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { publicId: true, name: true, priceCents: true, minDays: true, maxDays: true, active: true, position: true } });
  }
  async createShippingMethod(context: StoreContext, input: ShippingMethodInput, requestId: string): Promise<object> {
    return this.database.$transaction(async transaction => {
      const position = await transaction.shippingMethod.count({ where: { storeId: context.storeId } });
      const method = await transaction.shippingMethod.create({ data: { storeId: context.storeId, ...input, position }, select: { publicId: true, name: true, priceCents: true, minDays: true, maxDays: true, active: true, position: true } });
      await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'shipping_method.created', targetType: 'shipping_method', targetId: method.publicId, requestId } });
      return method;
    });
  }
  async updateShippingMethod(context: StoreContext, publicId: string, input: ShippingMethodInput, requestId: string): Promise<object | null> {
    const existing = await this.database.shippingMethod.findFirst({ where: { storeId: context.storeId, publicId }, select: { id: true } }); if (!existing) return null;
    return this.database.$transaction(async transaction => {
      const method = await transaction.shippingMethod.update({ where: { id: existing.id }, data: input, select: { publicId: true, name: true, priceCents: true, minDays: true, maxDays: true, active: true, position: true } });
      await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'shipping_method.updated', targetType: 'shipping_method', targetId: method.publicId, requestId } });
      return method;
    });
  }
  async deleteShippingMethod(context: StoreContext, publicId: string, requestId: string): Promise<boolean> {
    return this.database.$transaction(async transaction => { const method = await transaction.shippingMethod.findFirst({ where: { storeId: context.storeId, publicId }, select: { id: true } }); if (!method) return false; await transaction.shippingMethod.delete({ where: { id: method.id } }); await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'shipping_method.deleted', targetType: 'shipping_method', targetId: publicId, requestId } }); return true; });
  }
  listCheckouts(context: StoreContext): Promise<readonly object[]> {
    return this.database.checkout.findMany({ where: { storeId: context.storeId, archivedAt: null }, orderBy: { createdAt: 'desc' }, take: 100, select: checkoutSelect });
  }
  async createCheckout(context: StoreContext, input: CheckoutInput, requestId: string): Promise<object | 'limit_reached' | null> {
    const product = input.mode === 'DIRECT_LINK' ? await this.database.product.findFirst({ where: { publicId: input.productPublicId, storeId: context.storeId, active: true }, select: { id: true } }) : null;
    if (input.mode === 'DIRECT_LINK' && !product) return null;
    return this.database.$transaction(async transaction => {
      const owner = await transaction.storeMember.findFirst({ where: { storeId: context.storeId, role: 'OWNER' }, orderBy: { createdAt: 'asc' }, select: { user: { select: { billingSubscription: true } } } });
      const checkoutCount = await transaction.checkout.count({ where: { storeId: context.storeId, archivedAt: null } });
      const subscription = owner?.user.billingSubscription;
      if (checkoutCount >= planLimits(subscription ? effectiveBilling(subscription).plan : undefined).checkoutsPerStore) return 'limit_reached';
      const checkout = await transaction.checkout.create({ data: { storeId: context.storeId, productId: product?.id ?? null, mode: input.mode, name: input.name, slug: input.slug, draftConfig: input.draftConfig as Prisma.InputJsonValue }, select: checkoutSelect });
      await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'checkout.created', targetType: 'checkout', targetId: checkout.publicId, requestId } });
      return checkout;
    }, { isolationLevel: 'Serializable' });
  }

  async deleteCheckout(context: StoreContext, publicId: string, requestId: string): Promise<'deleted' | 'archived' | 'not_found'> {
    const checkout = await this.database.checkout.findFirst({ where: { publicId, storeId: context.storeId, archivedAt: null }, select: { id: true, slug: true } });
    if (!checkout) return 'not_found';
    return this.database.$transaction(async transaction => {
      const sessionCount = await transaction.checkoutSession.count({ where: { checkoutId: checkout.id } });
      if (sessionCount) {
        const archivedSlug = `${checkout.slug.slice(0, 60)}-archived-${publicId.slice(-8).toLowerCase()}`;
        await transaction.checkout.update({ where: { id: checkout.id }, data: { status: 'DRAFT', isDefault: false, slug: archivedSlug, archivedAt: new Date() } });
        await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'checkout.archived', targetType: 'checkout', targetId: publicId, requestId } });
        return 'archived';
      }
      await transaction.checkout.delete({ where: { id: checkout.id } });
      await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'checkout.deleted', targetType: 'checkout', targetId: publicId, requestId } });
      return 'deleted';
    });
  }

  async updateCheckoutDraft(context: StoreContext, publicId: string, config: CheckoutConfigInput, requestId: string): Promise<object | null> {
    const checkout = await this.database.checkout.findFirst({ where: { publicId, storeId: context.storeId, archivedAt: null }, select: { id: true } });
    if (!checkout) return null;
    return this.database.$transaction(async transaction => {
      const updated = await transaction.checkout.update({ where: { id: checkout.id }, data: { draftConfig: config as Prisma.InputJsonValue }, select: checkoutSelect });
      await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'checkout.draft_updated', targetType: 'checkout', targetId: publicId, requestId } });
      return updated;
    });
  }

  async publishCheckout(context: StoreContext, publicId: string, requestId: string): Promise<object | null> {
    const checkout = await this.database.checkout.findFirst({ where: { publicId, storeId: context.storeId, archivedAt: null, OR: [{ mode: 'SHOPIFY_CART' }, { mode: 'DIRECT_LINK', product: { is: { active: true } } }] }, select: { id: true, mode: true } });
    if (!checkout) return null;
    return this.database.$transaction(async transaction => {
      const current = await transaction.checkout.findUniqueOrThrow({ where: { id: checkout.id }, select: { draftConfig: true } });
      if (checkout.mode === 'SHOPIFY_CART') await transaction.checkout.updateMany({ where: { storeId: context.storeId, mode: 'SHOPIFY_CART', isDefault: true, id: { not: checkout.id } }, data: { isDefault: false } });
      const published = await transaction.checkout.update({ where: { id: checkout.id }, data: { status: 'PUBLISHED', isDefault: checkout.mode === 'SHOPIFY_CART', publishedConfig: current.draftConfig as Prisma.InputJsonValue, publishedAt: new Date() }, select: checkoutSelect });
      await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'checkout.published', targetType: 'checkout', targetId: publicId, requestId } });
      return published;
    });
  }

  getPublicCheckout(storeSlug: string, checkoutSlug: string): Promise<object | null> {
    return this.database.checkout.findFirst({
      where: { slug: checkoutSlug, mode: 'DIRECT_LINK', status: 'PUBLISHED', archivedAt: null, store: { slug: storeSlug, active: true, customDomain: { is: { status: 'ACTIVE' } } }, product: { is: { active: true } } },
      select: { publicId: true, slug: true, name: true, publishedConfig: true, store: { select: { publicId: true, name: true } }, product: { select: { publicId: true, checkoutTitle: true, checkoutDescription: true, fulfillmentType: true, imageUrl: true, priceCents: true, compareAtCents: true, maxPerOrder: true, stockQuantity: true, trackInventory: true, variants: { where: { availableForSale: true }, orderBy: { createdAt: 'asc' }, select: { publicId: true, title: true, priceCents: true, compareAtCents: true, inventoryQuantity: true, availableForSale: true, imageUrl: true, selectedOptions: true } } } } }
    });
  }

  async createPublicCheckoutSession(input: CheckoutSessionInput): Promise<object | null> {
    return this.database.$transaction(async transaction => {
      const checkout = await transaction.checkout.findFirst({ where: { slug: input.checkoutSlug, mode: 'DIRECT_LINK', status: 'PUBLISHED', archivedAt: null, store: { slug: input.storeSlug, active: true, customDomain: { is: { status: 'ACTIVE' } } }, product: { is: { active: true } } }, select: { id: true, productId: true, publishedConfig: true, product: { select: { publicId: true, checkoutTitle: true, fulfillmentType: true, imageUrl: true, priceCents: true, maxPerOrder: true, stockQuantity: true, trackInventory: true } } } });
      if (!checkout?.product || !checkout.productId || input.quantity > checkout.product.maxPerOrder || (checkout.product.trackInventory && (checkout.product.stockQuantity ?? 0) < input.quantity)) return null;
      const variant = input.variantPublicId ? await transaction.productVariant.findFirst({ where: { publicId: input.variantPublicId, productId: checkout.productId, availableForSale: true }, select: { id: true, publicId: true, title: true, priceCents: true, inventoryQuantity: true, imageUrl: true } }) : null;
      if (input.variantPublicId && !variant) return null;
      if (variant?.inventoryQuantity !== null && variant?.inventoryQuantity !== undefined && variant.inventoryQuantity < input.quantity) return null;
      const unitPriceCents = variant?.priceCents ?? checkout.product.priceCents;
      const session = await transaction.checkoutSession.create({ data: { checkoutId: checkout.id, variantId: variant?.id ?? null, quantity: input.quantity, unitPriceCents, totalCents: unitPriceCents * input.quantity, tokenHash: input.tokenHash, source: input.source, trackingParameters: input.trackingParameters ?? {}, expiresAt: checkoutSessionExpiry(checkout.publishedConfig, input.expiresAt), ...(input.sourceCartId ? { sourceCartId: input.sourceCartId } : {}) }, select: { publicId: true, quantity: true, unitPriceCents: true, totalCents: true, currency: true, status: true, expiresAt: true, checkout: { select: { slug: true, name: true, publishedConfig: true, store: { select: { name: true } } } }, variant: { select: { publicId: true, title: true, imageUrl: true } } } });
      return { ...session, product: checkout.product };
    });
  }

  async getPublicCheckoutSession(publicId: string, tokenHash: string, now: Date): Promise<object | null> {
    const session = await this.database.checkoutSession.findFirst({ where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now } }, select: { publicId: true, source: true, quantity: true, unitPriceCents: true, totalCents: true, discountCents: true, couponCode: true, shippingPriceCents: true, currency: true, status: true, expiresAt: true, customerCapturedAt: true, shippingCapturedAt: true, checkout: { select: { storeId: true, slug: true, name: true, publishedConfig: true, store: { select: { name: true } }, product: { select: { publicId: true, checkoutTitle: true, checkoutDescription: true, fulfillmentType: true, imageUrl: true, maxPerOrder: true } } } }, variant: { select: { publicId: true, title: true, imageUrl: true } }, items: { select: { quantity: true, unitPriceCents: true, totalCents: true, titleSnapshot: true, variantSnapshot: true, imageUrlSnapshot: true, isOrderBump: true, product: { select: { publicId: true } } } } } });
    if (!session) return null;
    const config = session.checkout.publishedConfig as Record<string, unknown>;
    const configured = configuredOrderBumps(config);
    const products = configured.length ? await this.database.product.findMany({ where: { publicId: { in: configured.map(bump => bump.productId) }, storeId: session.checkout.storeId, active: true }, select: { publicId: true, checkoutTitle: true, checkoutDescription: true, imageUrl: true, priceCents: true } }) : [];
    const byId = new Map(products.map(product => [product.publicId, product]));
    const orderBumps = configured.flatMap(bump => { const product = byId.get(bump.productId); return product ? [{ ...product, offerTitle: bump.title, offerMessage: bump.message }] : []; });
    const checkout = { slug: session.checkout.slug, name: session.checkout.name, publishedConfig: session.checkout.publishedConfig, store: session.checkout.store, product: session.checkout.product };
    return { ...session, checkout, orderBump: orderBumps[0] ?? null, orderBumps, customerCaptured: Boolean(session.customerCapturedAt), shippingCaptured: Boolean(session.shippingCapturedAt), customerCapturedAt: undefined, shippingCapturedAt: undefined };
  }

  async touchPublicCheckoutSession(publicId: string, tokenHash: string, now: Date): Promise<boolean> {
    const result = await this.database.checkoutSession.updateMany({ where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now } }, data: { updatedAt: now } });
    return result.count === 1;
  }

  async getPaidDigitalDelivery(publicId: string, tokenHash: string): Promise<object | null> {
    const session = await this.database.checkoutSession.findFirst({ where: { publicId, tokenHash, status: 'COMPLETED' }, select: { checkout: { select: { product: { select: { checkoutTitle: true, fulfillmentType: true, externalDeliveryUrl: true } } } } } });
    const product = session?.checkout.product;
    return product?.fulfillmentType === 'DIGITAL' && product.externalDeliveryUrl ? { title: product.checkoutTitle, url: product.externalDeliveryUrl } : null;
  }

  async setPublicOrderBump(publicId: string, tokenHash: string, productPublicId: string, enabled: boolean, now: Date): Promise<object | null> {
    return this.database.$transaction(async transaction => {
      const session = await transaction.checkoutSession.findFirst({ where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now } }, select: { id: true, totalCents: true, shippingPriceCents: true, coupon: { select: { type: true, value: true, maxDiscountCents: true } }, checkout: { select: { storeId: true, publishedConfig: true } } } });
      if (!session) return null;
      const config = session.checkout.publishedConfig as Record<string, unknown>;
      if (!configuredOrderBumps(config).some(bump => bump.productId === productPublicId)) return null;
      const product = await transaction.product.findFirst({ where: { publicId: productPublicId, storeId: session.checkout.storeId, active: true }, select: { id: true, checkoutTitle: true, imageUrl: true, variants: { where: { availableForSale: true }, orderBy: { createdAt: 'asc' }, take: 1, select: { id: true, title: true, priceCents: true, imageUrl: true } } } });
      const variant = product?.variants[0]; if (!product || !variant) return null;
      const existing = await transaction.checkoutSessionItem.findFirst({ where: { checkoutSessionId: session.id, productId: product.id, isOrderBump: true }, select: { id: true, totalCents: true } });
      if (enabled && !existing) {
        await transaction.checkoutSessionItem.create({ data: { checkoutSessionId: session.id, productId: product.id, variantId: variant.id, quantity: 1, unitPriceCents: variant.priceCents, totalCents: variant.priceCents, titleSnapshot: product.checkoutTitle, variantSnapshot: variant.title, imageUrlSnapshot: variant.imageUrl ?? product.imageUrl, isOrderBump: true } });
        const totalCents = session.totalCents + variant.priceCents;
        const discountCents = sessionDiscount(totalCents, session.coupon); await transaction.checkoutSession.update({ where: { id: session.id }, data: { totalCents, discountCents } });
        return { totalCents, discountCents, shippingPriceCents: session.shippingPriceCents, grandTotalCents: totalCents - discountCents + session.shippingPriceCents, enabled: true };
      }
      if (!enabled && existing) {
        await transaction.checkoutSessionItem.delete({ where: { id: existing.id } });
        const totalCents = session.totalCents - existing.totalCents;
        const discountCents = sessionDiscount(totalCents, session.coupon); await transaction.checkoutSession.update({ where: { id: session.id }, data: { totalCents, discountCents } });
        return { totalCents, discountCents, shippingPriceCents: session.shippingPriceCents, grandTotalCents: totalCents - discountCents + session.shippingPriceCents, enabled: false };
      }
      const discountCents = sessionDiscount(session.totalCents, session.coupon); return { totalCents: session.totalCents, discountCents, shippingPriceCents: session.shippingPriceCents, grandTotalCents: session.totalCents - discountCents + session.shippingPriceCents, enabled };
    });
  }

  async updatePublicCheckoutQuantity(publicId: string, tokenHash: string, quantity: number, now: Date): Promise<object | null> {
    return this.database.$transaction(async transaction => {
      const session = await transaction.checkoutSession.findFirst({
        where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now } },
        select: {
          id: true, unitPriceCents: true, source: true, shippingPriceCents: true,
          coupon: { select: { type: true, value: true, maxDiscountCents: true } },
          variant: { select: { inventoryQuantity: true } },
          checkout: { select: { product: { select: { maxPerOrder: true, trackInventory: true, stockQuantity: true } } } },
          items: { select: { isOrderBump: true, totalCents: true } },
          paymentAttempts: { take: 1, select: { id: true } }
        }
      });
      const product = session?.checkout.product;
      if (!session || session.source !== 'DIRECT' || !product || session.paymentAttempts.length || session.items.some(item => !item.isOrderBump) || quantity < 1 || quantity > product.maxPerOrder || product.trackInventory && (product.stockQuantity ?? 0) < quantity || session.variant?.inventoryQuantity !== null && session.variant?.inventoryQuantity !== undefined && session.variant.inventoryQuantity < quantity) return null;
      const bumpsTotal = session.items.reduce((total, item) => total + item.totalCents, 0); const totalCents = session.unitPriceCents * quantity + bumpsTotal; const discountCents = sessionDiscount(totalCents, session.coupon);
      await transaction.checkoutSession.update({ where: { id: session.id }, data: { quantity, totalCents, discountCents } });
      return { quantity, totalCents, discountCents, shippingPriceCents: session.shippingPriceCents, grandTotalCents: totalCents - discountCents + session.shippingPriceCents };
    });
  }

  async updatePublicCheckoutCustomer(publicId: string, tokenHash: string, now: Date, input: CheckoutCustomerInput): Promise<object | null> {
    const result = await this.database.checkoutSession.updateMany({ where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now } }, data: { customerDataEncrypted: input.encryptedData, customerEmailHash: input.emailHash, customerDocumentHash: input.documentHash, customerCapturedAt: now, shippingAddressEncrypted: null, shippingCapturedAt: null } });
    return result.count === 1 ? { customerCaptured: true, shippingCaptured: false } : null;
  }

  async updatePublicCheckoutShipping(publicId: string, tokenHash: string, now: Date, input: CheckoutShippingInput): Promise<object | null> {
    const result = await this.database.checkoutSession.updateMany({ where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now }, customerCapturedAt: { not: null } }, data: { shippingAddressEncrypted: input.encryptedData, shippingCapturedAt: now, shippingMethodPublicId: null, shippingMethodName: null, shippingPriceCents: 0, shippingMinDays: null, shippingMaxDays: null } });
    return result.count === 1 ? { customerCaptured: true, shippingCaptured: true } : null;
  }

  async listPublicShippingMethods(publicId: string, tokenHash: string, now: Date): Promise<readonly object[] | null> {
    const session = await this.database.checkoutSession.findFirst({ where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now }, shippingCapturedAt: { not: null } }, select: { checkout: { select: { storeId: true } } } });
    if (!session) return null;
    return this.database.shippingMethod.findMany({ where: { storeId: session.checkout.storeId, active: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { publicId: true, name: true, priceCents: true, minDays: true, maxDays: true } });
  }

  async selectPublicShippingMethod(publicId: string, tokenHash: string, methodPublicId: string, now: Date): Promise<object | null> {
    return this.database.$transaction(async transaction => {
      const session = await transaction.checkoutSession.findFirst({ where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now }, shippingCapturedAt: { not: null } }, select: { id: true, totalCents: true, discountCents: true, checkout: { select: { storeId: true } } } });
      if (!session) return null;
      const method = await transaction.shippingMethod.findFirst({ where: { publicId: methodPublicId, storeId: session.checkout.storeId, active: true }, select: { publicId: true, name: true, priceCents: true, minDays: true, maxDays: true } });
      if (!method) return null;
      await transaction.checkoutSession.update({ where: { id: session.id }, data: { shippingMethodPublicId: method.publicId, shippingMethodName: method.name, shippingPriceCents: method.priceCents, shippingMinDays: method.minDays, shippingMaxDays: method.maxDays } });
      return { shippingMethod: method, subtotalCents: session.totalCents, discountCents: session.discountCents, shippingPriceCents: method.priceCents, grandTotalCents: session.totalCents - session.discountCents + method.priceCents };
    });
  }

  async createShopifyCartSession(input: ShopifyCartSessionInput): Promise<object | null> {
    return this.database.$transaction(async transaction => {
      const connection = await transaction.shopifyConnection.findFirst({ where: { shopDomain: input.shopDomain, revokedAt: null, store: { active: true } }, select: { storeId: true, store: { select: { slug: true } } } });
      if (!connection) return null;
      let checkout = await transaction.checkout.findFirst({ where: { storeId: connection.storeId, mode: 'SHOPIFY_CART', isDefault: true, status: 'PUBLISHED', archivedAt: null }, select: { id: true, publishedConfig: true } });
      // Compatibilidade temporária: instalações antigas ainda enviam o slug do
      // checkout. Assim que um modelo Shopify for publicado, ele sempre vence.
      if (!checkout && input.checkoutSlug) checkout = await transaction.checkout.findFirst({ where: { storeId: connection.storeId, slug: input.checkoutSlug, status: 'PUBLISHED', archivedAt: null }, select: { id: true, publishedConfig: true } });
      if (!checkout) return null;
      const quantitiesByVariant = new Map<string, number>();
      for (const line of input.lines) quantitiesByVariant.set(line.variantId, (quantitiesByVariant.get(line.variantId) ?? 0) + line.quantity);
      const normalizedLines = [...quantitiesByVariant].map(([variantId, quantity]) => ({ variantId, quantity }));
      const requestedIds = normalizedLines.map(line => `gid://shopify/ProductVariant/${line.variantId}`);
      const variants = await transaction.productVariant.findMany({ where: { sourceExternalId: { in: requestedIds }, availableForSale: true, product: { storeId: connection.storeId, source: 'SHOPIFY', active: true } }, select: { id: true, sourceExternalId: true, title: true, priceCents: true, imageUrl: true, product: { select: { id: true, checkoutTitle: true, imageUrl: true, maxPerOrder: true } } } });
      const byExternalId = new Map(variants.map(variant => [variant.sourceExternalId, variant]));
      const items = normalizedLines.map(line => ({ line, variant: byExternalId.get(`gid://shopify/ProductVariant/${line.variantId}`) })).filter((item): item is { line: { variantId: string; quantity: number }; variant: NonNullable<typeof item.variant> } => Boolean(item.variant));
      // `availableForSale` is the authoritative Shopify storefront signal. A
      // variant can legitimately have inventoryQuantity=0 and remain for sale
      // when "continue selling when out of stock" is enabled. Rejecting those
      // variants here made valid Shopify carts return CHECKOUT_UNAVAILABLE.
      if (items.length !== normalizedLines.length || items.some(({ line, variant }) => line.quantity > variant.product.maxPerOrder)) return null;
      const totalCents = items.reduce((total, { line, variant }) => total + variant.priceCents * line.quantity, 0);
      const first = items[0]; if (!first) return null;
      const session = await transaction.checkoutSession.create({ data: { checkoutId: checkout.id, variantId: first.variant.id, quantity: items.reduce((total, item) => total + item.line.quantity, 0), unitPriceCents: first.variant.priceCents, totalCents, tokenHash: input.tokenHash, source: 'SHOPIFY', expiresAt: checkoutSessionExpiry(checkout.publishedConfig, input.expiresAt), ...(input.sourceCartId ? { sourceCartId: input.sourceCartId } : {}), items: { create: items.map(({ line, variant }) => ({ productId: variant.product.id, variantId: variant.id, quantity: line.quantity, unitPriceCents: variant.priceCents, totalCents: variant.priceCents * line.quantity, titleSnapshot: variant.product.checkoutTitle, variantSnapshot: variant.title, imageUrlSnapshot: variant.imageUrl ?? variant.product.imageUrl })) } }, select: { publicId: true, totalCents: true, currency: true, expiresAt: true, checkout: { select: { slug: true } }, items: { select: { quantity: true, unitPriceCents: true, totalCents: true, titleSnapshot: true, variantSnapshot: true, imageUrlSnapshot: true } } } });
      return { ...session, storeSlug: connection.store.slug };
    });
  }
}
