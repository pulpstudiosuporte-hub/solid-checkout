import type { BillingPlan } from '@solid/database';

export type PlanLimits = Readonly<{ stores: number; checkoutsPerStore: number }>;

const limits: Record<BillingPlan, PlanLimits> = {
  START: { stores: 1, checkoutsPerStore: 1 },
  PRIME: { stores: 5, checkoutsPerStore: 5 },
  ELITE: { stores: 20, checkoutsPerStore: 20 },
};

export const planLimits = (plan: BillingPlan | null | undefined): PlanLimits => limits[plan ?? 'START'];
