import type { Prisma, PrismaClient } from '@solid/database';

export type StoreContext = Readonly<{ storeId: string; userId: string; sessionId: string; role: 'OWNER' | 'ADMIN' | 'ANALYST' }>;
export type ProductInput = Readonly<{ title: string; description?: string; imageUrl?: string; priceCents: number; compareAtCents?: number; stockQuantity?: number; trackInventory: boolean; maxPerOrder: number; active: boolean }>;
export type CheckoutInput = Readonly<{ name: string; slug: string; productPublicId: string; draftConfig: Record<string, unknown> }>;
export type CheckoutConfigInput = Readonly<Record<string, unknown>>;
export type CheckoutSessionInput = Readonly<{ storeSlug: string; checkoutSlug: string; variantPublicId?: string; quantity: number; tokenHash: string; source: 'DIRECT' | 'SHOPIFY'; sourceCartId?: string; expiresAt: Date }>;
export type ShopifyCartSessionInput = Readonly<{ shopDomain: string; checkoutSlug: string; lines: readonly Readonly<{ variantId: string; quantity: number }>[]; tokenHash: string; sourceCartId?: string; expiresAt: Date }>;
export type CheckoutCustomerInput = Readonly<{ encryptedData: string; emailHash: string; documentHash: string }>;
export type CheckoutShippingInput = Readonly<{ encryptedData: string }>;
export type ShippingMethodInput = Readonly<{ name: string; priceCents: number; minDays: number; maxDays: number; active: boolean }>;
export type ProductListQuery = Readonly<{ search?: string; status?: 'active' | 'inactive'; source?: 'MANUAL' | 'SHOPIFY'; page: number; pageSize: number }>;
export type ProductListResult = Readonly<{ items: readonly object[]; total: number }>;

export interface CatalogRepository {
  resolveStoreContext(userId: string, sessionId: string): Promise<StoreContext | null>;
  listProducts(context: StoreContext, query: ProductListQuery): Promise<ProductListResult>;
  getProduct(context: StoreContext, publicId: string): Promise<object | null>;
  createProduct(context: StoreContext, input: ProductInput, requestId: string): Promise<object>;
  listCheckouts(context: StoreContext): Promise<readonly object[]>;
  createCheckout(context: StoreContext, input: CheckoutInput, requestId: string): Promise<object | null>;
  updateCheckoutDraft(context: StoreContext, publicId: string, config: CheckoutConfigInput, requestId: string): Promise<object | null>;
  publishCheckout(context: StoreContext, publicId: string, requestId: string): Promise<object | null>;
  getPublicCheckout(storeSlug: string, checkoutSlug: string): Promise<object | null>;
  createPublicCheckoutSession(input: CheckoutSessionInput): Promise<object | null>;
  getPublicCheckoutSession(publicId: string, tokenHash: string, now: Date): Promise<object | null>;
  createShopifyCartSession(input: ShopifyCartSessionInput): Promise<object | null>;
  updatePublicCheckoutCustomer(publicId: string, tokenHash: string, now: Date, input: CheckoutCustomerInput): Promise<object | null>;
  updatePublicCheckoutShipping(publicId: string, tokenHash: string, now: Date, input: CheckoutShippingInput): Promise<object | null>;
  listShippingMethods(context: StoreContext): Promise<readonly object[]>;
  createShippingMethod(context: StoreContext, input: ShippingMethodInput, requestId: string): Promise<object>;
  updateShippingMethod(context: StoreContext, publicId: string, input: ShippingMethodInput, requestId: string): Promise<object | null>;
  listPublicShippingMethods(publicId: string, tokenHash: string, now: Date): Promise<readonly object[] | null>;
  selectPublicShippingMethod(publicId: string, tokenHash: string, methodPublicId: string, now: Date): Promise<object | null>;
  setPublicOrderBump(publicId: string, tokenHash: string, enabled: boolean, now: Date): Promise<object | null>;
}

