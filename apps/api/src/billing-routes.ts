import { createHash, timingSafeEqual } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { BillingPlan, BillingSubscriptionStatus, PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import Stripe from 'stripe';
import type { AuthRepository, SessionUser } from './auth-repository.js';
import { createRoasPix, getRoasPix } from './roas-client.js';
import { decryptSecret, encryptSecret } from './shopify-crypto.js';

const plans = {
  START: { name: 'Start', monthlyPriceCents: 0, feeBasisPoints: 200 },
  PRIME: { name: 'Prime', monthlyPriceCents: 14_700, feeBasisPoints: 150 },
  ELITE: { name: 'Elite', monthlyPriceCents: 44_700, feeBasisPoints: 100 },
} as const;

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const statusFromStripe = (status: Stripe.Subscription.Status): BillingSubscriptionStatus => {
  if (status === 'active') return 'ACTIVE';
  if (status === 'trialing') return 'TRIALING';
  if (status === 'past_due') return 'PAST_DUE';
  if (status === 'unpaid' || status === 'paused') return 'UNPAID';
  if (status === 'canceled') return 'CANCELED';
  return 'INCOMPLETE';
};

export function registerBillingRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  const cookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = environment.NODE_ENV === 'production' ? '__Host-solid_csrf' : 'solid_csrf';
  const stripe = environment.STRIPE_SECRET_KEY ? new Stripe(environment.STRIPE_SECRET_KEY) : null;
  const stripeReady = Boolean(stripe && environment.STRIPE_WEBHOOK_SECRET && environment.STRIPE_PRICE_START && environment.STRIPE_PRICE_PRIME && environment.STRIPE_PRICE_ELITE && environment.APP_URL);
  const billingRoasReady = Boolean(environment.BILLING_ROAS_PUBLIC_KEY && environment.BILLING_ROAS_SECRET_KEY && environment.API_PUBLIC_URL && environment.APP_ENCRYPTION_KEY);
  const billingRoasCredentials = billingRoasReady ? { publicKey: environment.BILLING_ROAS_PUBLIC_KEY!, secretKey: environment.BILLING_ROAS_SECRET_KEY! } : null;
  const planFromSubscription = (subscription: Stripe.Subscription): BillingPlan | undefined => {
    const priceId = subscription.items.data[0]?.price.id;
    if (priceId === environment.STRIPE_PRICE_START) return 'START';
    if (priceId === environment.STRIPE_PRICE_PRIME) return 'PRIME';
    if (priceId === environment.STRIPE_PRICE_ELITE) return 'ELITE';
    const metadataPlan = subscription.metadata.solid_plan;
    return metadataPlan && metadataPlan in plans ? metadataPlan as BillingPlan : undefined;
  };

  const activeSession = async (request: FastifyRequest): Promise<SessionUser | null> => {
    const token = request.cookies[cookie];
    return token ? auth.findActiveSession(sha256(token), new Date()) : null;
  };
  const mutationAllowed = (request: FastifyRequest, session: SessionUser): boolean => {
    const origin = request.headers.origin; const header = request.headers['x-csrf-token']; const csrf = request.cookies[csrfCookie];
    return typeof origin === 'string' && environment.CORS_ORIGINS.includes(origin) && typeof header === 'string' && Boolean(csrf) && safeEqual(csrf!, header) && safeEqual(sha256(header), session.csrfTokenHash);
  };
  const ensureSubscription = (userId: string) => db.billingSubscription.upsert({ where: { userId }, create: { userId }, update: {} });
  const activatePixPlan = async (invoice: { id: string; userId: string; plan: BillingPlan; createdAt: Date }, paidAt = new Date()) => {
    const periodEnd = new Date(paidAt.getTime() + 30 * 86_400_000);
    await db.$transaction([
      db.billingPixInvoice.update({ where: { id: invoice.id }, data: { status: 'PAID', paidAt } }),
      db.billingSubscription.upsert({
        where: { userId: invoice.userId },
        create: { userId: invoice.userId, plan: invoice.plan, status: 'ACTIVE', monthlyPriceCents: plans[invoice.plan].monthlyPriceCents, feeBasisPoints: plans[invoice.plan].feeBasisPoints, paymentProvider: 'ROAS', currentPeriodStart: paidAt, currentPeriodEnd: periodEnd },
        update: { plan: invoice.plan, status: 'ACTIVE', monthlyPriceCents: plans[invoice.plan].monthlyPriceCents, feeBasisPoints: plans[invoice.plan].feeBasisPoints, paymentProvider: 'ROAS', currentPeriodStart: paidAt, currentPeriodEnd: periodEnd, blockedAt: null, graceUntil: null, canceledAt: null },
      }),
      db.billingLedgerEntry.updateMany({ where: { userId: invoice.userId, billedAt: null, occurredAt: { lte: invoice.createdAt } }, data: { billedAt: paidAt } }),
    ]);
  };

  app.get('/billing', async (request, reply) => {
    const session = await activeSession(request); if (!session) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const subscription = await ensureSubscription(session.userId);
    const periodStart = subscription.currentPeriodStart ?? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const entries = await db.billingLedgerEntry.aggregate({ where: { userId: session.userId, occurredAt: { gte: periodStart }, billedAt: null }, _sum: { grossAmountCents: true, amountCents: true }, _count: true });
    return reply.header('cache-control', 'private, no-store').send({
      configured: stripeReady || billingRoasReady,
      paymentMethods: { card: stripeReady, pix: billingRoasReady },
      subscription: { plan: subscription.plan, status: subscription.status, monthlyPriceCents: subscription.monthlyPriceCents, feeBasisPoints: subscription.feeBasisPoints, paymentProvider: subscription.paymentProvider, currentPeriodStart: subscription.currentPeriodStart, currentPeriodEnd: subscription.currentPeriodEnd, graceUntil: subscription.graceUntil, blocked: Boolean(subscription.blockedAt), cardConfigured: Boolean(subscription.stripeCustomerId && subscription.stripeSubscriptionId) },
      usage: { grossAmountCents: entries._sum.grossAmountCents ?? 0, feeAmountCents: entries._sum.amountCents ?? 0, transactions: entries._count },
      plans: Object.entries(plans).map(([id, plan]) => ({ id, ...plan })),
    });
  });

  app.post<{ Body: { plan?: unknown; name?: unknown; document?: unknown; phone?: unknown } }>('/billing/pix', async (request, reply) => {
    const session = await activeSession(request); if (!session) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    if (!mutationAllowed(request, session)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    if (!billingRoasReady || !billingRoasCredentials) return reply.code(503).send(failure(request, 'ROAS_NOT_CONFIGURED', 'A cobrança por Pix ainda não foi configurada.'));
    const plan = typeof request.body?.plan === 'string' && request.body.plan in plans ? request.body.plan as BillingPlan : null;
    const name = typeof request.body?.name === 'string' ? request.body.name.trim().replace(/\s+/g, ' ') : '';
    const document = typeof request.body?.document === 'string' ? request.body.document.replace(/\D/g, '') : '';
    const phoneDigits = typeof request.body?.phone === 'string' ? request.body.phone.replace(/\D/g, '') : '';
    if (!plan) return reply.code(400).send(failure(request, 'INVALID_PLAN', 'Escolha um plano válido.'));
    if (name.length < 3 || ![11, 14].includes(document.length) || phoneDigits.length < 10 || phoneDigits.length > 13) return reply.code(400).send(failure(request, 'INVALID_CUSTOMER', 'Informe nome, CPF/CNPJ e celular válidos.'));
    const current = await ensureSubscription(session.userId);
    if (current.stripeSubscriptionId && !['CANCELED', 'INCOMPLETE'].includes(current.status)) return reply.code(409).send(failure(request, 'CARD_SUBSCRIPTION_ACTIVE', 'Cancele a assinatura no cartão antes de mudar para Pix.'));
    const usage = await db.billingLedgerEntry.aggregate({ where: { userId: session.userId, billedAt: null }, _sum: { amountCents: true } });
    const usageAmountCents = usage._sum.amountCents ?? 0;
    const monthlyAmountCents = plans[plan].monthlyPriceCents;
    const totalAmountCents = monthlyAmountCents + usageAmountCents;
    if (totalAmountCents === 0) {
      const now = new Date(); const periodEnd = new Date(now.getTime() + 30 * 86_400_000);
      await db.billingSubscription.update({ where: { userId: session.userId }, data: { plan, status: 'ACTIVE', monthlyPriceCents: monthlyAmountCents, feeBasisPoints: plans[plan].feeBasisPoints, paymentProvider: 'ROAS', currentPeriodStart: now, currentPeriodEnd: periodEnd, blockedAt: null, graceUntil: null } });
      return reply.send({ activated: true });
    }
    const existing = await db.billingPixInvoice.findFirst({ where: { userId: session.userId, plan, status: 'PENDING', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    if (existing) return reply.send({ invoiceId: existing.publicId, status: existing.status, amountCents: existing.totalAmountCents, pixCode: decryptSecret(existing.pixCodeEncrypted, environment.APP_ENCRYPTION_KEY!), expiresAt: existing.expiresAt });
    const items = [
      ...(monthlyAmountCents ? [{ title: `Plano SOLID ${plans[plan].name} - 30 dias`, unit_price: monthlyAmountCents, quantity: 1 }] : []),
      ...(usageAmountCents ? [{ title: 'Tarifas SOLID sobre vendas confirmadas', unit_price: usageAmountCents, quantity: 1 }] : []),
    ];
    const transaction = await createRoasPix(billingRoasCredentials, {
      payment_method: 'pix',
      customer: { document: { type: document.length === 14 ? 'cnpj' : 'cpf', number: document }, name, email: session.user.email, phone: phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}` },
      items, amount: totalAmountCents, pix: { expires_in_days: 3 },
      postback_url: `${environment.API_PUBLIC_URL!.replace(/\/$/, '')}/webhooks/roas/billing`,
      metadata: { provider_name: 'SOLID Billing', solid_user_id: session.userId, solid_plan: plan },
    });
    if (!transaction.pixCode) return reply.code(502).send(failure(request, 'PIX_INCOMPLETE', 'A Roas não retornou o código Pix.'));
    const expiresAt = transaction.expiresAt ? new Date(transaction.expiresAt) : new Date(Date.now() + 3 * 86_400_000);
    const invoice = await db.billingPixInvoice.create({ data: { userId: session.userId, plan, providerTransactionId: transaction.id, monthlyAmountCents, usageAmountCents, totalAmountCents, pixCodeEncrypted: encryptSecret(transaction.pixCode, environment.APP_ENCRYPTION_KEY!), expiresAt } });
    return reply.code(201).send({ invoiceId: invoice.publicId, status: invoice.status, amountCents: totalAmountCents, pixCode: transaction.pixCode, expiresAt });
  });

  app.get<{ Params: { invoiceId: string } }>('/billing/pix/:invoiceId', async (request, reply) => {
    const session = await activeSession(request); if (!session) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const invoice = await db.billingPixInvoice.findFirst({ where: { publicId: request.params.invoiceId, userId: session.userId } });
    if (!invoice) return reply.code(404).send(failure(request, 'PIX_NOT_FOUND', 'Cobrança Pix não encontrada.'));
    return reply.header('cache-control', 'private, no-store').send({ invoiceId: invoice.publicId, status: invoice.status, amountCents: invoice.totalAmountCents, pixCode: invoice.status === 'PENDING' ? decryptSecret(invoice.pixCodeEncrypted, environment.APP_ENCRYPTION_KEY!) : undefined, expiresAt: invoice.expiresAt, paidAt: invoice.paidAt });
  });

  app.post<{ Body: Record<string, unknown> }>('/webhooks/roas/billing', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!billingRoasCredentials) return reply.code(503).send({ received: false });
    const body = request.body ?? {}; const nested = typeof body.data === 'object' && body.data ? body.data as Record<string, unknown> : body;
    const rawId = nested.Id ?? nested.id ?? nested.transaction_id ?? nested.transactionId;
    if (typeof rawId !== 'string' && typeof rawId !== 'number') return reply.code(400).send({ received: false });
    const invoice = await db.billingPixInvoice.findUnique({ where: { providerTransactionId: String(rawId) } });
    if (!invoice || invoice.status === 'PAID') return reply.send({ received: true });
    const verified = await getRoasPix(billingRoasCredentials, String(rawId));
    const status = verified?.status.toUpperCase();
    if (status === 'PAID') await activatePixPlan(invoice);
    else if (status === 'EXPIRED') await db.billingPixInvoice.update({ where: { id: invoice.id }, data: { status: 'EXPIRED' } });
    else if (status === 'ERROR' || status === 'REFUSED') await db.billingPixInvoice.update({ where: { id: invoice.id }, data: { status: 'FAILED' } });
    return reply.send({ received: true });
  });

  app.post<{ Body: { plan?: unknown } }>('/billing/checkout', async (request, reply) => {
    const session = await activeSession(request); if (!session) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    if (!mutationAllowed(request, session)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    if (!stripeReady || !stripe) return reply.code(503).send(failure(request, 'STRIPE_NOT_CONFIGURED', 'A cobrança por cartão ainda não foi configurada.'));
    const plan = typeof request.body?.plan === 'string' && request.body.plan in plans ? request.body.plan as BillingPlan : null;
    if (!plan) return reply.code(400).send(failure(request, 'INVALID_PLAN', 'Escolha um plano válido.'));
    const current = await ensureSubscription(session.userId);
    if (current.stripeSubscriptionId && current.stripeCustomerId) {
      const portal = await stripe.billingPortal.sessions.create({ customer: current.stripeCustomerId, locale: 'pt-BR', return_url: `${environment.APP_URL!.replace(/\/$/, '')}/?billing=return` });
      return reply.send({ url: portal.url });
    }
    let customerId = current.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: session.user.email, name: session.user.name, metadata: { solid_user_id: session.userId } }, { idempotencyKey: `solid-customer-${session.userId}` });
      customerId = customer.id;
      await db.billingSubscription.update({ where: { userId: session.userId }, data: { stripeCustomerId: customerId } });
    }
    const price = plan === 'START' ? environment.STRIPE_PRICE_START! : plan === 'PRIME' ? environment.STRIPE_PRICE_PRIME! : environment.STRIPE_PRICE_ELITE!;
    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription', customer: customerId, line_items: [{ price, quantity: 1 }],
      locale: 'pt-BR',
      payment_method_collection: 'always',
      success_url: `${environment.APP_URL!.replace(/\/$/, '')}/?billing=success`, cancel_url: `${environment.APP_URL!.replace(/\/$/, '')}/?billing=cancelled`,
      allow_promotion_codes: false, billing_address_collection: 'required',
      subscription_data: { metadata: { solid_user_id: session.userId, solid_plan: plan } },
      metadata: { solid_user_id: session.userId, solid_plan: plan },
    });
    return reply.send({ url: checkout.url });
  });

  app.post('/billing/portal', async (request, reply) => {
    const session = await activeSession(request); if (!session) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    if (!mutationAllowed(request, session)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    if (!stripeReady || !stripe) return reply.code(503).send(failure(request, 'STRIPE_NOT_CONFIGURED', 'A cobrança por cartão ainda não foi configurada.'));
    const subscription = await ensureSubscription(session.userId);
    if (!subscription.stripeCustomerId) return reply.code(409).send(failure(request, 'CARD_NOT_CONFIGURED', 'Cadastre um cartão escolhendo um plano.'));
    const portal = await stripe.billingPortal.sessions.create({ customer: subscription.stripeCustomerId, locale: 'pt-BR', return_url: `${environment.APP_URL!.replace(/\/$/, '')}/?billing=return` });
    return reply.send({ url: portal.url });
  });

  app.post('/webhooks/stripe', { config: { rawBody: true, rateLimit: false } }, async (request, reply) => {
    if (!stripe || !environment.STRIPE_WEBHOOK_SECRET) return reply.code(503).send({ received: false });
    const signature = request.headers['stripe-signature'];
    if (typeof signature !== 'string' || !request.rawBody) return reply.code(400).send({ received: false });
    let event: Stripe.Event;
    try { event = stripe.webhooks.constructEvent(request.rawBody, signature, environment.STRIPE_WEBHOOK_SECRET); }
    catch { return reply.code(400).send({ received: false }); }

    if (event.type === 'checkout.session.completed') {
      const checkout = event.data.object; const userId = checkout.metadata?.solid_user_id; const plan = checkout.metadata?.solid_plan as BillingPlan | undefined;
      const subscriptionId = typeof checkout.subscription === 'string' ? checkout.subscription : checkout.subscription?.id;
      const customerId = typeof checkout.customer === 'string' ? checkout.customer : checkout.customer?.id;
      if (userId && plan && plan in plans && subscriptionId && customerId) await db.billingSubscription.upsert({ where: { userId }, create: { userId, plan, status: 'ACTIVE', monthlyPriceCents: plans[plan].monthlyPriceCents, feeBasisPoints: plans[plan].feeBasisPoints, paymentProvider: 'STRIPE', stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId }, update: { plan, status: 'ACTIVE', monthlyPriceCents: plans[plan].monthlyPriceCents, feeBasisPoints: plans[plan].feeBasisPoints, paymentProvider: 'STRIPE', stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId, blockedAt: null, graceUntil: null, canceledAt: null } });
    }
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const object = event.data.object; const plan = planFromSubscription(object);
      await db.billingSubscription.updateMany({ where: { stripeSubscriptionId: object.id }, data: { status: statusFromStripe(object.status), ...(plan && plan in plans ? { plan, monthlyPriceCents: plans[plan].monthlyPriceCents, feeBasisPoints: plans[plan].feeBasisPoints } : {}), ...(object.status === 'canceled' ? { canceledAt: new Date() } : {}) } });
    }
    if (event.type === 'invoice.created') {
      const invoice = event.data.object; const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (customerId && invoice.id && invoice.billing_reason === 'subscription_cycle') {
        const subscription = await db.billingSubscription.findUnique({ where: { stripeCustomerId: customerId } });
        if (subscription) {
          const pendingWhere = { userId: subscription.userId, billedAt: null, stripeInvoiceId: null } as const;
          const total = await db.billingLedgerEntry.aggregate({ where: pendingWhere, _sum: { amountCents: true } });
          const amount = total._sum.amountCents ?? 0;
          if (amount !== 0) {
            await stripe.invoiceItems.create({ customer: customerId, invoice: invoice.id, currency: 'brl', amount, description: `Tarifa SOLID sobre vendas (${(subscription.feeBasisPoints / 100).toLocaleString('pt-BR')}%)` }, { idempotencyKey: `solid-usage-${invoice.id}` });
            await db.billingLedgerEntry.updateMany({ where: pendingWhere, data: { stripeInvoiceId: invoice.id } });
          }
        }
      }
    }
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object; const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (customerId) { const now = new Date(); const period = invoice.lines.data[0]?.period; const subscription = await db.billingSubscription.update({ where: { stripeCustomerId: customerId }, data: { status: 'ACTIVE', blockedAt: null, graceUntil: null, ...(period ? { currentPeriodStart: new Date(period.start * 1000), currentPeriodEnd: new Date(period.end * 1000) } : {}) } }).catch(() => null); if (subscription) await db.billingLedgerEntry.updateMany({ where: { userId: subscription.userId, stripeInvoiceId: invoice.id }, data: { billedAt: now } }); }
    }
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object; const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (customerId) await db.billingSubscription.updateMany({ where: { stripeCustomerId: customerId, graceUntil: null }, data: { status: 'PAST_DUE', graceUntil: new Date(Date.now() + 3 * 86_400_000) } });
    }
    return reply.send({ received: true });
  });
}
