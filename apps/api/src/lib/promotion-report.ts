import type { OperationsRow, OperationsReport } from '../../../../packages/shared/src/financial.ts';
import { londonDate } from '../../../../packages/shared/src/financial.ts';
import { safeInteger, summarize } from './financial-calculations.js';

/** Paid order cohort, frozen discounts and refund-adjusted financials; never current catalogue data. */
export function promotionReport(
  rows: OperationsRow[],
): NonNullable<OperationsReport['promotions']> {
  const groups = new Map<string, OperationsRow[]>();
  for (const row of rows) {
    if (!row.paid || !row.promotion) continue;
    const key = JSON.stringify([row.promotion.code, row.selling.currency]);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()]
    .map((orders) => {
      const summary = summarize(orders);
      const usage = new Map<string, number>();
      let revenue: bigint | null = 0n;
      for (const row of orders) {
        const day = londonDate(new Date(row.createdAt));
        usage.set(day, (usage.get(day) ?? 0) + 1);
        revenue =
          revenue === null || row.selling.refundedMinor === null
            ? null
            : revenue + BigInt(row.selling.amountMinor) - BigInt(row.selling.refundedMinor);
      }
      return {
        code: orders[0].promotion!.code,
        currency: orders[0].selling.currency,
        sales: orders.length,
        revenueMinor: revenue === null ? null : safeInteger(revenue),
        discountMinor: safeInteger(
          orders.reduce((sum, row) => sum + BigInt(row.selling.discountMinor), 0n),
        ),
        supplierGbp: summary.supplierGbp,
        feesGbp: summary.feesGbp,
        profitGbp: summary.profitGbp,
        provisional: summary.provisional,
        usage: [...usage.entries()]
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, sales]) => ({ date, sales })),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code) || a.currency.localeCompare(b.currency));
}
