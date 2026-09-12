import type { Prisma } from '@solid/database';

export type DeliveryProvider = 'UTMIFY' | 'META' | 'SHOPIFY' | 'SOLID';

// Called inside the payment transaction: a committed payment always has its
// delivery jobs, even if the API restarts before returning the response.
export async function enqueuePaymentDeliveries(transaction: Prisma.TransactionClient, checkoutSessionId: string, phase: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'): Promise<void> {
  const session = await transaction.checkoutSession.findUniqueOrThrow({
    where: { id: checkoutSessionId },
    select: { source: true, checkout: { select: { storeId: true, store: { select: { gatewayConnections: { where: { active: true, OR: [{ provider: 'UTMIFY' }, { provider: 'META', apiKeyEncrypted: { not: '' } }] }, select: { provider: true } } } } } } }
  });
  const active = new Set(session.checkout.store.gatewayConnections.map(connection => connection.provider));
  const events: { provider: DeliveryProvider; event: string }[] = [];
  if (active.has('UTMIFY')) events.push({ provider: 'UTMIFY', event: phase === 'PENDING' ? 'waiting_payment' : phase === 'PAID' ? 'paid' : phase === 'REFUNDED' ? 'refunded' : 'refused' });
  if (active.has('META') && (phase === 'PENDING' || phase === 'PAID')) events.push({ provider: 'META', event: phase === 'PAID' ? 'Purchase' : 'AddPaymentInfo' });
  if (session.source === 'SHOPIFY' && (phase === 'PENDING' || phase === 'PAID')) events.push({ provider: 'SHOPIFY', event: phase === 'PAID' ? 'paid' : 'created' });
  if (phase === 'PENDING') events.push({ provider: 'SOLID', event: 'pix_created' });
  if (events.length) await transaction.integrationDeliveryJob.createMany({
    data: events.map(event => ({ ...event, storeId: session.checkout.storeId, checkoutSessionId, nextAttemptAt: new Date() })),
    skipDuplicates: true
  });
}
