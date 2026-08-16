import type { PrismaClient } from '@solid/database';

export type OrderStoreContext = Readonly<{ storeId: string }>;
export type OrderRecord = Readonly<{
  publicId: string;
  status: 'OPEN' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';
  totalCents: number;
  shippingPriceCents: number;
  currency: string;
  customerDataEncrypted: string | null;
  shippingMethodName: string | null;
  createdAt: Date;
  completedAt: Date | null;
  items: readonly Readonly<{ titleSnapshot: string; variantSnapshot: string | null; quantity: number; imageUrlSnapshot: string | null }>[];
  paymentAttempts: readonly Readonly<{ publicId: string; provider: string; status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'; createdAt: Date; paidAt: Date | null; expiresAt: Date | null }>[];
}>;
export interface OrderRepository {
  context(userId: string, sessionId: string): Promise<OrderStoreContext | null>;
  list(storeId: string, page: number, pageSize: number): Promise<{ items: readonly OrderRecord[]; total: number }>;
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

  async list(storeId: string, page: number, pageSize: number) {
    const where = { checkout: { storeId }, paymentAttempts: { some: { providerTransactionId: { not: null } } } } as const;
    const [items, total] = await this.database.$transaction([
      this.database.checkoutSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          publicId: true,
          status: true,
          totalCents: true,
          shippingPriceCents: true,
          currency: true,
          customerDataEncrypted: true,
          shippingMethodName: true,
          createdAt: true,
          completedAt: true,
          items: { select: { titleSnapshot: true, variantSnapshot: true, quantity: true, imageUrlSnapshot: true } },
          paymentAttempts: {
            where: { providerTransactionId: { not: null } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { publicId: true, provider: true, status: true, createdAt: true, paidAt: true, expiresAt: true }
          }
        }
      }),
      this.database.checkoutSession.count({ where })
    ]);
    return { items, total };
  }
}
