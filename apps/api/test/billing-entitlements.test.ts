import { describe, expect, it } from 'vitest';
import { effectiveBilling } from '../src/billing-entitlements.js';

const base = {
  plan: 'START' as const,
  monthlyPriceCents: 0,
  feeBasisPoints: 200,
  adminPlanOverride: null,
  adminFeeBasisPoints: null,
  adminMonthlyWaived: false,
  adminOverrideExpiresAt: null,
  adminOverrideReason: null,
};

describe('effectiveBilling', () => {
  it('mantém o plano padrão sem benefício administrativo', () => {
    expect(effectiveBilling(base)).toMatchObject({ plan: 'START', feeBasisPoints: 200, monthlyPriceCents: 0, sponsored: false });
  });

  it('aplica plano, taxa e isenção enquanto o benefício está ativo', () => {
    const result = effectiveBilling({
      ...base,
      plan: 'PRIME',
      monthlyPriceCents: 14_700,
      feeBasisPoints: 150,
      adminPlanOverride: 'ELITE',
      adminFeeBasisPoints: 0,
      adminMonthlyWaived: true,
      adminOverrideExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      adminOverrideReason: 'Parceria com influenciador',
    }, new Date('2026-08-28T12:00:00.000Z'));

    expect(result).toMatchObject({ plan: 'ELITE', feeBasisPoints: 0, monthlyPriceCents: 0, sponsored: true, monthlyWaived: true });
  });

  it('ignora benefício expirado', () => {
    const result = effectiveBilling({
      ...base,
      adminPlanOverride: 'ELITE',
      adminFeeBasisPoints: 0,
      adminMonthlyWaived: true,
      adminOverrideExpiresAt: new Date('2026-08-01T00:00:00.000Z'),
    }, new Date('2026-08-28T12:00:00.000Z'));

    expect(result).toMatchObject({ plan: 'START', feeBasisPoints: 200, monthlyPriceCents: 0, sponsored: false, monthlyWaived: false });
  });
});
