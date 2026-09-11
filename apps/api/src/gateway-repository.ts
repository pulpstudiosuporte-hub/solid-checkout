import type { PrismaClient } from '@solid/database';
import { creditRefundFee } from './payment-accounting.js';
import { randomUUID } from 'node:crypto';
import { effectiveBilling } from './billing-entitlements.js';
import { canTransitionPayment } from './payment-rules.js';
import type { StorePushDispatcher } from './web-push-service.js';
import { enqueueStoreWebhookEvent } from './webhook-routes.js';
import { enqueuePaymentDeliveries, type DeliveryProvider } from './payment-delivery.js';

export type GatewayContext = Readonly<{ storeId: string; role: 'OWNER' | 'ADMIN' | 'ANALYST' }>;
export type PaymentProvider = 'ROAS' | 'WESTPAY';
export type IntegrationProvider = PaymentProvider | 'UTMIFY' | 'META';
type GatewayStatus = Readonly<{ active: boolean; priority: number; verifiedAt: Date | null; updatedAt: Date }>;
type GatewayCredentials = Readonly<{ apiKeyEncrypted: string; publicKeyEncrypted: string }>;
type PaymentAttemptSummary = Readonly<{ id: string; publicId: string; provider: string; status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'; amountCents: number; pixCodeEncrypted: string | null; expiresAt: Date | null }>;
type CompletedAttempt = Readonly<{ publicId: string; status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'; amountCents: number; expiresAt: Date | null }>;
type WebhookContext = Readonly<{ id: string; publicId: string; checkoutSessionId: string; amountCents: number; status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'; session: { checkout: { storeId: string } } }>;
export type PendingPaymentVerification = Readonly<{ id: string; checkoutSessionId: string; providerTransactionId: string; amountCents: number; createdAt: Date; verificationFailures: number; session: { checkout: { storeId: string } } }>;
export type PendingIntegrationDelivery = Readonly<{ id: string; publicId: string; storeId: string; checkoutSessionId: string; provider: string; event: string; attempts: number }>;
type UtmifyOrderContext = Readonly<{ id: string; publicId: string; createdAt: Date; completedAt: Date | null; currency: string; customerDataEncrypted: string | null; trackingParameters: unknown; totalCents: number; discountCents: number; shippingPriceCents: number; checkout: { storeId: string; store: { name: string }; product: { publicId: string; checkoutTitle: string } | null }; items: readonly { productId: string; titleSnapshot: string; unitPriceCents: number; quantity: number; product: { publicId: string } }[] }>;

export class PrismaGatewayRepository {
  private push: StorePushDispatcher | undefined;
  constructor(private readonly database: PrismaClient) {}
  setPushDispatcher(push: StorePushDispatcher | undefined): void { this.push = push; }

  async context(userId: string, sessionId: string): Promise<GatewayContext | null> {
    const session = await this.database.session.findFirst({ where: { id: sessionId, userId, revokedAt: null }, select: { activeStoreId: true } });
    if (!session?.activeStoreId) return null;
    const member = await this.database.storeMember.findUnique({ where: { storeId_userId: { storeId: session.activeStoreId, userId } }, select: { role: true } });
    return member ? { storeId: session.activeStoreId, role: member.role } : null;
  }

  status(storeId: string, provider: IntegrationProvider = 'WESTPAY'): Promise<GatewayStatus | null> {
    return this.database.gatewayConnection.findUnique({ where: { storeId_provider: { storeId, provider } }, select: { active: true, priority: true, verifiedAt: true, updatedAt: true } });
  }

  async save(storeId: string, provider: IntegrationProvider, apiKeyEncrypted: string, publicKeyEncrypted: string): Promise<GatewayStatus> {
    const paymentProvider = provider === 'ROAS' || provider === 'WESTPAY';
    const activePayments = paymentProvider ? await this.database.gatewayConnection.count({ where: { storeId, active: true, verifiedAt: { not: null }, provider: { in: ['ROAS', 'WESTPAY'] } } }) : 1;
    return this.database.gatewayConnection.upsert({ where: { storeId_provider: { storeId, provider } }, create: { storeId, provider, apiKeyEncrypted, publicKeyEncrypted, active: true, priority: activePayments ? 100 : 0, verifiedAt: new Date() }, update: { apiKeyEncrypted, publicKeyEncrypted, active: true, verifiedAt: new Date(), ...(paymentProvider && !activePayments ? { priority: 0 } : {}) }, select: { active: true, priority: true, verifiedAt: true, updatedAt: true } });
  }

  credentials(storeId: string, provider: IntegrationProvider = 'WESTPAY'): Promise<GatewayCredentials | null> {
    return this.database.gatewayConnection.findFirst({ where: { storeId, provider, active: true }, select: { apiKeyEncrypted: true, publicKeyEncrypted: true } });
  }

  async disconnect(storeId: string, provider: IntegrationProvider): Promise<{ count: number }> {
    return this.database.$transaction(async transaction => {
      const result = await transaction.gatewayConnection.updateMany({ where: { storeId, provider }, data: { active: false, priority: 100 } });
      if (provider === 'ROAS' || provider === 'WESTPAY') {
        const fallback = await transaction.gatewayConnection.findFirst({ where: { storeId, active: true, verifiedAt: { not: null }, provider: { in: ['ROAS', 'WESTPAY'] } }, orderBy: [{ priority: 'asc' }, { updatedAt: 'asc' }], select: { id: true } });
        if (fallback) await transaction.gatewayConnection.update({ where: { id: fallback.id }, data: { priority: 0 } });
      }
      return result;
    });
  }

  async setPrimary(storeId: string, provider: PaymentProvider): Promise<GatewayStatus | null> {
    return this.database.$transaction(async transaction => {
      const connection = await transaction.gatewayConnection.findUnique({ where: { storeId_provider: { storeId, provider } }, select: { id: true, active: true, verifiedAt: true } });
      if (!connection?.active || !connection.verifiedAt) return null;
      await transaction.gatewayConnection.updateMany({ where: { storeId, active: true, provider: { in: ['ROAS', 'WESTPAY'] } }, data: { priority: 100 } });
      return transaction.gatewayConnection.update({ where: { id: connection.id }, data: { priority: 0 }, select: { active: true, priority: true, verifiedAt: true, updatedAt: true } });
    });
  }

  async recordGatewayConfiguration(storeId: string, userId: string, action: string, provider: PaymentProvider, requestId: string): Promise<void> {
    await this.database.auditLog.create({ data: { storeId, actorType: 'USER', actorUserId: userId, action, targetType: 'gateway_connection', targetId: provider, requestId, metadata: { provider } } });
  }

  async recordIntegrationEvent(storeId: string, provider: IntegrationProvider, event: string, success: boolean, metadata: Record<string, unknown> = {}): Promise<void> {
    await this.database.auditLog.create({ data: { storeId, actorType: 'SYSTEM', action: success ? 'integration.event_sent' : 'integration.event_failed', targetType: 'integration', targetId: provider, metadata: { provider, event, ...metadata } } });
  }

  async markIntegrationDeliverySuccess(storeId: string, checkoutSessionId: string, provider: DeliveryProvider, event: string): Promise<void> {
    const now = new Date();
    await this.database.integrationDeliveryJob.upsert({
      where: { checkoutSessionId_provider_event: { checkoutSessionId, provider, event } },
      create: { storeId, checkoutSessionId, provider, event, status: 'DELIVERED', deliveredAt: now },
      update: { status: 'DELIVERED', deliveredAt: now, claimedAt: null, nextAttemptAt: null, lastError: null }
    });
  }

  async markIntegrationDeliveryFailure(storeId: string, checkoutSessionId: string, provider: DeliveryProvider, event: string, error: string): Promise<void> {
    await this.database.$transaction(async transaction => {
      const current = await transaction.integrationDeliveryJob.findUnique({ where: { checkoutSessionId_provider_event: { checkoutSessionId, provider, event } }, select: { attempts: true } });
      const attempts = (current?.attempts ?? 0) + 1;
      const dead = attempts >= 8;
      const nextAttemptAt = dead ? null : new Date(Date.now() + Math.min(360, 2 ** attempts) * 60_000);
      await transaction.integrationDeliveryJob.upsert({
        where: { checkoutSessionId_provider_event: { checkoutSessionId, provider, event } },
        create: { storeId, checkoutSessionId, provider, event, status: dead ? 'DEAD' : 'PENDING', attempts, nextAttemptAt, lastError: error.slice(0, 500) },
        update: { status: dead ? 'DEAD' : 'PENDING', attempts, nextAttemptAt, claimedAt: null, lastError: error.slice(0, 500) }
      });
    });
  }

  async claimPendingIntegrationDeliveries(now: Date): Promise<readonly PendingIntegrationDelivery[]> {
    const stale = new Date(now.getTime() - 5 * 60_000);
    const candidates = await this.database.integrationDeliveryJob.findMany({
      where: { OR: [{ status: 'PENDING', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, { status: 'PROCESSING', claimedAt: { lte: stale } }] },
      orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }], take: 20,
      select: { id: true, publicId: true, storeId: true, checkoutSessionId: true, provider: true, event: true, attempts: true }
    });
    const claimed: PendingIntegrationDelivery[] = [];
    for (const candidate of candidates) {
      const updated = await this.database.integrationDeliveryJob.updateMany({ where: { id: candidate.id, OR: [{ status: 'PENDING' }, { status: 'PROCESSING', claimedAt: { lte: stale } }] }, data: { status: 'PROCESSING', claimedAt: now } });
      if (updated.count) claimed.push(candidate);
    }
    return claimed;
  }

  async discardIntegrationDelivery(publicId: string, error: string): Promise<void> {
    await this.database.integrationDeliveryJob.updateMany({
      where: { publicId },
      data: { status: 'DEAD', claimedAt: null, nextAttemptAt: null, lastError: error.slice(0, 500) }
    });
  }

  async deliveryPaymentStatus(checkoutSessionId: string): Promise<string | null> {
    const settled = await this.database.paymentAttempt.findFirst({ where: { checkoutSessionId, status: { in: ['PAID', 'REFUNDED'] } }, orderBy: { updatedAt: 'desc' }, select: { status: true } });
    if (settled) return settled.status;
    const latest = await this.database.paymentAttempt.findFirst({ where: { checkoutSessionId, providerTransactionId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { status: true } });
    return latest?.status ?? null;
  }

  async diagnostics(storeId: string) {
    const [connections, shopify, events, latestPayment] = await Promise.all([
      this.database.gatewayConnection.findMany({ where: { storeId, provider: { in: ['ROAS', 'WESTPAY', 'UTMIFY', 'META'] } }, select: { provider: true, active: true, verifiedAt: true, updatedAt: true } }),
      this.database.shopifyConnection.findUnique({ where: { storeId }, select: { shopDomain: true, revokedAt: true, reconnectRequiredAt: true, reconnectReason: true, lastSyncedAt: true, updatedAt: true } }),
      this.database.auditLog.findMany({ where: { storeId, OR: [{ action: { startsWith: 'integration.' } }, { action: 'payment.webhook_verified' }] }, orderBy: { createdAt: 'desc' }, take: 60, select: { action: true, targetId: true, metadata: true, createdAt: true } }),
      this.database.paymentAttempt.findFirst({ where: { session: { checkout: { storeId } } }, orderBy: { updatedAt: 'desc' }, select: { provider: true, status: true, updatedAt: true } }),
    ]);
    return { connections, shopify, events, latestPayment };
  }

  utmifyOrderContext(checkoutSessionId: string): Promise<UtmifyOrderContext | null> {
    return this.database.checkoutSession.findUnique({ where: { id: checkoutSessionId }, select: {
      id: true, publicId: true, createdAt: true, completedAt: true, currency: true, customerDataEncrypted: true, trackingParameters: true,
      totalCents: true, discountCents: true, shippingPriceCents: true,
      checkout: { select: { storeId: true, store: { select: { name: true } }, product: { select: { publicId: true, checkoutTitle: true } } } },
      items: { select: { productId: true, titleSnapshot: true, unitPriceCents: true, quantity: true, product: { select: { publicId: true } } } },
    } });
  }

  async publicTrackingStore(publicId: string, tokenHash: string): Promise<string | null> {
    const session = await this.database.checkoutSession.findFirst({ where: { publicId, tokenHash }, select: { checkout: { select: { storeId: true } } } });
    return session?.checkout.storeId ?? null;
  }

  async publicTrackingSession(publicId: string, tokenHash: string): Promise<{ id: string; storeId: string } | null> {
    const session = await this.database.checkoutSession.findFirst({ where: { publicId, tokenHash }, select: { id: true, checkout: { select: { storeId: true } } } });
    return session ? { id: session.id, storeId: session.checkout.storeId } : null;
  }

  async primaryProvider(storeId: string): Promise<PaymentProvider | null> {
    return (await this.paymentProviders(storeId))[0] ?? null;
  }

  async paymentProviders(storeId: string): Promise<PaymentProvider[]> {
    const connections = await this.database.gatewayConnection.findMany({ where: { storeId, active: true, verifiedAt: { not: null }, provider: { in: ['ROAS', 'WESTPAY'] } }, orderBy: [{ priority: 'asc' }, { updatedAt: 'asc' }], select: { provider: true } });
    return connections.map(connection => connection.provider as PaymentProvider);
  }

  async paymentContext(publicId: string, tokenHash: string, now: Date) {
    return this.database.checkoutSession.findFirst({ where: { publicId, tokenHash, status: 'OPEN', expiresAt: { gt: now } }, select: { id: true, publicId: true, quantity: true, unitPriceCents: true, totalCents: true, discountCents: true, shippingPriceCents: true, customerDataEncrypted: true, shippingAddressEncrypted: true, shippingMethodPublicId: true, expiresAt: true, checkout: { select: { storeId: true, store: { select: { name: true } }, product: { select: { id: true, checkoutTitle: true, fulfillmentType: true } } } }, items: { select: { productId: true, titleSnapshot: true, unitPriceCents: true, quantity: true, product: { select: { fulfillmentType: true } } } } } });
  }

  latestAttempt(checkoutSessionId: string, provider?: PaymentProvider): Promise<PaymentAttemptSummary | null> {
    return this.database.paymentAttempt.findFirst({ where: { checkoutSessionId, ...(provider ? { provider } : {}) }, orderBy: { createdAt: 'desc' } });
  }

  async failAttempt(attemptId: string): Promise<void> {
    await this.database.paymentAttempt.updateMany({ where: { id: attemptId, status: 'PENDING', providerTransactionId: null }, data: { status: 'FAILED' } });
  }

  async publicPaymentStatus(publicId: string, tokenHash: string) {
    const session = await this.database.checkoutSession.findFirst({
      where: { publicId, tokenHash },
      select: {
        status: true,
        paymentAttempts: { where: { provider: { in: ['ROAS', 'WESTPAY'] }, providerTransactionId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { publicId: true, provider: true, status: true, amountCents: true, expiresAt: true, paidAt: true } }
      }
    });
    if (!session?.paymentAttempts[0]) return null;
    return { sessionStatus: session.status, ...session.paymentAttempts[0] };
  }

  async publicPaymentVerification(publicId: string, tokenHash: string) {
    const session = await this.database.checkoutSession.findFirst({ where: { publicId, tokenHash }, select: { checkout: { select: { storeId: true } }, paymentAttempts: { where: { provider: { in: ['ROAS', 'WESTPAY'] }, providerTransactionId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, checkoutSessionId: true, provider: true, providerTransactionId: true, amountCents: true, status: true } } } });
    const attempt = session?.paymentAttempts[0];
    return session && attempt?.providerTransactionId ? { storeId: session.checkout.storeId, ...attempt, providerTransactionId: attempt.providerTransactionId } : null;
  }

  async pendingPaymentVerifications(_since: Date, provider: PaymentProvider = 'WESTPAY'): Promise<readonly PendingPaymentVerification[]> {
    return this.database.$transaction(async transaction => {
      // Claim due work across processes; advance its lease before the network call.
      const rows = await transaction.$queryRaw<{ id: string }[]>`SELECT id FROM payment_attempts WHERE provider = ${provider} AND status = 'PENDING' AND provider_transaction_id IS NOT NULL AND next_verification_at <= NOW() AND created_at <= NOW() - INTERVAL '30 seconds' ORDER BY next_verification_at, id LIMIT 5 FOR UPDATE SKIP LOCKED`;
      if (!rows.length) return [];
      const ids = rows.map(row => row.id);
      await transaction.paymentAttempt.updateMany({ where: { id: { in: ids } }, data: { nextVerificationAt: new Date(Date.now() + 120_000) } });
      const attempts = await transaction.paymentAttempt.findMany({ where: { id: { in: ids } }, select: { id: true, checkoutSessionId: true, providerTransactionId: true, amountCents: true, createdAt: true, verificationFailures: true, session: { select: { checkout: { select: { storeId: true } } } } } });
      return attempts.flatMap(attempt => attempt.providerTransactionId ? [{ ...attempt, providerTransactionId: attempt.providerTransactionId }] : []);
    });
  }

  async rescheduleVerification(id: string, delayMs: number, failed = false): Promise<void> {
    await this.database.paymentAttempt.updateMany({ where: { id, status: 'PENDING' }, data: { nextVerificationAt: new Date(Date.now() + delayMs), verificationFailures: failed ? { increment: 1 } : 0 } });
  }

  createAttempt(checkoutSessionId: string, provider: PaymentProvider, amountCents: number, idempotencyKey: string): Promise<PaymentAttemptSummary> {
    return this.database.paymentAttempt.create({ data: { checkoutSessionId, provider, amountCents, idempotencyKey } });
  }

  async claimPaymentCreation(checkoutSessionId: string, provider: PaymentProvider, amountCents: number): Promise<{ claimed: boolean; attempt: PaymentAttemptSummary }> {
    return this.database.$transaction(async transaction => {
      // Serialize all providers for one checkout. The durable reservation survives restarts.
      await transaction.$queryRaw`SELECT id FROM checkout_sessions WHERE id = ${checkoutSessionId}::uuid FOR UPDATE`;
      const active = await transaction.paymentAttempt.findFirst({ where: { checkoutSessionId, status: { in: ['PENDING', 'PAID', 'REFUNDED'] } }, orderBy: { createdAt: 'desc' } });
      if (active) return { claimed: false, attempt: active };
      const session = await transaction.checkoutSession.findUniqueOrThrow({ where: { id: checkoutSessionId } });
      if (session.status !== 'OPEN' || session.expiresAt <= new Date() || session.totalCents - session.discountCents + session.shippingPriceCents !== amountCents) throw new Error('Checkout changed before payment reservation');
      const attempt = await transaction.paymentAttempt.create({ data: { checkoutSessionId, provider, amountCents, idempotencyKey: `solid:${randomUUID()}`, creationState: 'CREATING', nextVerificationAt: new Date(Date.now() + 30_000) } });
      return { claimed: true, attempt };
    });
  }

  async markCreationUncertain(id: string): Promise<void> {
    await this.database.paymentAttempt.updateMany({ where: { id, status: 'PENDING', pixCodeEncrypted: null }, data: { creationState: 'UNCERTAIN' } });
  }

  async saveProviderResponse(id: string, providerTransactionId: string, pixCodeEncrypted: string, expiresAt: Date | null): Promise<void> {
    // Persist the external result independently of integration enqueueing failures.
    await this.database.paymentAttempt.update({ where: { id }, data: { providerTransactionId, pixCodeEncrypted, expiresAt, creationState: 'RECEIVED' } });
  }

  completeAttempt(id: string, providerTransactionId: string, pixCodeEncrypted: string, expiresAt: Date | null): Promise<CompletedAttempt> {
    return this.database.$transaction(async transaction => {
      const { checkoutSessionId, ...payment } = await transaction.paymentAttempt.update({ where: { id }, data: { providerTransactionId, pixCodeEncrypted, expiresAt, creationState: 'READY' }, select: { checkoutSessionId: true, publicId: true, status: true, amountCents: true, expiresAt: true } });
      await enqueuePaymentDeliveries(transaction, checkoutSessionId, 'PENDING');
      return payment;
    });
  }

  async resumeSavedCreation(id: string): Promise<void> {
    const attempt = await this.database.paymentAttempt.findFirst({ where: { id, creationState: 'RECEIVED' } });
    if (attempt?.providerTransactionId && attempt.pixCodeEncrypted) await this.completeAttempt(id, attempt.providerTransactionId, attempt.pixCodeEncrypted, attempt.expiresAt);
  }

  async recordPendingPayment(id: string, provider: PaymentProvider, requestId: string): Promise<void> {
    const attempt = await this.database.paymentAttempt.findUnique({ where: { id }, select: { publicId: true, amountCents: true, session: { select: { publicId: true, checkout: { select: { storeId: true } } } } } });
    if (!attempt) return;
    const metadata = { provider, paymentStatus: 'PENDING', amountCents: attempt.amountCents };
    await this.database.$transaction(async transaction => {
      await transaction.auditLog.create({ data: { storeId: attempt.session.checkout.storeId, actorType: 'SYSTEM', action: 'payment.pix_created', targetType: 'payment_attempt', targetId: attempt.publicId, requestId, metadata } });
      await enqueueStoreWebhookEvent(transaction, attempt.session.checkout.storeId, 'order.created', { order: { id: attempt.session.publicId, paymentId: attempt.publicId, status: 'PENDING', totalCents: attempt.amountCents, currency: 'BRL' } }, attempt.publicId);
    });
    await this.push?.(attempt.session.checkout.storeId, 'payment.pix_created', metadata, attempt.publicId);
  }

  webhookContext(providerTransactionId: string): Promise<WebhookContext | null> {
    return this.database.paymentAttempt.findUnique({ where: { providerTransactionId }, select: { id: true, publicId: true, checkoutSessionId: true, amountCents: true, status: true, session: { select: { checkout: { select: { storeId: true } } } } } });
  }

  async recordWebhookEvent(context: WebhookContext, provider: PaymentProvider, providerStatus: string | null, requestId: string): Promise<void> {
    const metadata = { provider, providerStatus, paymentStatus: context.status, amountCents: context.amountCents };
    await this.database.auditLog.create({ data: { storeId: context.session.checkout.storeId, actorType: 'SYSTEM', action: 'payment.webhook_verified', targetType: 'payment_attempt', targetId: context.publicId, requestId, metadata } });
    await this.push?.(context.session.checkout.storeId, 'payment.webhook_verified', metadata, context.publicId);
  }

  async confirmPayment(attemptId: string, checkoutSessionId: string, status: 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED', paidAt?: Date) {
    const transitioned = await this.database.$transaction(async transaction => {
      const current = await transaction.paymentAttempt.findUnique({ where: { id: attemptId }, select: { publicId: true, status: true, paidAt: true, refundedAmountCents: true, amountCents: true, session: { select: { publicId: true, checkout: { select: { storeId: true, store: { select: { members: { where: { role: 'OWNER' }, orderBy: { createdAt: 'asc' }, take: 1, select: { userId: true } } } } } } } } } });
      if (!current || current.status === 'REFUNDED' || current.status === status) return false;
      if (status === 'PAID') paidAt ??= current.paidAt ?? new Date();
      const canTransition = canTransitionPayment(current.status, status);
      if (!canTransition) return false;
      const claimed = await transaction.paymentAttempt.updateMany({ where: { id: attemptId, status: current.status }, data: { status, ...(status === 'REFUNDED' ? { refundedAmountCents: current.amountCents } : {}), ...(paidAt ? { paidAt } : {}) } });
      if (!claimed.count) return false;
      await enqueuePaymentDeliveries(transaction, checkoutSessionId, status);
      if (status === 'PAID') {
        const completed = await transaction.checkoutSession.updateMany({ where: { id: checkoutSessionId, status: { in: ['OPEN', 'EXPIRED', 'CANCELLED'] } }, data: { status: 'COMPLETED', completedAt: paidAt ?? new Date() } });
        if (completed.count) { const session = await transaction.checkoutSession.findUnique({ where: { id: checkoutSessionId }, select: { couponId: true } }); if (session?.couponId) await transaction.coupon.update({ where: { id: session.couponId }, data: { redemptionCount: { increment: 1 } } }); }
      }
      const ownerId = current.session.checkout.store.members[0]?.userId;
      if (ownerId && status === 'PAID') {
        const billing = await transaction.billingSubscription.upsert({ where: { userId: ownerId }, create: { userId: ownerId }, update: {} });
        const feeBasisPoints = effectiveBilling(billing).feeBasisPoints;
        await transaction.billingLedgerEntry.upsert({
          where: { paymentAttemptId_type_sequence: { paymentAttemptId: attemptId, type: 'TRANSACTION_FEE', sequence: 0 } },
          create: { userId: ownerId, paymentAttemptId: attemptId, type: 'TRANSACTION_FEE', grossAmountCents: current.amountCents, feeBasisPoints, amountCents: Math.round(current.amountCents * feeBasisPoints / 10000), occurredAt: paidAt ?? new Date() }, update: {},
        });
      }
      if (status === 'REFUNDED') await creditRefundFee(transaction, attemptId, current.amountCents, current.amountCents, current.refundedAmountCents ?? 0);
      const webhookEvent = status === 'PAID' ? 'order.paid' : status === 'REFUNDED' ? 'order.refunded' : status === 'CANCELLED' || status === 'EXPIRED' ? 'order.cancelled' : 'payment.failed';
      await enqueueStoreWebhookEvent(transaction, current.session.checkout.storeId, webhookEvent, { order: { id: current.session.publicId, paymentId: current.publicId, status, totalCents: current.amountCents, currency: 'BRL', paidAt: paidAt?.toISOString() ?? null } }, `${current.publicId}:${status}`);
      return true;
    });
    return transitioned;
  }

  async recordPartialRefund(attemptId: string, checkoutSessionId: string, refundedAmountCents?: number): Promise<void> {
    await this.confirmPayment(attemptId, checkoutSessionId, 'PAID');
    await this.database.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM payment_attempts WHERE id = ${attemptId}::uuid FOR UPDATE`;
      const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { session: { include: { checkout: true } } } });
      if (attempt.status !== 'PAID') return;
      const verified = Number.isSafeInteger(refundedAmountCents) && refundedAmountCents! > 0 && refundedAmountCents! < attempt.amountCents;
      if (!verified) {
        if (attempt.partialRefundAt) return;
        await tx.paymentAttempt.update({ where: { id: attemptId }, data: { partialRefundAt: new Date() } });
        await tx.auditLog.create({ data: { storeId: attempt.session.checkout.storeId, actorType: 'SYSTEM', action: 'payment.partial_refund_review_required', targetType: 'payment_attempt', targetId: attempt.publicId, metadata: { reason: 'No verified cumulative refund amount in cents.' } } });
        return;
      }
      const cumulative = refundedAmountCents!;
      if (cumulative <= (attempt.refundedAmountCents ?? 0)) return;
      await tx.paymentAttempt.update({ where: { id: attemptId }, data: { partialRefundAt: attempt.partialRefundAt ?? new Date(), refundedAmountCents: cumulative } });
      await creditRefundFee(tx, attemptId, attempt.amountCents, cumulative, attempt.refundedAmountCents ?? 0);
      await tx.auditLog.create({ data: { storeId: attempt.session.checkout.storeId, actorType: 'SYSTEM', action: 'payment.partial_refund_verified', targetType: 'payment_attempt', targetId: attempt.publicId, metadata: { refundedAmountCents: cumulative } } });
      await enqueueStoreWebhookEvent(tx, attempt.session.checkout.storeId, 'order.refunded', { order: { id: attempt.session.publicId, paymentId: attempt.publicId, status: 'PARTIALLY_REFUNDED', totalCents: attempt.amountCents, refundedAmountCents: cumulative, currency: 'BRL' } }, `${attempt.publicId}:partial-refund:${cumulative}`);
    });
  }

  async billingAccessAllowed(storeId: string): Promise<boolean> {
    const owner = await this.database.storeMember.findFirst({ where: { storeId, role: 'OWNER' }, orderBy: { createdAt: 'asc' }, select: { user: { select: { billingSubscription: true } } } });
    const billing = owner?.user.billingSubscription;
    return !billing || effectiveBilling(billing).sponsored || (!billing.blockedAt && !['UNPAID', 'CANCELED'].includes(billing.status));
  }
}
