export type PaymentState = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';

export function mapProviderPaymentStatus(value: string | undefined): Exclude<PaymentState, 'PENDING'> | null {
  const status = value?.toUpperCase();
  if (['PAID', 'APPROVED', 'CONFIRMED', 'COMPLETED', 'SUCCESS', 'SUCCEEDED', 'SETTLED'].includes(status ?? '')) return 'PAID';
  if (['FAILED', 'ERROR', 'REFUSED'].includes(status ?? '')) return 'FAILED';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'EXPIRED') return 'EXPIRED';
  if (status === 'REFUNDED') return 'REFUNDED';
  return null;
}

// Alguns providers retornam centavos e outros retornam reais. Aceitamos somente
// uma das duas representações exatas, nunca aproximações de ponto flutuante.
export function providerAmountMatches(providerAmount: number | undefined, expectedCents: number): boolean {
  if (!Number.isFinite(providerAmount) || !Number.isSafeInteger(expectedCents) || expectedCents < 0) return false;
  const amount = Number(providerAmount);
  return Number.isSafeInteger(amount) && amount === expectedCents || Number.isSafeInteger(amount * 100) && amount * 100 === expectedCents;
}

export function canTransitionPayment(current: PaymentState, next: Exclude<PaymentState, 'PENDING'>): boolean {
  if (current === next || current === 'REFUNDED') return false;
  if (next === 'PAID') return true;
  if (current === 'PAID') return next === 'REFUNDED';
  return current === 'PENDING';
}
