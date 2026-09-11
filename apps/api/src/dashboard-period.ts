const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const DAY = 86_400_000;
export function dashboardRange(query: { period?: string; from?: string; to?: string }, now: Date) {
  const today = dayFormatter.format(now);
  const midnight = (value: string) => new Date(`${value}T03:00:00.000Z`);
  if (query.period === 'custom') {
    const valid = (value: unknown): value is string => typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value) && value >= '2020-01-01' && Number.isFinite(midnight(value).getTime()) && midnight(value).toISOString().slice(0, 10) === value;
    if (!valid(query.from) || !valid(query.to) || query.from > query.to || query.to > today) throw new Error('Escolha datas válidas entre 2020 e hoje, com início anterior ao fim.');
    const start = midnight(query.from);
    const lastDay = midnight(query.to);
    if (lastDay.getTime() - start.getTime() >= 366 * DAY) throw new Error('Selecione um intervalo de até 366 dias.');
    return { start, end: new Date(Math.min(now.getTime(), lastDay.getTime() + DAY - 1)) };
  }
  const period = ['today', 'yesterday', '7d', 'month', 'year'].includes(query.period || '') ? query.period : '7d';
  const start = midnight(period === 'year' ? `${today.slice(0, 4)}-01-01` : period === 'month' ? `${today.slice(0, 7)}-01` : today);
  if (period === '7d') start.setUTCDate(start.getUTCDate() - 6);
  if (period === 'yesterday') start.setUTCDate(start.getUTCDate() - 1);
  return { start, end: period === 'yesterday' ? new Date(start.getTime() + DAY - 1) : now };
}
