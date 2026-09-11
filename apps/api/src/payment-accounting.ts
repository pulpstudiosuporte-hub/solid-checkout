import type { Prisma } from '@solid/database';

// Caller holds the payment row lock. Credits are append-only, including after invoicing.
export async function creditRefundFee(tx: Prisma.TransactionClient, attemptId: string, amountCents: number, refundedCents: number, previousRefundCents: number): Promise<void> {
  const fee = await tx.billingLedgerEntry.findUnique({ where: { paymentAttemptId_type_sequence: { paymentAttemptId: attemptId, type: 'TRANSACTION_FEE', sequence: 0 } } });
  if (!fee || amountCents <= 0) return;
  const credited = await tx.billingLedgerEntry.aggregate({ where: { paymentAttemptId: attemptId, type: 'REFUND_CREDIT' }, _sum: { amountCents: true } });
  const target = Math.min(fee.amountCents, Math.round(fee.amountCents * refundedCents / amountCents));
  const delta = Math.max(0, target + (credited._sum.amountCents ?? 0));
  if (!delta) return;
  await tx.billingLedgerEntry.create({ data: { userId: fee.userId, paymentAttemptId: attemptId, type: 'REFUND_CREDIT', sequence: refundedCents, grossAmountCents: Math.max(0, refundedCents - previousRefundCents), feeBasisPoints: fee.feeBasisPoints, amountCents: -delta, occurredAt: new Date() } });
}
