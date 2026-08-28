import {
  AuditActorType,
  BillingPlan,
  BillingSubscriptionStatus,
  createDatabaseClient,
} from '@solid/database';

const databaseUrl = process.env['DATABASE_URL'];
const confirmation = process.env['SOLID_STRIPE_LIVE_CONFIRM'];

if (!databaseUrl) throw new Error('DATABASE_URL é obrigatória');
if (confirmation !== 'PREPARE_STRIPE_LIVE') {
  throw new Error('Preparação recusada: defina SOLID_STRIPE_LIVE_CONFIRM=PREPARE_STRIPE_LIVE');
}

const database = createDatabaseClient(databaseUrl);
try {
  const now = new Date();
  const [subscriptions, pendingEntries] = await database.$transaction([
    database.billingSubscription.updateMany({
      where: {
        OR: [
          { stripeCustomerId: { not: null } },
          { stripeSubscriptionId: { not: null } },
        ],
      },
      data: {
        plan: BillingPlan.START,
        status: BillingSubscriptionStatus.INCOMPLETE,
        monthlyPriceCents: 0,
        feeBasisPoints: 200,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        graceUntil: null,
        blockedAt: null,
        canceledAt: null,
      },
    }),
    database.billingLedgerEntry.updateMany({
      where: { billedAt: null, occurredAt: { lt: now } },
      data: { billedAt: now, stripeInvoiceId: null },
    }),
  ]);

  await database.auditLog.create({
    data: {
      actorType: AuditActorType.SYSTEM,
      action: 'billing.stripe_live_prepared',
      targetType: 'billing_environment',
      metadata: {
        source: 'one_time_cli',
        subscriptionsUnlinked: subscriptions.count,
        historicalEntriesClosed: pendingEntries.count,
      },
    },
  });

  process.stdout.write(
    `Stripe produção preparada: ${subscriptions.count} assinatura(s) de teste desvinculada(s) e ${pendingEntries.count} lançamento(s) histórico(s) encerrado(s). Remova imediatamente SOLID_STRIPE_LIVE_CONFIRM do ambiente.\n`,
  );
} finally {
  await database.$disconnect();
}
