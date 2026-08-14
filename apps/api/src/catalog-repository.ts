import type { Prisma, PrismaClient } from '@solid/database';

export type StoreContext = Readonly<{ storeId: string; userId: string; sessionId: string; role: 'OWNER' | 'ADMIN' | 'ANALYST' }>;
export type ProductInput = Readonly<{ title: string; description?: string; imageUrl?: string; priceCents: number; compareAtCents?: number; stockQuantity?: number; trackInventory: boolean; maxPerOrder: number; active: boolean }>;
export type CheckoutInput = Readonly<{ name: string; slug: string; productPublicId: string; draftConfig: Record<string, unknown> }>;
export type CheckoutSessionInput = Readonly<{ storeSlug: string; checkoutSlug: string; variantPublicId?: string; quantity: number; tokenHash: string; source: 'DIRECT' | 'SHOPIFY'; sourceCartId?: string; expiresAt: Date }>;
export type ProductListQuery = Readonly<{ search?: string; status?: 'active' | 'inactive'; source?: 'MANUAL' | 'SHOPIFY'; page: number; pageSize: number }>;
export type ProductListResult = Readonly<{ items: readonly object[]; total: number }>;

export interface CatalogRepository {
  resolveStoreContext(userId: string, sessionId: string): Promise<StoreContext | null>;
  listProducts(context: StoreContext, query: ProductListQuery): Promise<ProductListResult>;
  getProduct(context: StoreContext, publicId: string): Promise<object | null>;
  createProduct(context: StoreContext, input: ProductInput, requestId: string): Promise<object>;
  listCheckouts(context: StoreContext): Promise<readonly object[]>;
  createCheckout(context: StoreContext, input: CheckoutInput, requestId: string): Promise<object | null>;
  publishCheckout(context: StoreContext, publicId: string, requestId: string): Promise<object | null>;
  getPublicCheckout(storeSlug: string, checkoutSlug: string): Promise<object | null>;
  createPublicCheckoutSession(input: CheckoutSessionInput): Promise<object | null>;
  getPublicCheckoutSession(publicId: string, tokenHash: string, now: Date): Promise<object | null>;
}

const productSelect = { publicId: true, sourceTitle: true, checkoutTitle: true, checkoutDescription: true, handle: true, vendor: true, productType: true, tags: true, imageUrl: true, priceCents: true, compareAtCents: true, stockQuantity: true, trackInventory: true, maxPerOrder: true, active: true, source: true, syncedAt: true, createdAt: true, updatedAt: true, _count: { select: { variants: true, images: true, collections: true } } } as const;
const checkoutSelect = { publicId: true, name: true, slug: true, status: true, draftConfig: true, createdAt: true, updatedAt: true, product: { select: { publicId: true, checkoutTitle: true, priceCents: true, active: true } } } as const;

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

  async publishCheckout(context: StoreContext, publicId: string, requestId: string): Promise<object | null> {
    const checkout = await this.database.checkout.findFirst({ where: { publicId, storeId: context.storeId, product: { active: true } }, select: { id: true } });
    if (!checkout) return null;
    return this.database.$transaction(async transaction => {
      const published = await transaction.checkout.update({ where: { id: checkout.id }, data: { status: 'PUBLISHED' }, select: checkoutSelect });
      await transaction.auditLog.create({ data: { storeId: context.storeId, actorUserId: context.userId, actorType: 'USER', action: 'checkout.published', targetType: 'checkout', targetId: publicId, requestId } });
      return published;
    });
  }

  getPublicCheckout(storeSlug: string, checkoutSlug: string): Promise<object | null> {
    return this.database.checkout.findFirst({
      where: { slug: checkoutSlug, status: 'PUBLISHED', store: { slug: storeSlug, active: true }, product: { active: true } },
      select: { publicId: true, slug: true, name: true, draftConfig: true, store: { select: { publicId: true, name: true } }, product: { select: { publicId: true, checkoutTitle: true, checkoutDescription: true, imageUrl: true, priceCents: true, compareAtCents: true, maxPerOrder: true, stockQuantity: true, trackInventory: true, variants: { where: { availableForSale: true }, orderBy: { createdAt: 'asc' }, select: { publicId: true, title: true, priceCents: true, compareAtCents: true, inventoryQuantity: true, availableForSale: true, imageUrl: true, selectedOptions: true } } } } }
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
      const session = await transaction.checkoutSession.create({ data: { checkoutId: checkout.id, variantId: variant?.id ?? null, quantity: input.quantity, unitPriceCents, totalCents: unitPriceCents * input.quantity, tokenHash: input.tokenHash, source: input.source, expiresAt: input.expiresAt, ...(input.sourceCartId ? { sourceCartId: input.sourceCartId } : {}) }, select: { publicId: true, quantity: true, unitPriceCents: true, totalCents: true, currency: true, status: true, expiresAt: true, checkout: { select: { slug: true, name: true, draftConfig: true, store: { select: { name: true } } } }, variant: { select: { publicId: true, title: true, imageUrl: true } } } });
      return { ...session, product: checkout.product };
    });
  }

  async getPublicCheckoutSession(publicId: string, tokenHash: string, now: Date): Promise<object | null> {
    const session = await this.database.checkoutSession.findFirst({ where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now } }, select: { publicId: true, quantity: true, unitPriceCents: true, totalCents: true, currency: true, status: true, expiresAt: true, checkout: { select: { slug: true, name: true, draftConfig: true, store: { select: { name: true } }, product: { select: { publicId: true, checkoutTitle: true, checkoutDescription: true, imageUrl: true } } } }, variant: { select: { publicId: true, title: true, imageUrl: true } } } });
    return session;
  }
}
