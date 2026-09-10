import { describe, expect, it } from 'vitest';
import { dailySales } from '../src/dashboard-metrics.js';

describe('agregação diária do dashboard', () => {
  it('respeita a virada do dia em São Paulo, soma vendas e preenche dias vazios', () => {
    expect(dailySales([
      { paidAt: new Date('2026-09-10T02:59:59Z'), amountCents: 100 },
      { paidAt: new Date('2026-09-10T03:00:00Z'), amountCents: 200 },
      { paidAt: new Date('2026-09-10T12:00:00Z'), amountCents: 300 },
    ], new Date('2026-09-09T03:00:00Z'), 3)).toEqual([
      { date: '2026-09-09', revenueCents: 100, paidOrders: 1 },
      { date: '2026-09-10', revenueCents: 500, paidOrders: 2 },
      { date: '2026-09-11', revenueCents: 0, paidOrders: 0 },
    ]);
  });
});
