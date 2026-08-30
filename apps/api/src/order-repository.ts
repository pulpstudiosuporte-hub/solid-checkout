import type { Prisma, PrismaClient } from '@solid/database';

export type OrderListFilters = Readonly<{ search?: string; emailHash?: string; status?: string; from?: Date; to?: Date; sort?: 'newest' | 'oldest' | 'highest' | 'lowest' }>;

export type OrderStoreContext = Readonly<{ storeId: string }>;
export type OrderRecord = Readonly<{
  publicId: string;
  status: 'OPEN' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';
  totalCents: number;
  discountCents?: number;
  couponCode?: string | null;
  shippingPriceCents: number;
  currency: string;
  customerDataEncrypted: string | null;
  shippingAddressEncrypted: string | null;
  shippingMethodName: string | null;
  createdAt: Date;
  completedAt: Date | null;
  trackingParameters?: unknown;
  items: readonly Readonly<{ titleSnapshot: string; variantSnapshot: string | null; quantity: number; imageUrlSnapshot: string | null }>[];
  paymentAttempts: readonly Readonly<{ publicId: string; provider: string; status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'; createdAt: Date; paidAt: Date | null; expiresAt: Date | null }>[];
}>;
export interface OrderRepository {
  context(userId: string, sessionId: string): Promise<OrderStoreContext | null>;
  list(storeId: string, page: number, pageSize: number, filters?: OrderListFilters): Promise<{ items: readonly OrderRecord[]; total: number }>;
  find(storeId: string, publicId: string): Promise<OrderRecord | null>;
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly database: PrismaClient) {}

  async context(userId: string, sessionId: string): Promise<OrderStoreContext | null> {
    const session = await this.database.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
      select: { activeStoreId: true }
    });
    if (!session?.activeStoreId) return null;
    const membership = await this.database.storeMember.findUnique({
      where: { storeId_userId: { storeId: session.activeStoreId, userId } },
      select: { id: true }
    });
    return membership ? { storeId: session.activeStoreId } : null;
  }

  private readonly orderSelect = {
    publicId: true, status: true, totalCents: true, discountCents: true, couponCode: true, shippingPriceCents: true, currency: true,
    customerDataEncrypted: true, shippingAddressEncrypted: true, shippingMethodName: true, trackingParameters: true, createdAt: true, completedAt: true,
    items: { select: { titleSnapshot: true, variantSnapshot: true, quantity: true, imageUrlSnapshot: true } },
    paymentAttempts: { where: { providerTransactionId: { not: null } }, orderBy: { createdAt: 'desc' as const }, select: { publicId: true, provider: true, status: true, createdAt: true, paidAt: true, expiresAt: true } }
  };

  async list(storeId: string, page: number, pageSize: number, filters: OrderListFilters = {}) {
    const search = filters.search?.trim();
    const where: Prisma.CheckoutSessionWhereInput = {
      checkout: { storeId }, paymentAttempts: filters.status === 'PAID' ? { some: { providerTransactionId: { not: null }, status: 'PAID' } } : { some: { providerTransactionId: { not: null } } },
      ...(filters.status && filters.status !== 'PAID' ? { AND: [{ paymentAttempts: { none: { status: 'PAID' } } }, { paymentAttempts: { some: { providerTransactionId: { not: null }, status: filters.status as never } } }] } : {}),
      ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
      ...(search ? { OR: [{ publicId: { contains: search, mode: 'insensitive' } }, ...(filters.emailHash ? [{ customerEmailHash: filters.emailHash }] : [])] } : {}),
    };
    const orderBy: Prisma.CheckoutSessionOrderByWithRelationInput = filters.sort === 'oldest' ? { createdAt: 'asc' } : filters.sort === 'highest' ? { totalCents: 'desc' } : filters.sort === 'lowest' ? { totalCents: 'asc' } : { createdAt: 'desc' };
    const [items, total] = await this.database.$transaction([
      this.database.checkoutSession.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.orderSelect
      }),
      this.database.checkoutSession.count({ where })
    ]);
    return { items, total };
  }

  async find(storeId: string, publicId: string): Promise<OrderRecord | null> {
    return this.database.checkoutSession.findFirst({ where: { publicId, checkout: { storeId }, paymentAttempts: { some: { providerTransactionId: { not: null } } } }, select: this.orderSelect });
  }
}
