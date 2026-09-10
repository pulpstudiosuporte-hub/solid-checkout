const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

export function dailySales(paid: readonly { amountCents: number; paidAt: Date }[], start: Date, days: number) {
  const totals = new Map<string, { revenueCents: number; paidOrders: number }>();
  for (const sale of paid) {
    const date = dayFormatter.format(sale.paidAt);
    const bucket = totals.get(date) ?? { revenueCents: 0, paidOrders: 0 };
    bucket.revenueCents += sale.amountCents;
    bucket.paidOrders += 1;
    totals.set(date, bucket);
  }
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10);
    return { date, ...(totals.get(date) ?? { revenueCents: 0, paidOrders: 0 }) };
  });
}
