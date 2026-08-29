import type { BillingPlan } from '@solid/database';

export type BillingOverrideSource = {
  plan: BillingPlan;
  monthlyPriceCents: number;
  feeBasisPoints: number;
  adminPlanOverride: BillingPlan | null;
  adminFeeBasisPoints: number | null;
  adminMonthlyWaived: boolean;
  adminOverrideExpiresAt: Date | null;
  adminOverrideReason: string | null;
};

export const activeBillingOverride = (subscription: BillingOverrideSource, now = new Date()): boolean =>
  Boolean(
    (subscription.adminPlanOverride || subscription.adminFeeBasisPoints !== null || subscription.adminMonthlyWaived) &&
    (!subscription.adminOverrideExpiresAt || subscription.adminOverrideExpiresAt > now),
  );

export function effectiveBilling(subscription: BillingOverrideSource, now = new Date()) {
  const sponsored = activeBillingOverride(subscription, now);
  return {
    plan: sponsored && subscription.adminPlanOverride ? subscription.adminPlanOverride : subscription.plan,
    feeBasisPoints: sponsored && subscription.adminFeeBasisPoints !== null ? subscription.adminFeeBasisPoints : subscription.feeBasisPoints,
    monthlyPriceCents: sponsored && subscription.adminMonthlyWaived ? 0 : subscription.monthlyPriceCents,
    sponsored,
    monthlyWaived: sponsored && subscription.adminMonthlyWaived,
    expiresAt: sponsored ? subscription.adminOverrideExpiresAt : null,
    reason: sponsored ? subscription.adminOverrideReason : null,
  };
}
