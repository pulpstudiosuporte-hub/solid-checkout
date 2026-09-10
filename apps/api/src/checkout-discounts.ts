export type PaymentDiscountRule = Readonly<{
  percentageBps: number;
  minimumAmountCents: number;
  maximumAmountCents: number | null;
}>;

export function paymentDiscountRule(value: unknown): PaymentDiscountRule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rule = value as Record<string, unknown>;
  const { percentageBps, minimumAmountCents, maximumAmountCents } = rule;
  if (typeof percentageBps !== 'number' || !Number.isInteger(percentageBps) || percentageBps < 1 || percentageBps > 10_000
    || typeof minimumAmountCents !== 'number' || !Number.isSafeInteger(minimumAmountCents) || minimumAmountCents < 0 || minimumAmountCents > 2_147_483_647
    || maximumAmountCents !== null && (typeof maximumAmountCents !== 'number' || !Number.isSafeInteger(maximumAmountCents) || maximumAmountCents < 1 || maximumAmountCents > 2_147_483_647)) return null;
  return { percentageBps, minimumAmountCents, maximumAmountCents };
}

// discountCents is the combined discount used by payments, orders and tracking.
// paymentDiscountCents is its Pix component, exposed separately in the summary.
export function checkoutDiscounts(subtotal: number, coupon: { type: 'PERCENT' | 'FIXED'; value: number; maxDiscountCents: number | null } | null, snapshot: unknown) {
  let couponCents = coupon ? coupon.type === 'PERCENT' ? Math.floor(subtotal * coupon.value / 10_000) : coupon.value : 0;
  if (coupon?.maxDiscountCents) couponCents = Math.min(couponCents, coupon.maxDiscountCents);
  couponCents = Math.max(0, Math.min(couponCents, subtotal - 1));
  const remaining = subtotal - couponCents;
  const rule = paymentDiscountRule(snapshot);
  let paymentDiscountCents = rule && remaining >= rule.minimumAmountCents ? Math.floor(remaining * rule.percentageBps / 10_000) : 0;
  if (rule?.maximumAmountCents) paymentDiscountCents = Math.min(paymentDiscountCents, rule.maximumAmountCents);
  paymentDiscountCents = Math.max(0, Math.min(paymentDiscountCents, remaining - 1));
  return { discountCents: couponCents + paymentDiscountCents, paymentDiscountCents };
}
