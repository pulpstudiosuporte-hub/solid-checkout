import type { PrismaClient } from '@solid/database';

export type GatewayContext = Readonly<{ storeId: string; role: 'OWNER' | 'ADMIN' | 'ANALYST' }>;
type GatewayStatus = Readonly<{ active: boolean; verifiedAt: Date | null; updatedAt: Date }>;
type GatewayCredentials = Readonly<{ apiKeyEncrypted: string; publicKeyEncrypted: string }>;
type PaymentAttemptSummary = Readonly<{ id: string; publicId: string; status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'; amountCents: number; pixCodeEncrypted: string | null; expiresAt: Date | null }>;
type CompletedAttempt = Readonly<{ publicId: string; status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'; amountCents: number; expiresAt: Date | null }>;
type WebhookContext = Readonly<{ id: string; publicId: string; checkoutSessionId: string; amountCents: number; status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'; session: { checkout: { storeId: string } } }>;
export type PendingPaymentVerification = Readonly<{ id: string; checkoutSessionId: string; providerTransactionId: string; amountCents: number; session: { checkout: { storeId: string } } }>;

export class PrismaGatewayRepository {
  constructor(private readonly database: PrismaClient) {}

  async context(userId: string, sessionId: string): Promise<GatewayContext | null> {
    const session = await this.database.session.findFirst({ where: { id: sessionId, userId, revokedAt: null }, select: { activeStoreId: true } });
    if (!session?.activeStoreId) return null;
    const member = await this.database.storeMember.findUnique({ where: { storeId_userId: { storeId: session.activeStoreId, userId } }, select: { role: true } });
    return member ? { storeId: session.activeStoreId, role: member.role } : null;
  }

  status(storeId: string): Promise<GatewayStatus | null> {
    return this.database.gatewayConnection.findUnique({ where: { storeId_provider: { storeId, provider: 'WESTPAY' } }, select: { active: true, verifiedAt: true, updatedAt: true } });
  }

  save(storeId: string, apiKeyEncrypted: string, publicKeyEncrypted: string): Promise<GatewayStatus> {
    return this.database.gatewayConnection.upsert({ where: { storeId_provider: { storeId, provider: 'WESTPAY' } }, create: { storeId, provider: 'WESTPAY', apiKeyEncrypted, publicKeyEncrypted, active: true, verifiedAt: new Date() }, update: { apiKeyEncrypted, publicKeyEncrypted, active: true, verifiedAt: new Date() }, select: { active: true, verifiedAt: true, updatedAt: true } });
  }

  credentials(storeId: string): Promise<GatewayCredentials | null> {
    return this.database.gatewayConnection.findFirst({ where: { storeId, provider: 'WESTPAY', active: true }, select: { apiKeyEncrypted: true, publicKeyEncrypted: true } });
  }

  async paymentContext(publicId: string, tokenHash: string, now: Date) {
    return this.database.checkoutSession.findFirst({ where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now }, customerDataEncrypted: { not: null }, shippingAddressEncrypted: { not: null }, shippingMethodPublicId: { not: null } }, select: { id: true, publicId: true, totalCents: true, shippingPriceCents: true, customerDataEncrypted: true, shippingAddressEncrypted: true, expiresAt: true, checkout: { select: { storeId: true, store: { select: { name: true } } } }, items: { select: { productId: true, titleSnapshot: true, unitPriceCents: true, quantity: true } } } });
  }

  latestAttempt(checkoutSessionId: string): Promise<PaymentAttemptSummary | null> {
    return this.database.paymentAttempt.findFirst({ where: { checkoutSessionId, provider: 'WESTPAY' }, orderBy: { createdAt: 'desc' } });
  }

  async publicPaymentStatus(publicId: string, tokenHash: string) {
    const session = await this.database.checkoutSession.findFirst({
      where: { publicId, tokenHash },
      select: {
        status: true,
        paymentAttempts: { where: { provider: 'WESTPAY', providerTransactionId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { publicId: true, status: true, amountCents: true, expiresAt: true, paidAt: true } }
      }
    });
    if (!session?.paymentAttempts[0]) return null;
    return { sessionStatus: session.status, ...session.paymentAttempts[0] };
  }

  async publicPaymentVerification(publicId: string, tokenHash: string) {
    const session = await this.database.checkoutSession.findFirst({ where: { publicId, tokenHash }, select: { checkout: { select: { storeId: true } }, paymentAttempts: { where: { provider: 'WESTPAY', providerTransactionId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, checkoutSessionId: true, providerTransactionId: true, amountCents: true, status: true } } } });
    const attempt = session?.paymentAttempts[0];
    return session && attempt?.providerTransactionId ? { storeId: session.checkout.storeId, ...attempt, providerTransactionId: attempt.providerTransactionId } : null;
  }

  async pendingPaymentVerifications(since: Date): Promise<readonly PendingPaymentVerification[]> {
    const attempts = await this.database.paymentAttempt.findMany({ where: { provider: 'WESTPAY', status: 'PENDING', providerTransactionId: { not: null }, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' }, take: 50, select: { id: true, checkoutSessionId: true, providerTransactionId: true, amountCents: true, session: { select: { checkout: { select: { storeId: true } } } } } });
    return attempts.flatMap(attempt => attempt.providerTransactionId ? [{ ...attempt, providerTransactionId: attempt.providerTransactionId }] : []);
  }

  createAttempt(checkoutSessionId: string, amountCents: number, idempotencyKey: string): Promise<PaymentAttemptSummary> {
    return this.database.paymentAttempt.create({ data: { checkoutSessionId, provider: 'WESTPAY', amountCents, idempotencyKey } });
  }

  completeAttempt(id: string, providerTransactionId: string, pixCodeEncrypted: string, expiresAt: Date | null): Promise<CompletedAttempt> {
    return this.database.paymentAttempt.update({ where: { id }, data: { providerTransactionId, pixCodeEncrypted, expiresAt }, select: { publicId: true, status: true, amountCents: true, expiresAt: true } });
  }

  webhookContext(providerTransactionId: string): Promise<WebhookContext | null> {
    return this.database.paymentAttempt.findUnique({ where: { providerTransactionId }, select: { id: true, publicId: true, checkoutSessionId: true, amountCents: true, status: true, session: { select: { checkout: { select: { storeId: true } } } } } });
  }

  async confirmPayment(attemptId: string, checkoutSessionId: string, status: 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED', paidAt?: Date) {
    await this.database.$transaction(async transaction => {
      const current = await transaction.paymentAttempt.findUnique({ where: { id: attemptId }, select: { status: true } });
      if (!current || current.status === 'REFUNDED' || current.status === status) return;
      const canTransition = status === 'PAID' || current.status === 'PENDING' || current.status === 'PAID' && status === 'REFUNDED';
      if (!canTransition) return;
      await transaction.paymentAttempt.update({ where: { id: attemptId }, data: { status, ...(paidAt ? { paidAt } : {}) } });
      if (status === 'PAID') await transaction.checkoutSession.updateMany({ where: { id: checkoutSessionId, status: 'OPEN' }, data: { status: 'COMPLETED', completedAt: paidAt ?? new Date() } });
    });
  }
}
