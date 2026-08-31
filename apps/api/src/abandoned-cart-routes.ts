import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { Prisma, PrismaClient } from '@solid/database';
import type { AuthRepository } from './auth-repository.js';
import { decryptSecret } from './shopify-crypto.js';
import { planLimits } from './plan-entitlements.js';
import { effectiveBilling } from './billing-entitlements.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
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
  const csrfCookie = environment.NODE_ENV === 'production' ? '__Host-solid_csrf' : 'solid_csrf';
  const recoveryContext = async (request: FastifyRequest, mutation = false) => {
    const token = request.cookies[sessionCookie];
    const current = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
    if (!current) return null;
    if (mutation) {
      const origin = request.headers.origin;
      const cookie = request.cookies[csrfCookie];
      const header = request.headers['x-csrf-token'];
      if (typeof origin !== 'string' || !environment.CORS_ORIGINS.includes(origin) || !cookie || typeof header !== 'string' || !safeEqual(cookie, header) || !safeEqual(sha256(header), current.csrfTokenHash)) return null;
    }
    const active = await database.session.findFirst({ where: { id: current.sessionId, userId: current.userId, revokedAt: null }, select: { activeStoreId: true } });
    if (!active?.activeStoreId) return null;
    const membership = await database.storeMember.findUnique({ where: { storeId_userId: { storeId: active.activeStoreId, userId: current.userId } }, select: { role: true } });
    return membership ? { storeId: active.activeStoreId, role: membership.role } : null;
  };

  app.get<{ Querystring: { page?: string; pageSize?: string; status?: string; search?: string; stage?: string; period?: string; sort?: string } }>('/abandoned-carts', async (request, reply) => {
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

    const stage = request.query.stage;
    if (stage && !['IDENTIFICATION', 'SHIPPING', 'PAYMENT'].includes(stage)) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Etapa inválida.'));
    const period = request.query.period;
    if (period && !['today', '7d', '30d'].includes(period)) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Período inválido.'));
    const sort = request.query.sort ?? 'newest';
    if (!['newest', 'oldest', 'highest', 'lowest'].includes(sort)) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Ordenação inválida.'));
    const search = (request.query.search ?? '').trim().toLocaleLowerCase('pt-BR').slice(0, 160);

    const owner = await database.storeMember.findFirst({
      where: { storeId: active.activeStoreId, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: { billingSubscription: true } } }
    });
    const subscription = owner?.user.billingSubscription;
    const retentionDays = planLimits(subscription ? effectiveBilling(subscription).plan : undefined).abandonedCartRetentionDays;
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
    const periodStart = period ? (period === 'today' ? new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now)}T00:00:00-03:00`) : new Date(now.getTime() - (period === '7d' ? 7 : 30) * 86_400_000)) : null;
    const stageWhere: Prisma.CheckoutSessionWhereInput | null = stage === 'PAYMENT' ? { paymentAttempts: { some: { providerTransactionId: { not: null } } } } : stage === 'SHIPPING' ? { OR: [{ shippingCapturedAt: { not: null } }, { shippingMethodName: { not: null } }], paymentAttempts: { none: { providerTransactionId: { not: null } } } } : stage === 'IDENTIFICATION' ? { shippingCapturedAt: null, shippingMethodName: null, paymentAttempts: { none: { providerTransactionId: { not: null } } } } : null;
    const emailHash = search.includes('@') ? createHmac('sha256', createHmac('sha256', Buffer.from(environment.APP_ENCRYPTION_KEY, 'base64')).update('solid-checkout-pii-index-v1').digest()).update(search).digest('hex') : null;
    const where: Prisma.CheckoutSessionWhereInput = {
      checkout: { storeId: active.activeStoreId }, customerCapturedAt: { not: null }, createdAt: { gte: retainedSince }, status: { not: 'COMPLETED' },
      AND: [stateWhere, ...(periodStart ? [{ updatedAt: { gte: periodStart } }] : []), ...(stageWhere ? [stageWhere] : []), ...(emailHash ? [{ customerEmailHash: emailHash }] : [])]
    };
    const select = {
      publicId: true, status: true, totalCents: true, discountCents: true, shippingPriceCents: true, currency: true, couponCode: true,
      source: true, trackingParameters: true, customerDataEncrypted: true, customerCapturedAt: true, shippingCapturedAt: true,
      shippingMethodName: true, expiresAt: true, createdAt: true, updatedAt: true,
      items: { select: { titleSnapshot: true, quantity: true, imageUrlSnapshot: true } },
      paymentAttempts: { where: { providerTransactionId: { not: null } }, orderBy: { createdAt: 'desc' as const }, take: 1, select: { provider: true, status: true, expiresAt: true, createdAt: true } }
    } satisfies Prisma.CheckoutSessionSelect;
    const requiresDecryptedSearch = Boolean(search && !emailHash);
    const orderBy = sort === 'oldest' ? { updatedAt: 'asc' as const } : sort === 'highest' ? { totalCents: 'desc' as const } : sort === 'lowest' ? { totalCents: 'asc' as const } : { updatedAt: 'desc' as const };
    const records = await database.checkoutSession.findMany({ where, orderBy, take: requiresDecryptedSearch ? 500 : pageSize, ...(requiresDecryptedSearch ? {} : { skip: (page - 1) * pageSize }), select });

    const normalizeStatus = (record: { paymentAttempts: readonly { status: string; expiresAt?: Date | null }[]; expiresAt: Date }) => {
      const attempt = record.paymentAttempts[0];
      return attempt?.status === 'PENDING' && (attempt.expiresAt ?? record.expiresAt) > now ? 'PIX_PENDING' : 'ABANDONED';
    };
    let allItems = records.map(record => ({
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
    if (requiresDecryptedSearch) allItems = allItems.filter(item => `${item.customer.name ?? ''} ${item.customer.email ?? ''}`.toLocaleLowerCase('pt-BR').includes(search));
    const [aggregate, pendingAggregate] = await database.$transaction([
      database.checkoutSession.aggregate({ where, _count: true, _sum: { totalCents: true, discountCents: true, shippingPriceCents: true } }),
      database.checkoutSession.aggregate({ where: { AND: [where, pending] }, _count: true, _sum: { totalCents: true, discountCents: true, shippingPriceCents: true } })
    ]);
    const databaseTotal = aggregate._count;
    const total = requiresDecryptedSearch ? allItems.length : databaseTotal;
    const items = requiresDecryptedSearch ? allItems.slice((page - 1) * pageSize, page * pageSize) : allItems;
    const aggregateCents = (aggregate._sum.totalCents ?? 0) - (aggregate._sum.discountCents ?? 0) + (aggregate._sum.shippingPriceCents ?? 0);
    const pendingCents = (pendingAggregate._sum.totalCents ?? 0) - (pendingAggregate._sum.discountCents ?? 0) + (pendingAggregate._sum.shippingPriceCents ?? 0);
    const filteredTotalCents = requiresDecryptedSearch ? allItems.reduce((sum, item) => sum + item.totalCents, 0) : aggregateCents;
    const metrics = { totalCents: filteredTotalCents, pendingCents, pendingCount: pendingAggregate._count, abandonedCount: Math.max(0, databaseTotal - pendingAggregate._count), averageCents: total ? Math.round(filteredTotalCents / total) : 0 };
    return reply.header('cache-control', 'private, no-store').send({ items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), retentionDays, metrics, searchLimited: requiresDecryptedSearch && records.length === 500 });
  });

  app.get('/abandoned-carts/recovery-settings', async (request, reply) => {
    const context = await recoveryContext(request);
    if (!context) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const settings = await database.abandonedRecoverySettings.findUnique({ where: { storeId: context.storeId } });
    const [delivered, pending, failed] = await Promise.all([
      database.abandonedRecoveryDelivery.count({ where: { storeId: context.storeId, status: 'DELIVERED', lastError: null } }),
      database.abandonedRecoveryDelivery.count({ where: { storeId: context.storeId, status: { in: ['PENDING', 'PROCESSING'] } } }),
      database.abandonedRecoveryDelivery.count({ where: { storeId: context.storeId, status: 'DEAD' } })
    ]);
    return reply.header('cache-control', 'private, no-store').send({
      settings: settings ? { enabled: settings.enabled, firstDelayMinutes: settings.firstDelayMinutes, secondEnabled: settings.secondEnabled, secondDelayHours: settings.secondDelayHours } : { enabled: false, firstDelayMinutes: 60, secondEnabled: false, secondDelayHours: 24 },
      writable: context.role === 'OWNER' || context.role === 'ADMIN',
      metrics: { delivered, pending, failed }
    });
  });

  app.put<{ Body: { enabled?: unknown; firstDelayMinutes?: unknown; secondEnabled?: unknown; secondDelayHours?: unknown } }>('/abandoned-carts/recovery-settings', async (request, reply) => {
    const context = await recoveryContext(request, true);
    if (!context || !['OWNER', 'ADMIN'].includes(context.role)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const { enabled, firstDelayMinutes, secondEnabled, secondDelayHours } = request.body ?? {};
    if (typeof enabled !== 'boolean' || typeof secondEnabled !== 'boolean' || !Number.isInteger(firstDelayMinutes) || Number(firstDelayMinutes) < 15 || Number(firstDelayMinutes) > 10_080 || !Number.isInteger(secondDelayHours) || Number(secondDelayHours) < 1 || Number(secondDelayHours) > 168) {
      return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Revise os intervalos da recuperação.'));
    }
    if (secondEnabled && Number(secondDelayHours) * 60 <= Number(firstDelayMinutes)) {
      return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'O segundo lembrete deve ser enviado depois do primeiro.'));
    }
    if (enabled && (!environment.RESEND_API_KEY || !environment.EMAIL_FROM || !environment.APP_ENCRYPTION_KEY)) return reply.code(503).send(errorBody(request, 'EMAIL_NOT_CONFIGURED', 'O envio de e-mail ainda não está disponível no servidor.'));
    const existing = await database.abandonedRecoverySettings.findUnique({ where: { storeId: context.storeId }, select: { enabled: true, activatedAt: true } });
    const activatedAt = enabled ? (!existing?.enabled || !existing.activatedAt ? new Date() : existing.activatedAt) : null;
    const settings = await database.abandonedRecoverySettings.upsert({
      where: { storeId: context.storeId },
      create: { storeId: context.storeId, enabled, activatedAt, firstDelayMinutes: Number(firstDelayMinutes), secondEnabled, secondDelayHours: Number(secondDelayHours) },
      update: { enabled, activatedAt, firstDelayMinutes: Number(firstDelayMinutes), secondEnabled, secondDelayHours: Number(secondDelayHours) }
    });
    return reply.send({ settings: { enabled: settings.enabled, firstDelayMinutes: settings.firstDelayMinutes, secondEnabled: settings.secondEnabled, secondDelayHours: settings.secondDelayHours } });
  });
}
