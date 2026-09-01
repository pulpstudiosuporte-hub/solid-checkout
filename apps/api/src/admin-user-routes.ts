import { createHash, timingSafeEqual } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository, SessionUser } from './auth-repository.js';
import { effectiveBilling } from './billing-entitlements.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

export function registerAdminUserRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  const secure = environment.NODE_ENV === 'production';
  const sessionCookie = secure ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = secure ? '__Host-solid_csrf' : 'solid_csrf';

  const adminSession = async (request: FastifyRequest): Promise<SessionUser | null> => {
    const token = request.cookies[sessionCookie];
    const session = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
    return session?.user.platformAdmin ? session : null;
  };
  const mutationAllowed = (request: FastifyRequest, session: SessionUser): boolean => {
    const origin = request.headers.origin;
    const header = request.headers['x-csrf-token'];
    const cookie = request.cookies[csrfCookie];
    return typeof origin === 'string' && environment.CORS_ORIGINS.includes(origin) && typeof header === 'string' && Boolean(cookie) && safeEqual(cookie!, header) && safeEqual(sha256(header), session.csrfTokenHash);
  };

  app.get<{ Querystring: { status?: string; page?: string } }>('/admin/users', async (request, reply) => {
    const session = await adminSession(request);
    if (!session) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso administrativo necessário.'));
    const allowed = ['PENDING', 'APPROVED', 'REJECTED'] as const;
    const status = allowed.includes(request.query.status as typeof allowed[number]) ? request.query.status as typeof allowed[number] : 'APPROVED';
    const page = Math.max(1, Number.parseInt(request.query.page ?? '1', 10) || 1);
    const pageSize = 30;
    const where = { accountStatus: status };
    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        select: { publicId: true, name: true, email: true, accountStatus: true, platformAdmin: true, disabledAt: true, emailVerifiedAt: true, createdAt: true, billingSubscription: true, memberships: { select: { role: true, store: { select: { name: true, publicId: true } } } } }
      })
    ]);
    const normalizedUsers = users.map(({ billingSubscription, ...user }) => {
      const effective = billingSubscription ? effectiveBilling(billingSubscription) : { plan: 'START', feeBasisPoints: 200, monthlyPriceCents: 0, sponsored: false, monthlyWaived: false, expiresAt: null, reason: null };
      return {
        ...user,
        billing: {
          basePlan: billingSubscription?.plan ?? 'START',
          plan: effective.plan,
          feeBasisPoints: effective.feeBasisPoints,
          monthlyPriceCents: effective.monthlyPriceCents,
          sponsored: effective.sponsored,
          monthlyWaived: effective.monthlyWaived,
          expiresAt: effective.expiresAt,
          reason: effective.reason,
          override: billingSubscription ? {
            plan: billingSubscription.adminPlanOverride,
            feeBasisPoints: billingSubscription.adminFeeBasisPoints,
            monthlyWaived: billingSubscription.adminMonthlyWaived,
            expiresAt: billingSubscription.adminOverrideExpiresAt,
            reason: billingSubscription.adminOverrideReason,
          } : null,
        },
      };
    });
    return reply.header('cache-control', 'private, no-store').send({ users: normalizedUsers, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
  });

  app.patch<{ Params: { publicId: string }; Body: { plan?: unknown; feeBasisPoints?: unknown; monthlyWaived?: unknown; expiresAt?: unknown; reason?: unknown } }>('/admin/users/:publicId/billing-override', async (request, reply) => {
    const session = await adminSession(request);
    if (!session) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso administrativo necessário.'));
    if (!mutationAllowed(request, session)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const target = await db.user.findUnique({ where: { publicId: request.params.publicId }, select: { id: true, publicId: true, platformAdmin: true, billingSubscription: true } });
    if (!target) return reply.code(404).send(failure(request, 'USER_NOT_FOUND', 'Usuário não encontrado.'));
    if (target.platformAdmin) return reply.code(409).send(failure(request, 'ADMIN_OVERRIDE_FORBIDDEN', 'Use este benefício apenas em contas de clientes.'));

    const plan = request.body?.plan === null || request.body?.plan === '' ? null : request.body?.plan;
    const feeBasisPoints = request.body?.feeBasisPoints === null || request.body?.feeBasisPoints === '' ? null : Number(request.body?.feeBasisPoints);
    const monthlyWaived = request.body?.monthlyWaived === true;
    const expiresAtInput = request.body?.expiresAt === null || request.body?.expiresAt === '' ? null : request.body?.expiresAt;
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim().replace(/\s+/g, ' ') : '';
    if (plan !== null && (typeof plan !== 'string' || !['START', 'PRIME', 'ELITE'].includes(plan))) return reply.code(400).send(failure(request, 'INVALID_PLAN', 'Escolha um plano válido.'));
    const selectedPlan = plan === null ? null : plan as 'START' | 'PRIME' | 'ELITE';
    if (feeBasisPoints !== null && (!Number.isInteger(feeBasisPoints) || feeBasisPoints < 0 || feeBasisPoints > 1000)) return reply.code(400).send(failure(request, 'INVALID_FEE', 'A taxa deve ficar entre 0% e 10%.'));
    const expiresAt = typeof expiresAtInput === 'string' ? new Date(expiresAtInput) : null;
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())) return reply.code(400).send(failure(request, 'INVALID_EXPIRATION', 'Informe uma validade futura.'));
    const hasOverride = selectedPlan !== null || feeBasisPoints !== null || monthlyWaived;
    if (hasOverride && (reason.length < 3 || reason.length > 240)) return reply.code(400).send(failure(request, 'INVALID_REASON', 'Informe um motivo entre 3 e 240 caracteres.'));
    if (monthlyWaived && target.billingSubscription?.stripeSubscriptionId && !['CANCELED', 'INCOMPLETE'].includes(target.billingSubscription.status)) return reply.code(409).send(failure(request, 'ACTIVE_STRIPE_SUBSCRIPTION', 'Cancele primeiro a assinatura ativa na Stripe para evitar nova cobrança mensal.'));

    const subscription = await db.$transaction(async transaction => {
      const updated = await transaction.billingSubscription.upsert({
        where: { userId: target.id },
        create: { userId: target.id, adminPlanOverride: selectedPlan, adminFeeBasisPoints: feeBasisPoints, adminMonthlyWaived: monthlyWaived, adminOverrideExpiresAt: expiresAt, adminOverrideReason: hasOverride ? reason : null },
        update: { adminPlanOverride: selectedPlan, adminFeeBasisPoints: feeBasisPoints, adminMonthlyWaived: monthlyWaived, adminOverrideExpiresAt: hasOverride ? expiresAt : null, adminOverrideReason: hasOverride ? reason : null },
      });
      await transaction.auditLog.create({ data: { actorType: 'USER', actorUserId: session.userId, action: hasOverride ? 'admin.billing_override_updated' : 'admin.billing_override_removed', targetType: 'user', targetId: target.publicId, requestId: request.id, metadata: { plan: selectedPlan, feeBasisPoints, monthlyWaived, expiresAt: expiresAt?.toISOString() ?? null, reason: hasOverride ? reason : null } } });
      return updated;
    });
    return reply.send({ billing: { ...effectiveBilling(subscription), basePlan: subscription.plan, override: { plan: subscription.adminPlanOverride, feeBasisPoints: subscription.adminFeeBasisPoints, monthlyWaived: subscription.adminMonthlyWaived, expiresAt: subscription.adminOverrideExpiresAt, reason: subscription.adminOverrideReason } } });
  });

  app.post<{ Params: { publicId: string } }>('/admin/users/:publicId/approve', async (request, reply) => {
    const session = await adminSession(request);
    if (!session) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso administrativo necessário.'));
    if (!mutationAllowed(request, session)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const target = await db.user.findUnique({ where: { publicId: request.params.publicId }, select: { id: true, publicId: true } });
    if (!target) return reply.code(404).send(failure(request, 'USER_NOT_FOUND', 'Usuário não encontrado.'));
    await db.$transaction([
      db.user.update({ where: { id: target.id }, data: { accountStatus: 'APPROVED', disabledAt: null } }),
      db.auditLog.create({ data: { actorType: 'USER', actorUserId: session.userId, action: 'admin.user_approved', targetType: 'user', targetId: target.publicId, requestId: request.id } })
    ]);
    return reply.send({ status: 'APPROVED' });
  });

  app.post<{ Params: { publicId: string } }>('/admin/users/:publicId/block', async (request, reply) => {
    const session = await adminSession(request);
    if (!session) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso administrativo necessário.'));
    if (!mutationAllowed(request, session)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    if (request.params.publicId === session.user.publicId) return reply.code(409).send(failure(request, 'SELF_BLOCK_FORBIDDEN', 'Você não pode bloquear sua própria conta.'));
    const target = await db.user.findUnique({ where: { publicId: request.params.publicId }, select: { id: true, publicId: true, platformAdmin: true } });
    if (!target) return reply.code(404).send(failure(request, 'USER_NOT_FOUND', 'Usuário não encontrado.'));
    if (target.platformAdmin) return reply.code(409).send(failure(request, 'ADMIN_BLOCK_FORBIDDEN', 'Outro administrador da plataforma não pode ser bloqueado por esta tela.'));
    const now = new Date();
    await db.$transaction([
      db.user.update({ where: { id: target.id }, data: { accountStatus: 'REJECTED', disabledAt: now } }),
      db.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: now } }),
      db.pushSubscription.deleteMany({ where: { userId: target.id } }),
      db.auditLog.create({ data: { actorType: 'USER', actorUserId: session.userId, action: 'admin.user_blocked', targetType: 'user', targetId: target.publicId, requestId: request.id, metadata: { sessionsRevoked: true } } })
    ]);
    return reply.send({ status: 'REJECTED' });
  });
}
