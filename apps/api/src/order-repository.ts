import type { Prisma, PrismaClient, StoreRole } from '@solid/database';

export type OrderListFilters = Readonly<{ search?: string; emailHash?: string; status?: string; from?: Date; to?: Date; sort?: 'newest' | 'oldest' | 'highest' | 'lowest' }>;
export type OrderStoreContext = Readonly<{ storeId: string; role?: StoreRole }>;

const orderSelect = {
  publicId: true,
  status: true,
  totalCents: true,
  discountCents: true,
  couponCode: true,
  shippingPriceCents: true,
  currency: true,
  source: true,
  sourceCartId: true,
  customerDataEncrypted: true,
  customerEmailHash: true,
  shippingAddressEncrypted: true,
  shippingMethodName: true,
  shippingMinDays: true,
  shippingMaxDays: true,
  trackingParameters: true,
  shopifyOrderId: true,
  shopifyOrderName: true,
  shopifySyncStatus: true,
  shopifySyncError: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  checkout: {
    select: {
      publicId: true,
      name: true,
      slug: true,
      mode: true,
      store: { select: { name: true, slug: true } }
    }
  },
  items: {
    select: {
      titleSnapshot: true,
      variantSnapshot: true,
      quantity: true,
      unitPriceCents: true,
      totalCents: true,
      imageUrlSnapshot: true,
      isOrderBump: true
    }
  },
  paymentAttempts: {
    where: { providerTransactionId: { not: null } },
    orderBy: { createdAt: 'desc' as const },
    select: {
      publicId: true,
      provider: true,
      providerTransactionId: true,
      amountCents: true,
      status: true,
      pixCodeEncrypted: true,
      createdAt: true,
      updatedAt: true,
      paidAt: true,
      expiresAt: true
    }
  },
  deliveryJobs: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      publicId: true,
      provider: true,
      event: true,
      status: true,
      attempts: true,
      deliveredAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true
    }
  }
} satisfies Prisma.CheckoutSessionSelect;

export type OrderRecord = Readonly<{
  publicId: string;
  status: string;
  totalCents: number;
  discountCents?: number;
  couponCode?: string | null;
  shippingPriceCents: number;
  currency: string;
  source?: string;
  sourceCartId?: string | null;
  customerDataEncrypted: string | null;
  customerEmailHash?: string | null;
  shippingAddressEncrypted: string | null;
  shippingMethodName: string | null;
  shippingMinDays?: number | null;
  shippingMaxDays?: number | null;
  trackingParameters?: unknown;
  shopifyOrderId?: string | null;
  shopifyOrderName?: string | null;
  shopifySyncStatus?: string | null;
  shopifySyncError?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  completedAt: Date | null;
  checkout?: Readonly<{ publicId: string; name: string; slug: string; mode: string; store: Readonly<{ name: string; slug: string }> }>;
  items: readonly Readonly<{ titleSnapshot: string; variantSnapshot: string | null; quantity: number; unitPriceCents?: number; totalCents?: number; imageUrlSnapshot: string | null; isOrderBump?: boolean }>[];
  paymentAttempts: readonly Readonly<{ publicId: string; provider: string; providerTransactionId?: string | null; amountCents?: number; status: string; pixCodeEncrypted?: string | null; createdAt: Date; updatedAt?: Date; paidAt: Date | null; expiresAt: Date | null }>[];
  deliveryJobs?: readonly Readonly<{ publicId: string; provider: string; event: string; status: string; attempts: number; deliveredAt: Date | null; lastError: string | null; createdAt: Date; updatedAt: Date }>[];
}>;
export type CustomerHistoryRecord = Readonly<{
  publicId: string;
  status: string;
  totalCents: number;
  discountCents: number;
  shippingPriceCents: number;
  createdAt: Date;
  completedAt: Date | null;
}>;

export interface OrderRepository {
  context(userId: string, sessionId: string): Promise<OrderStoreContext | null>;
  list(storeId: string, page: number, pageSize: number, filters?: OrderListFilters): Promise<{ items: readonly OrderRecord[]; total: number }>;
  find(storeId: string, publicId: string): Promise<OrderRecord | null>;
  customerHistory?(storeId: string, emailHash: string, currentPublicId: string): Promise<readonly CustomerHistoryRecord[]>;
  updateTrackingParameters?(storeId: string, publicId: string, trackingParameters: Prisma.InputJsonValue): Promise<boolean>;
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
      select: { role: true }
    });
    return membership ? { storeId: session.activeStoreId, role: membership.role } : null;
  }

  async list(storeId: string, page: number, pageSize: number, filters: OrderListFilters = {}) {
    const search = filters.search?.trim();
    const where: Prisma.CheckoutSessionWhereInput = {
      checkout: { storeId },
      paymentAttempts: filters.status === 'PAID'
        ? { some: { providerTransactionId: { not: null }, status: 'PAID' } }
        : { some: { providerTransactionId: { not: null } } },
      ...(filters.status && filters.status !== 'PAID' ? { AND: [{ paymentAttempts: { none: { status: 'PAID' } } }, { paymentAttempts: { some: { providerTransactionId: { not: null }, status: filters.status as never } } }] } : {}),
      ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
      ...(search ? { OR: [{ publicId: { contains: search, mode: 'insensitive' } }, ...(filters.emailHash ? [{ customerEmailHash: filters.emailHash }] : [])] } : {})
    };
    const orderBy: Prisma.CheckoutSessionOrderByWithRelationInput = filters.sort === 'oldest' ? { createdAt: 'asc' } : filters.sort === 'highest' ? { totalCents: 'desc' } : filters.sort === 'lowest' ? { totalCents: 'asc' } : { createdAt: 'desc' };
    const [items, total] = await this.database.$transaction([
      this.database.checkoutSession.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, select: orderSelect }),
      this.database.checkoutSession.count({ where })
    ]);
    return { items, total };
  }

  async find(storeId: string, publicId: string): Promise<OrderRecord | null> {
    return this.database.checkoutSession.findFirst({
      where: { publicId, checkout: { storeId }, paymentAttempts: { some: { providerTransactionId: { not: null } } } },
      select: orderSelect
    });
  }

  async customerHistory(storeId: string, emailHash: string, currentPublicId: string): Promise<readonly CustomerHistoryRecord[]> {
    return this.database.checkoutSession.findMany({
      where: { customerEmailHash: emailHash, checkout: { storeId }, publicId: { not: currentPublicId } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { publicId: true, status: true, totalCents: true, discountCents: true, shippingPriceCents: true, createdAt: true, completedAt: true }
    });
  }

  async updateTrackingParameters(storeId: string, publicId: string, trackingParameters: Prisma.InputJsonValue): Promise<boolean> {
    const result = await this.database.checkoutSession.updateMany({
      where: { publicId, checkout: { storeId } },
      data: { trackingParameters }
    });
    return result.count === 1;
  }
}