const productSelect = { publicId: true, sourceTitle: true, checkoutTitle: true, checkoutDescription: true, handle: true, vendor: true, productType: true, tags: true, imageUrl: true, priceCents: true, compareAtCents: true, stockQuantity: true, trackInventory: true, maxPerOrder: true, active: true, source: true, syncedAt: true, createdAt: true, updatedAt: true, _count: { select: { variants: true, images: true, collections: true } } } as const;
const checkoutSelect = { publicId: true, name: true, slug: true, status: true, draftConfig: true, publishedConfig: true, publishedAt: true, createdAt: true, updatedAt: true, product: { select: { publicId: true, checkoutTitle: true, priceCents: true, active: true } } } as const;

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly database: PrismaClient) {}
  async resolveStoreContext(userId: string, sessionId: string): Promise<StoreContext | null> {
    const session = await this.database.session.findFirst({ where: { id: sessionId, userId, revokedAt: null }, select: { activeStoreId: true } });
    const membership = session?.activeStoreId
      ? await this.database.storeMember.findFirst({ where: { userId, storeId: session.activeStoreId, store: { active: true } }, select: { storeId: true, role: true } })
      : await this.database.storeMember.findFirst({ where: { userId, store: { active: true } }, orderBy: { createdAt: 'asc' }, select: { storeId: true, role: true } });
    return membership ? { storeId: membership.storeId, userId, sessionId, role: membership.role } : null;
  }
  async listProducts(context: StoreContext, query: ProductListQuery): Promise<ProductListResult> {
    const where: Prisma.ProductWhereInput = { storeId: context.storeId, ...(query.status ? { active: query.status === 'active' } : {}), ...(query.source ? { source: query.source } : {}), ...(query.search ? { OR: [{ checkoutTitle: { contains: query.search, mode: 'insensitive' } }, { sourceTitle: { contains: query.search, mode: 'insensitive' } }, { vendor: { contains: query.search, mode: 'insensitive' } }, { handle: { contains: query.search, mode: 'insensitive' } }] } : {}) };
    const [items, total] = await this.database.$transaction([this.database.product.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: productSelect }), this.database.product.count({ where })]);
    return { items, total };
  }
  getProduct(context: StoreContext, publicId: string): Promise<object | null> {
    return this.database.product.findFirst({ where: { storeId: context.storeId, publicId }, select: { ...productSelect, sourceDescriptionHtml: true, tags: true, variants: { orderBy: { createdAt: 'asc' }, select: { publicId: true, title: true, sku: true, barcode: true, priceCents: true, compareAtCents: true, inventoryQuantity: true, availableForSale: true, imageUrl: true, selectedOptions: true } }, images: { orderBy: { position: 'asc' }, select: { id: true, url: true, altText: true, width: true, height: true, position: true } }, collections: { select: { collection: { select: { publicId: true, title: true, handle: true, imageUrl: true } } } } } });
  }
  async createProduct(context: StoreContext, input: ProductInput, requestId: string): Promise<object> {
    return this.database.$transaction(async transaction => {
      const product = await transaction.product.create({ data: { storeId: context.storeId, sourceTitle: input.title, checkoutTitle: input.title, priceCents: input.priceCents, trackInventory: input.trackInventory, maxPerOrder: input.maxPerOrder, active: input.active, ...(input.description !== undefined ? { checkoutDescription: input.description } : {}), ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}), ...(input.compareAtCents !== undefined ? { compareAtCents: input.compareAtCents } : {}), ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}) }, select: productSelect });
      await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'product.created', targetType: 'product', targetId: product.publicId, requestId } });
      return product;
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
  listCheckouts(context: StoreContext): Promise<readonly object[]> {
    return this.database.checkout.findMany({ where: { storeId: context.storeId }, orderBy: { createdAt: 'desc' }, take: 100, select: checkoutSelect });
  }
  async createCheckout(context: StoreContext, input: CheckoutInput, requestId: string): Promise<object | null> {
    const product = await this.database.product.findFirst({ where: { publicId: input.productPublicId, storeId: context.storeId, active: true }, select: { id: true } });
    if (!product) return null;
    return this.database.$transaction(async transaction => {
      const checkout = await transaction.checkout.create({ data: { storeId: context.storeId, productId: product.id, name: input.name, slug: input.slug, draftConfig: input.draftConfig as Prisma.InputJsonValue }, select: checkoutSelect });
      await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'checkout.created', targetType: 'checkout', targetId: checkout.publicId, requestId } });
      return checkout;
    });
  }

  async updateCheckoutDraft(context: StoreContext, publicId: string, config: CheckoutConfigInput, requestId: string): Promise<object | null> {
    const checkout = await this.database.checkout.findFirst({ where: { publicId, storeId: context.storeId }, select: { id: true } });
    if (!checkout) return null;
    return this.database.$transaction(async transaction => {
      const updated = await transaction.checkout.update({ where: { id: checkout.id }, data: { draftConfig: config as Prisma.InputJsonValue }, select: checkoutSelect });
      await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'checkout.draft_updated', targetType: 'checkout', targetId: publicId, requestId } });
      return updated;
    });
  }

  async publishCheckout(context: StoreContext, publicId: string, requestId: string): Promise<object | null> {
    const checkout = await this.database.checkout.findFirst({ where: { publicId, storeId: context.storeId, product: { active: true } }, select: { id: true } });
    if (!checkout) return null;
    return this.database.$transaction(async transaction => {
      const current = await transaction.checkout.findUniqueOrThrow({ where: { id: checkout.id }, select: { draftConfig: true } });
      const published = await transaction.checkout.update({ where: { id: checkout.id }, data: { status: 'PUBLISHED', publishedConfig: current.draftConfig as Prisma.InputJsonValue, publishedAt: new Date() }, select: checkoutSelect });
      await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'checkout.published', targetType: 'checkout', targetId: publicId, requestId } });
      return published;
    });
  }

  getPublicCheckout(storeSlug: string, checkoutSlug: string): Promise<object | null> {
    return this.database.checkout.findFirst({
      where: { slug: checkoutSlug, status: 'PUBLISHED', store: { slug: storeSlug, active: true }, product: { active: true } },
      select: { publicId: true, slug: true, name: true, publishedConfig: true, store: { select: { publicId: true, name: true } }, product: { select: { publicId: true, checkoutTitle: true, checkoutDescription: true, imageUrl: true, priceCents: true, compareAtCents: true, maxPerOrder: true, stockQuantity: true, trackInventory: true, variants: { where: { availableForSale: true }, orderBy: { createdAt: 'asc' }, select: { publicId: true, title: true, priceCents: true, compareAtCents: true, inventoryQuantity: true, availableForSale: true, imageUrl: true, selectedOptions: true } } } } }
    });
  }

  async createPublicCheckoutSession(input: CheckoutSessionInput): Promise<object | null> {
    return this.database.$transaction(async transaction => {
      const checkout = await transaction.checkout.findFirst({ where: { slug: input.checkoutSlug, status: 'PUBLISHED', store: { slug: input.storeSlug, active: true }, product: { active: true } }, select: { id: true, productId: true, product: { select: { publicId: true, checkoutTitle: true, imageUrl: true, priceCents: true, maxPerOrder: true, stockQuantity: true, trackInventory: true } } } });
      if (!checkout || input.quantity > checkout.product.maxPerOrder || (checkout.product.trackInventory && (checkout.product.stockQuantity ?? 0) < input.quantity)) return null;
      const variant = input.variantPublicId ? await transaction.productVariant.findFirst({ where: { publicId: input.variantPublicId, productId: checkout.productId, availableForSale: true }, select: { id: true, publicId: true, title: true, priceCents: true, inventoryQuantity: true, imageUrl: true } }) : null;
      if (input.variantPublicId && !variant) return null;
      if (variant?.inventoryQuantity !== null && variant?.inventoryQuantity !== undefined && variant.inventoryQuantity < input.quantity) return null;
      const unitPriceCents = variant?.priceCents ?? checkout.product.priceCents;
      const session = await transaction.checkoutSession.create({ data: { checkoutId: checkout.id, variantId: variant?.id ?? null, quantity: input.quantity, unitPriceCents, totalCents: unitPriceCents * input.quantity, tokenHash: input.tokenHash, source: input.source, expiresAt: input.expiresAt, ...(input.sourceCartId ? { sourceCartId: input.sourceCartId } : {}) }, select: { publicId: true, quantity: true, unitPriceCents: true, totalCents: true, currency: true, status: true, expiresAt: true, checkout: { select: { slug: true, name: true, publishedConfig: true, store: { select: { name: true } } } }, variant: { select: { publicId: true, title: true, imageUrl: true } } } });
      return { ...session, product: checkout.product };
    });
  }

  async getPublicCheckoutSession(publicId: string, tokenHash: string, now: Date): Promise<object | null> {
    const session = await this.database.checkoutSession.findFirst({ where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now } }, select: { publicId: true, quantity: true, unitPriceCents: true, totalCents: true, currency: true, status: true, expiresAt: true, customerCapturedAt: true, shippingCapturedAt: true, checkout: { select: { storeId: true, slug: true, name: true, publishedConfig: true, store: { select: { name: true } }, product: { select: { publicId: true, checkoutTitle: true, checkoutDescription: true, imageUrl: true } } } }, variant: { select: { publicId: true, title: true, imageUrl: true } }, items: { select: { quantity: true, unitPriceCents: true, totalCents: true, titleSnapshot: true, variantSnapshot: true, imageUrlSnapshot: true, isOrderBump: true } } } });
    if (!session) return null;
    const config = session.checkout.publishedConfig as Record<string, unknown>;
    const bumpId = typeof config.orderBumpProductId === 'string' ? config.orderBumpProductId : '';
    const bump = bumpId ? await this.database.product.findFirst({ where: { publicId: bumpId, storeId: session.checkout.storeId, active: true }, select: { publicId: true, checkoutTitle: true, checkoutDescription: true, imageUrl: true, priceCents: true } }) : null;
    const { storeId: _storeId, ...checkout } = session.checkout;
    return { ...session, checkout, orderBump: bump, customerCaptured: Boolean(session.customerCapturedAt), shippingCaptured: Boolean(session.shippingCapturedAt), customerCapturedAt: undefined, shippingCapturedAt: undefined };
  }

  async setPublicOrderBump(publicId: string, tokenHash: string, enabled: boolean, now: Date): Promise<object | null> {
    return this.database.$transaction(async transaction => {
      const session = await transaction.checkoutSession.findFirst({ where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now } }, select: { id: true, totalCents: true, shippingPriceCents: true, checkout: { select: { storeId: true, publishedConfig: true } } } });
      if (!session) return null;
      const config = session.checkout.publishedConfig as Record<string, unknown>;
      const bumpId = typeof config.orderBumpProductId === 'string' ? config.orderBumpProductId : '';
      if (!bumpId) return null;
      const product = await transaction.product.findFirst({ where: { publicId: bumpId, storeId: session.checkout.storeId, active: true }, select: { id: true, checkoutTitle: true, imageUrl: true, variants: { where: { availableForSale: true }, orderBy: { createdAt: 'asc' }, take: 1, select: { id: true, title: true, priceCents: true, imageUrl: true } } } });
      const variant = product?.variants[0]; if (!product || !variant) return null;
      const existing = await transaction.checkoutSessionItem.findFirst({ where: { checkoutSessionId: session.id, productId: product.id, isOrderBump: true }, select: { id: true, totalCents: true } });
      if (enabled && !existing) {
        await transaction.checkoutSessionItem.create({ data: { checkoutSessionId: session.id, productId: product.id, variantId: variant.id, quantity: 1, unitPriceCents: variant.priceCents, totalCents: variant.priceCents, titleSnapshot: product.checkoutTitle, variantSnapshot: variant.title, imageUrlSnapshot: variant.imageUrl ?? product.imageUrl, isOrderBump: true } });
        const totalCents = session.totalCents + variant.priceCents;
        await transaction.checkoutSession.update({ where: { id: session.id }, data: { totalCents } });
        return { totalCents, shippingPriceCents: session.shippingPriceCents, grandTotalCents: totalCents + session.shippingPriceCents, enabled: true };
      }
      if (!enabled && existing) {
        await transaction.checkoutSessionItem.delete({ where: { id: existing.id } });
        const totalCents = session.totalCents - existing.totalCents;
        await transaction.checkoutSession.update({ where: { id: session.id }, data: { totalCents } });
        return { totalCents, shippingPriceCents: session.shippingPriceCents, grandTotalCents: totalCents + session.shippingPriceCents, enabled: false };
      }
      return { totalCents: session.totalCents, shippingPriceCents: session.shippingPriceCents, grandTotalCents: session.totalCents + session.shippingPriceCents, enabled };
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
      const session = await transaction.checkoutSession.findFirst({ where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now }, shippingCapturedAt: { not: null } }, select: { id: true, totalCents: true, checkout: { select: { storeId: true } } } });
      if (!session) return null;
      const method = await transaction.shippingMethod.findFirst({ where: { publicId: methodPublicId, storeId: session.checkout.storeId, active: true }, select: { publicId: true, name: true, priceCents: true, minDays: true, maxDays: true } });
      if (!method) return null;
      await transaction.checkoutSession.update({ where: { id: session.id }, data: { shippingMethodPublicId: method.publicId, shippingMethodName: method.name, shippingPriceCents: method.priceCents, shippingMinDays: method.minDays, shippingMaxDays: method.maxDays } });
      return { shippingMethod: method, subtotalCents: session.totalCents, shippingPriceCents: method.priceCents, grandTotalCents: session.totalCents + method.priceCents };
    });
  }

  async createShopifyCartSession(input: ShopifyCartSessionInput): Promise<object | null> {
    return this.database.$transaction(async transaction => {
      const connection = await transaction.shopifyConnection.findFirst({ where: { shopDomain: input.shopDomain, revokedAt: null, store: { active: true } }, select: { storeId: true, store: { select: { slug: true } } } });
      if (!connection) return null;
      const checkout = await transaction.checkout.findFirst({ where: { storeId: connection.storeId, slug: input.checkoutSlug, status: 'PUBLISHED' }, select: { id: true } });
      if (!checkout) return null;
      const requestedIds = input.lines.map(line => `gid://shopify/ProductVariant/${line.variantId}`);
      const variants = await transaction.productVariant.findMany({ where: { sourceExternalId: { in: requestedIds }, availableForSale: true, product: { storeId: connection.storeId, source: 'SHOPIFY', active: true } }, select: { id: true, sourceExternalId: true, title: true, priceCents: true, inventoryQuantity: true, imageUrl: true, product: { select: { id: true, checkoutTitle: true, imageUrl: true, maxPerOrder: true, trackInventory: true } } } });
      const byExternalId = new Map(variants.map(variant => [variant.sourceExternalId, variant]));
      const items = input.lines.map(line => ({ line, variant: byExternalId.get(`gid://shopify/ProductVariant/${line.variantId}`) })).filter((item): item is { line: { variantId: string; quantity: number }; variant: NonNullable<typeof item.variant> } => Boolean(item.variant));
      if (items.length !== input.lines.length || items.some(({ line, variant }) => line.quantity > variant.product.maxPerOrder || variant.product.trackInventory && (variant.inventoryQuantity ?? 0) < line.quantity)) return null;
      const totalCents = items.reduce((total, { line, variant }) => total + variant.priceCents * line.quantity, 0);
      const first = items[0]; if (!first) return null;
      const session = await transaction.checkoutSession.create({ data: { checkoutId: checkout.id, variantId: first.variant.id, quantity: items.reduce((total, item) => total + item.line.quantity, 0), unitPriceCents: first.variant.priceCents, totalCents, tokenHash: input.tokenHash, source: 'SHOPIFY', expiresAt: input.expiresAt, ...(input.sourceCartId ? { sourceCartId: input.sourceCartId } : {}), items: { create: items.map(({ line, variant }) => ({ productId: variant.product.id, variantId: variant.id, quantity: line.quantity, unitPriceCents: variant.priceCents, totalCents: variant.priceCents * line.quantity, titleSnapshot: variant.product.checkoutTitle, variantSnapshot: variant.title, imageUrlSnapshot: variant.imageUrl ?? variant.product.imageUrl })) } }, select: { publicId: true, totalCents: true, currency: true, expiresAt: true, checkout: { select: { slug: true } }, items: { select: { quantity: true, unitPriceCents: true, totalCents: true, titleSnapshot: true, variantSnapshot: true, imageUrlSnapshot: true } } } });
      return { ...session, storeSlug: connection.store.slug };
    });
  }
}
