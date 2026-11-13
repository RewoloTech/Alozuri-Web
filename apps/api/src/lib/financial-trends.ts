import type { OperationsRow, OperationsTrends } from '../../../../packages/shared/src/financial.ts';
import { londonDate } from '../../../../packages/shared/src/financial.ts';
import { londonBounds, safeInteger } from './financial-calculations.js';

/** Same original-order cohort and refund-adjusted figures as Financial Overview. */
export function financialTrends(rows: OperationsRow[], from: string, to: string): OperationsTrends {
  londonBounds(from, to);
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  const grain = days <= 31 ? 'day' : days <= 124 ? 'week' : days <= 3653 ? 'month' : 'year';
  const firstYear = Number(from.slice(0, 4));
  const step =
    grain === 'year' ? Math.max(1, Math.ceil((Number(to.slice(0, 4)) - firstYear + 1) / 120)) : 1;
  const key = (day: string) => {
    if (grain === 'day') return day;
    if (grain === 'month') return day.slice(0, 7) + '-01';
    if (grain === 'year')
      return (
        String(
          firstYear + Math.floor((Number(day.slice(0, 4)) - firstYear) / step) * step,
        ).padStart(4, '0') + '-01-01'
      );
    const d = new Date(day + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const buckets = new Map<string, OperationsTrends['points'][number]>();
  const end = key(to);
  let at = key(from);
  for (let i = 0; i < 130; i++) {
    buckets.set(at, {
      periodStart: at,
      orders: 0,
      revenueGbp: 0,
      profitGbp: 0,
      revenueProvisional: false,
      profitProvisional: false,
    });
    if (at === end) break;
    const date = new Date(at + 'T00:00:00Z');
    if (grain === 'year') date.setUTCFullYear(date.getUTCFullYear() + step);
    else if (grain === 'month') date.setUTCMonth(date.getUTCMonth() + 1);
    else date.setUTCDate(date.getUTCDate() + (grain === 'week' ? 7 : 1));
    at = date.toISOString().slice(0, 10);
  }
  const plans = new Map<string, OperationsTrends['topPlans'][number]>();
  const sum = (a: number | null, b: number | null) =>
    a === null || b === null ? null : safeInteger(BigInt(a) + BigInt(b));
  for (const row of rows) {
    if (!row.paid) continue;
    const date = londonDate(new Date(row.createdAt));
    if (date < from || date > to) continue;
    const point = buckets.get(key(date));
    if (!point) throw new Error('Financial trend period outside supported range.');
    point.orders++;
    point.revenueGbp = sum(point.revenueGbp, row.revenueGbp);
    point.profitGbp = sum(point.profitGbp, row.profitGbp);
    point.revenueProvisional ||= row.stripe.revenueGbp === null || row.stripe.refundsPending;
    point.profitProvisional ||= row.calculationStatus !== 'final';
    for (const plan of row.packages) {
      const countries = [...new Set(plan.countries)].sort();
      const id = JSON.stringify([plan.name, countries]);
      const current = plans.get(id) ?? { name: plan.name, countries, quantity: 0 };
      current.quantity = safeInteger(BigInt(current.quantity) + BigInt(plan.quantity));
      plans.set(id, current);
    }
  }
  const ranked = [...plans.values()].sort(
    (a, b) =>
      b.quantity - a.quantity ||
      a.name.localeCompare(b.name) ||
      a.countries.join(',').localeCompare(b.countries.join(',')),
  );
  return {
    grain,
    step,
    points: [...buckets.values()],
    topPlans: ranked.slice(0, 8),
    otherPlanQuantity: ranked
      .slice(8)
      .reduce((n, p) => safeInteger(BigInt(n) + BigInt(p.quantity)), 0),
  };
}
