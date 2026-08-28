import type { BillingPlan } from '@solid/database';

export type PlanLimits = Readonly<{ stores: number; checkoutsPerStore: number; abandonedCartRetentionDays: number }>;

const limits: Record<BillingPlan, PlanLimits> = {
  START: { stores: 1, checkoutsPerStore: 1, abandonedCartRetentionDays: 30 },
  PRIME: { stores: 5, checkoutsPerStore: 5, abandonedCartRetentionDays: 90 },
  ELITE: { stores: 20, checkoutsPerStore: 20, abandonedCartRetentionDays: 180 },
};

export const planLimits = (plan: BillingPlan | null | undefined): PlanLimits => limits[plan ?? 'START'];
