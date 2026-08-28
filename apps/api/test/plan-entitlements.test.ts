import { describe, expect, it } from 'vitest';
import { planLimits } from '../src/plan-entitlements.js';

describe('planLimits', () => {
  it('applies Start limits when no subscription exists yet', () => {
    expect(planLimits(undefined)).toEqual({ stores: 1, checkoutsPerStore: 1 });
  });

  it('expands creation limits by plan', () => {
    expect(planLimits('PRIME')).toEqual({ stores: 5, checkoutsPerStore: 5 });
    expect(planLimits('ELITE')).toEqual({ stores: 20, checkoutsPerStore: 20 });
  });
});
