import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { Prisma, PrismaClient } from '@solid/database';
import type { AuthRepository } from './auth-repository.js';
import { decryptSecret } from './shopify-crypto.js';
import { planLimits } from './plan-entitlements.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

function customerData(value: string | null, key: string, request: FastifyRequest, id: string) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(decryptSecret(value, key)) as Record<string, unknown>;
    return Object.fromEntries(['name', 'email', 'phone'].flatMap(field => typeof parsed[field] === 'string' ? [[field, parsed[field]]] : []));
  } catch (error) {
    request.log.error({ err: error, checkoutSessionId: id }, 'abandoned_cart_customer_decryption_failed');
    return {};
  }
}

export function registerAbandonedCartRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, database: PrismaClient): void {
  const sessionCookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';

  app.get<{ Querystring: { page?: string; pageSize?: string; status?: string } }>('/abandoned-carts', async (request, reply) => {
    const token = request.cookies[sessionCookie];
    const current = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
    if (!current) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const active = await database.session.findFirst({ where: { id: current.sessionId, userId: current.userId, revokedAt: null }, select: { activeStoreId: true } });
    if (!active?.activeStoreId) return reply.code(409).send(errorBody(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    const membership = await database.storeMember.findUnique({ where: { storeId_userId: { storeId: active.activeStoreId, userId: current.userId } }, select: { id: true } });
    if (!membership) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Proteção de dados indisponível.'));

    const page = Number(request.query.page ?? '1');
    const pageSize = Number(request.query.pageSize ?? '20');
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Paginação inválida.'));
    const status = request.query.status;
    if (status && !['ABANDONED', 'PIX_PENDING'].includes(status)) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Status inválido.'));

    const owner = await database.storeMember.findFirst({
      where: { storeId: active.activeStoreId, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: { billingSubscription: { select: { plan: true } } } } }
    });
    const retentionDays = planLimits(owner?.user.billingSubscription?.plan).abandonedCartRetentionDays;
    const now = new Date();
    const retainedSince = new Date(now.getTime() - retentionDays * 86_400_000);
    const pending: Prisma.CheckoutSessionWhereInput = {
      OR: [
        { paymentAttempts: { some: { status: 'PENDING', providerTransactionId: { not: null }, expiresAt: { gt: now } } } },
        { expiresAt: { gt: now }, paymentAttempts: { some: { status: 'PENDING', providerTransactionId: { not: null }, expiresAt: null } } }
      ]
    };
    const expiredSession: Prisma.CheckoutSessionWhereInput = { OR: [{ status: { in: ['EXPIRED', 'CANCELLED'] } }, { status: 'OPEN', expiresAt: { lte: now } }] };
    const abandoned: Prisma.CheckoutSessionWhereInput = { AND: [expiredSession, { NOT: pending }] };
    const stateWhere: Prisma.CheckoutSessionWhereInput = status === 'ABANDONED' ? abandoned : status === 'PIX_PENDING' ? pending : { OR: [abandoned, pending] };
    const where: Prisma.CheckoutSessionWhereInput = { checkout: { storeId: active.activeStoreId }, customerCapturedAt: { not: null }, createdAt: { gte: retainedSince }, status: { not: 'COMPLETED' }, AND: [stateWhere] };
    const select = {
      publicId: true, status: true, totalCents: true, discountCents: true, shippingPriceCents: true, currency: true, couponCode: true,
      source: true, trackingParameters: true, customerDataEncrypted: true, customerCapturedAt: true, shippingCapturedAt: true,
      shippingMethodName: true, expiresAt: true, createdAt: true, updatedAt: true,
      items: { select: { titleSnapshot: true, quantity: true, imageUrlSnapshot: true } },
      paymentAttempts: { where: { providerTransactionId: { not: null } }, orderBy: { createdAt: 'desc' as const }, take: 1, select: { provider: true, status: true, expiresAt: true, createdAt: true } }
    } satisfies Prisma.CheckoutSessionSelect;
    const [records, total, summaryRecords] = await database.$transaction([
      database.checkoutSession.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select }),
      database.checkoutSession.count({ where }),
      database.checkoutSession.findMany({ where: { checkout: { storeId: active.activeStoreId }, customerCapturedAt: { not: null }, createdAt: { gte: retainedSince }, status: { not: 'COMPLETED' }, OR: [abandoned, pending] }, select: { totalCents: true, discountCents: true, shippingPriceCents: true, status: true, expiresAt: true, paymentAttempts: { where: { providerTransactionId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, expiresAt: true } } } })
    ]);

    const normalizeStatus = (record: { paymentAttempts: readonly { status: string; expiresAt?: Date | null }[]; expiresAt: Date }) => {
      const attempt = record.paymentAttempts[0];
      return attempt?.status === 'PENDING' && (attempt.expiresAt ?? record.expiresAt) > now ? 'PIX_PENDING' : 'ABANDONED';
    };
    const items = records.map(record => ({
      publicId: record.publicId,
      status: normalizeStatus(record),
      lastStage: record.paymentAttempts.length ? 'PAYMENT' : record.shippingCapturedAt || record.shippingMethodName ? 'SHIPPING' : 'IDENTIFICATION',
      totalCents: record.totalCents - record.discountCents + record.shippingPriceCents,
      currency: record.currency,
      couponCode: record.couponCode,
      source: record.source,
      tracking: record.trackingParameters,
      customer: customerData(record.customerDataEncrypted, environment.APP_ENCRYPTION_KEY!, request, record.publicId),
      items: record.items,
      createdAt: record.createdAt,
      lastActivityAt: record.updatedAt,
      expiresAt: record.paymentAttempts[0]?.expiresAt ?? record.expiresAt,
      paymentProvider: record.paymentAttempts[0]?.provider ?? null
    }));
    const metrics = summaryRecords.reduce((result, record) => {
      const currentStatus = normalizeStatus(record);
      const amount = record.totalCents - record.discountCents + record.shippingPriceCents;
      result.totalCents += amount;
      if (currentStatus === 'PIX_PENDING') { result.pendingCount += 1; result.pendingCents += amount; }
      else result.abandonedCount += 1;
      return result;
    }, { totalCents: 0, pendingCents: 0, abandonedCount: 0, pendingCount: 0 });

    return reply.header('cache-control', 'private, no-store').send({ items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), retentionDays, metrics });
  });
}
