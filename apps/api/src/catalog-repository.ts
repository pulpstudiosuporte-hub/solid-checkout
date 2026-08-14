import type { Prisma, PrismaClient } from '@solid/database';

export type StoreContext = Readonly<{ storeId: string; userId: string; sessionId: string; role: 'OWNER' | 'ADMIN' | 'ANALYST' }>;
export type ProductInput = Readonly<{ title: string; description?: string; imageUrl?: string; priceCents: number; compareAtCents?: number; stockQuantity?: number; trackInventory: boolean; maxPerOrder: number; active: boolean }>;
export type CheckoutInput = Readonly<{ name: string; slug: string; productPublicId: string; draftConfig: Record<string, unknown> }>;

export interface CatalogRepository {
  resolveStoreContext(userId: string, sessionId: string): Promise<StoreContext | null>;
  listProducts(context: StoreContext): Promise<readonly object[]>;
  createProduct(context: StoreContext, input: ProductInput, requestId: string): Promise<object>;
  listCheckouts(context: StoreContext): Promise<readonly object[]>;
  createCheckout(context: StoreContext, input: CheckoutInput, requestId: string): Promise<object | null>;
}

const productSelect = { publicId: true, checkoutTitle: true, checkoutDescription: true, imageUrl: true, priceCents: true, compareAtCents: true, stockQuantity: true, trackInventory: true, maxPerOrder: true, active: true, source: true, createdAt: true, updatedAt: true } as const;
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
  listProducts(context: StoreContext): Promise<readonly object[]> {
    return this.database.product.findMany({ where: { storeId: context.storeId }, orderBy: { createdAt: 'desc' }, take: 100, select: productSelect });
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
}
