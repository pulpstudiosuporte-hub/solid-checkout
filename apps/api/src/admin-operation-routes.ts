import { createHash, timingSafeEqual } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository, SessionUser } from './auth-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

export function registerAdminOperationRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  const secure = environment.NODE_ENV === 'production';
  const sessionCookie = secure ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = secure ? '__Host-solid_csrf' : 'solid_csrf';
  const adminSession = async (request: FastifyRequest): Promise<SessionUser | null> => {
    const token = request.cookies[sessionCookie]; const session = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
    return session?.user.platformAdmin ? session : null;
  };
  const mutationAllowed = (request: FastifyRequest, session: SessionUser): boolean => {
    const origin = request.headers.origin; const header = request.headers['x-csrf-token']; const cookie = request.cookies[csrfCookie];
    return typeof origin === 'string' && environment.CORS_ORIGINS.includes(origin) && typeof header === 'string' && Boolean(cookie) && safeEqual(cookie!, header) && safeEqual(sha256(header), session.csrfTokenHash);
  };

  app.get('/admin/advanced/overview', async (request, reply) => {
    if (!await adminSession(request)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso administrativo necessário.'));
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [
      users, pendingUsers, approvedUsers, blockedUsers, unverifiedUsers, mfaUsers,
      stores, checkouts, publishedCheckouts, paymentAttempts, pendingPayments, paidPayments, paidRevenue,
      shopifyConnected, shopifyAttention, gatewayConnected, activeDomains, activeSessions, auditEvents24h,
      pendingOperations, processingOperations, deadOperations, recentAudit
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { accountStatus: 'PENDING' } }),
      db.user.count({ where: { accountStatus: 'APPROVED' } }),
      db.user.count({ where: { disabledAt: { not: null } } }),
      db.user.count({ where: { emailVerifiedAt: null } }),
      db.user.count({ where: { mfaEnabledAt: { not: null } } }),
      db.store.count({ where: { active: true } }),
      db.checkout.count({ where: { archivedAt: null } }),
      db.checkout.count({ where: { archivedAt: null, status: 'PUBLISHED' } }),
      db.paymentAttempt.count({ where: { createdAt: { gte: since30d } } }),
      db.paymentAttempt.count({ where: { status: 'PENDING' } }),
      db.paymentAttempt.count({ where: { status: 'PAID', paidAt: { gte: since30d } } }),
      db.paymentAttempt.aggregate({ where: { status: 'PAID', paidAt: { gte: since30d } }, _sum: { amountCents: true } }),
      db.shopifyConnection.count({ where: { revokedAt: null, reconnectRequiredAt: null } }),
      db.shopifyConnection.count({ where: { OR: [{ revokedAt: { not: null } }, { reconnectRequiredAt: { not: null } }] } }),
      db.gatewayConnection.count({ where: { active: true, verifiedAt: { not: null } } }),
      db.storeDomain.count({ where: { status: 'ACTIVE' } }),
      db.session.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
      db.auditLog.count({ where: { createdAt: { gte: since24h } } }),
      db.integrationDeliveryJob.count({ where: { status: 'PENDING' } }),
      db.integrationDeliveryJob.count({ where: { status: 'PROCESSING' } }),
      db.integrationDeliveryJob.count({ where: { status: 'DEAD' } }),
      db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, action: true, actorType: true, targetType: true, targetId: true, createdAt: true } })
    ]);
    const status = deadOperations > 0 ? 'critical' : pendingOperations + processingOperations + shopifyAttention > 0 ? 'attention' : 'operational';
    return reply.header('cache-control', 'private, no-store').send({
      generatedAt: now,
      status,
      metrics: {
        users: { total: users, pending: pendingUsers, approved: approvedUsers, blocked: blockedUsers, emailUnverified: unverifiedUsers, mfaEnabled: mfaUsers },
        commerce: { stores, checkouts, publishedCheckouts, paymentAttempts, pendingPayments, paidPayments, revenueCents30d: paidRevenue._sum.amountCents ?? 0 },
        integrations: { shopifyConnected, shopifyAttention, gatewayConnected, activeDomains },
        security: { activeSessions, mfaAdoptionPercent: users ? Math.round((mfaUsers / users) * 100) : 0, auditEvents24h },
        operations: { pending: pendingOperations, processing: processingOperations, dead: deadOperations }
      },
      recentAudit: recentAudit.map(event => ({ ...event, id: event.id.toString() }))
    });
  });

  app.get('/admin/operations', async (request, reply) => {
    if (!await adminSession(request)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso administrativo necessário.'));
    const [deliveries, shopify, customerEmails, merchantEmails] = await Promise.all([
      db.integrationDeliveryJob.findMany({ where: { status: { not: 'DELIVERED' } }, orderBy: { updatedAt: 'desc' }, take: 100, select: { publicId: true, provider: true, event: true, status: true, attempts: true, nextAttemptAt: true, lastError: true, updatedAt: true, store: { select: { name: true } }, checkoutSession: { select: { publicId: true } } } }),
      db.checkoutSession.findMany({ where: { shopifySyncStatus: 'FAILED' }, orderBy: { updatedAt: 'desc' }, take: 50, select: { publicId: true, shopifySyncError: true, updatedAt: true, checkout: { select: { store: { select: { name: true } } } } } }),
      db.checkoutSession.findMany({ where: { confirmationEmailSentAt: null, confirmationEmailLastError: { not: null } }, orderBy: { updatedAt: 'desc' }, take: 50, select: { publicId: true, confirmationEmailAttempts: true, confirmationEmailNextAttemptAt: true, confirmationEmailLastError: true, updatedAt: true, checkout: { select: { store: { select: { name: true } } } } } }),
      db.checkoutSession.findMany({ where: { merchantEmailSentAt: null, merchantEmailLastError: { not: null } }, orderBy: { updatedAt: 'desc' }, take: 50, select: { publicId: true, merchantEmailAttempts: true, merchantEmailNextAttemptAt: true, merchantEmailLastError: true, updatedAt: true, checkout: { select: { store: { select: { name: true } } } } } })
    ]);
    const jobs = [
      ...deliveries.map(job => ({ id: `delivery:${job.publicId}`, kind: 'Rastreamento', provider: job.provider, event: job.event, status: job.status, attempts: job.attempts, nextAttemptAt: job.nextAttemptAt, error: job.lastError, updatedAt: job.updatedAt, store: job.store.name, order: job.checkoutSession.publicId })),
      ...shopify.map(job => ({ id: `shopify:${job.publicId}`, kind: 'Shopify', provider: 'SHOPIFY', event: 'Sincronizar pedido', status: 'FAILED', attempts: null, nextAttemptAt: null, error: job.shopifySyncError, updatedAt: job.updatedAt, store: job.checkout.store.name, order: job.publicId })),
      ...customerEmails.map(job => ({ id: `customer-email:${job.publicId}`, kind: 'E-mail', provider: 'RESEND', event: 'Recibo do comprador', status: job.confirmationEmailAttempts >= 8 ? 'DEAD' : 'PENDING', attempts: job.confirmationEmailAttempts, nextAttemptAt: job.confirmationEmailNextAttemptAt, error: job.confirmationEmailLastError, updatedAt: job.updatedAt, store: job.checkout.store.name, order: job.publicId })),
      ...merchantEmails.map(job => ({ id: `merchant-email:${job.publicId}`, kind: 'E-mail', provider: 'RESEND', event: 'Aviso ao lojista', status: job.merchantEmailAttempts >= 8 ? 'DEAD' : 'PENDING', attempts: job.merchantEmailAttempts, nextAttemptAt: job.merchantEmailNextAttemptAt, error: job.merchantEmailLastError, updatedAt: job.updatedAt, store: job.checkout.store.name, order: job.publicId }))
    ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return reply.header('cache-control', 'private, no-store').send({ jobs, summary: { total: jobs.length, dead: jobs.filter(job => job.status === 'DEAD').length, retrying: jobs.filter(job => job.status !== 'DEAD').length } });
  });

  app.post<{ Params: { jobId: string } }>('/admin/operations/:jobId/retry', async (request, reply) => {
    const session = await adminSession(request); if (!session) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso administrativo necessário.'));
    if (!mutationAllowed(request, session)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const [kind, publicId] = request.params.jobId.split(':', 2); if (!kind || !publicId) return reply.code(400).send(failure(request, 'INVALID_JOB', 'Job inválido.'));
    let changed = 0;
    if (kind === 'delivery') changed = (await db.integrationDeliveryJob.updateMany({ where: { publicId }, data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), claimedAt: null, lastError: null } })).count;
    else if (kind === 'shopify') changed = (await db.checkoutSession.updateMany({ where: { publicId }, data: { shopifySyncStatus: null, shopifySyncStartedAt: null, shopifySyncError: null } })).count;
    else if (kind === 'customer-email') changed = (await db.checkoutSession.updateMany({ where: { publicId }, data: { confirmationEmailAttempts: 0, confirmationEmailClaimedAt: null, confirmationEmailNextAttemptAt: new Date(), confirmationEmailLastError: null } })).count;
    else if (kind === 'merchant-email') changed = (await db.checkoutSession.updateMany({ where: { publicId }, data: { merchantEmailAttempts: 0, merchantEmailClaimedAt: null, merchantEmailNextAttemptAt: new Date(), merchantEmailLastError: null } })).count;
    if (!changed) return reply.code(404).send(failure(request, 'JOB_NOT_FOUND', 'Falha não encontrada ou já removida.'));
    await db.auditLog.create({ data: { actorType: 'USER', actorUserId: session.userId, action: 'admin.operation_retry_requested', targetType: 'operation_job', targetId: request.params.jobId, requestId: request.id } });
    return reply.send({ queued: true });
  });
}
