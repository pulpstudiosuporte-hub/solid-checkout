import { describe, expect, it } from 'vitest';
import { dashboardRange } from '../src/dashboard-period.js';

describe('dashboard periods in Brasilia time', () => {
  const now = new Date('2026-09-11T01:30:00.000Z');
  it('keeps preset boundaries in the merchant timezone', () => {
    expect(dashboardRange({ period: 'today' }, now).start.toISOString()).toBe('2026-09-10T03:00:00.000Z');
    expect(dashboardRange({ period: 'yesterday' }, now).end.toISOString()).toBe('2026-09-10T02:59:59.999Z');
    expect(dashboardRange({ period: '7d' }, now).start.toISOString()).toBe('2026-09-04T03:00:00.000Z');
    expect(dashboardRange({ period: 'year' }, now).start.toISOString()).toBe('2026-01-01T03:00:00.000Z');
  });
  it('includes the entire last day and clamps today to now', () => {
    expect(dashboardRange({ period: 'custom', from: '2024-02-29', to: '2024-03-01' }, now)).toEqual({ start: new Date('2024-02-29T03:00:00Z'), end: new Date('2024-03-02T02:59:59.999Z') });
    expect(dashboardRange({ period: 'custom', from: '2026-09-10', to: '2026-09-10' }, now).end).toEqual(now);
  });
  it('rejects impossible dates, reversed, future and unbounded ranges', () => {
    for (const [from, to] of [['2026-02-30', '2026-03-01'], ['2026-09-10', '2026-09-09'], ['2026-09-10', '2026-09-11'], ['2019-01-01', '2019-02-01'], ['2024-01-01', '2025-01-01'], ['', '2026-01-01']] as const) expect(() => dashboardRange({ period: 'custom', from, to }, now)).toThrow();
    expect(() => dashboardRange({ period: 'custom', from: '2024-01-01', to: '2024-12-31' }, now)).not.toThrow();
  });
});
