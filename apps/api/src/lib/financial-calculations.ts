import { z } from 'zod';
import type { OperationsRow, OperationsReport } from '../../../../packages/shared/src/financial.ts';
export const integer = z.number().int().safe();
const nonnegative = integer.nonnegative();
export const exchangeSchema = z.object({
  numerator: z.string().regex(/^[1-9]\d{0,15}$/),
  denominator: z.string().regex(/^[1-9]\d{0,15}$/),
  source: z.string().max(100),
  asOf: z.string().max(40),
});
const itemSchema = z.object({
  quantity: z.number().int().min(1).max(10),
  wholesaleUnits: nonnegative.optional(),
  plan: z.object({
    name: z.string().max(1000),
    countries: z.array(z.string().max(2)).max(250),
    priceCents: nonnegative,
    currency: z.enum(['USD', 'GBP', 'EUR']),
  }),
  exchange: exchangeSchema.optional(),
});
export const financialSourceSchema = z.object({
  createdAt: z.iso.datetime(),
  email: z.email().nullable().optional(),
  uid: z.string().nullable(),
  status: z.string().max(80),
  test: z.boolean(),
  paidAt: z.iso.datetime().optional(),
  totalCents: nonnegative.optional(),
  amountCents: nonnegative.optional(),
  currency: z.enum(['USD', 'GBP', 'EUR']),
  items: z.array(itemSchema).min(1).max(10).optional(),
  plan: itemSchema.shape.plan.optional(),
  wholesaleUnits: nonnegative.optional(),
  exchange: exchangeSchema.optional(),
  orderReference: z.string().max(100).optional(),
  supplierOrderNo: z.string().optional(),
  supplierRejected: z.boolean().optional(),
  supplierAttempted: z.boolean().optional(),
  paymentIntentId: z.string().optional(),
});
export function safeInteger(value: bigint): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('Financial amount outside supported range.');
  return n;
}
export function rounded(n: bigint, d: bigint): number {
  if (d <= 0n) throw new Error('Invalid financial divisor.');
  const sign = n < 0n ? -1n : 1n;
  return safeInteger(sign * ((sign * n + d / 2n) / d));
}
export function convert(value: number, rate: OperationsRow['usdGbp'], scale = 1): number | null {
  return rate
    ? rounded(BigInt(value) * BigInt(rate.numerator), BigInt(rate.denominator) * BigInt(scale))
    : null;
}
export function initialFinancial(
  id: string,
  source: OperationsRow['source'],
  raw: unknown,
  usdGbp: OperationsRow['usdGbp'] = null,
): OperationsRow {
  const p = financialSourceSchema.parse(raw);
  const items =
    p.items ??
    (p.plan
      ? [{ plan: p.plan, quantity: 1, wholesaleUnits: p.wholesaleUnits, exchange: p.exchange }]
      : []);
  if (!items.length) throw new Error('Missing historical purchased items.');
  const saleExchange = items[0].exchange ?? null;
  // A recorded GBP checkout conversion is an historical USD-to-GBP rate.
  const historical = usdGbp ?? (p.currency === 'GBP' ? saleExchange : null);
  const quoted = items.every((i) => i.wholesaleUnits !== undefined)
    ? safeInteger(
        items.reduce((sum, i) => sum + BigInt(i.wholesaleUnits!) * BigInt(i.quantity), 0n),
      )
    : null;
  const amount = p.totalCents ?? p.amountCents;
  if (amount === undefined) throw new Error('Missing historical amount.');
  if (
    items.some((i) => i.plan.currency !== p.currency) ||
    items.reduce((sum, i) => sum + BigInt(i.plan.priceCents) * BigInt(i.quantity), 0n) !==
      BigInt(amount)
  )
    throw new Error('Historical amount or currency mismatch.');
  const row: OperationsRow = {
    id,
    source,
    createdAt: p.createdAt,
    reference: p.orderReference ?? id,
    email: p.email ?? null,
    customerId: p.uid,
    paid: Boolean(p.paidAt),
    paymentStatus: p.status,
    fulfilmentStatus: 'pending',
    packages: items.map((i) => ({
      name: i.plan.name,
      countries: i.plan.countries,
      quantity: i.quantity,
    })),
    selling: {
      currency: p.currency,
      amountMinor: amount,
      refundedMinor: p.paidAt ? null : 0,
      discountMinor: 0,
    },
    supplier: { currency: 'USD', scale: 10000, quotedUnits: quoted, purchasedUnits: null },
    stripe: {
      currency: null,
      feeMinor: null,
      balanceTransactions: [],
      exchangeRates: [],
      observedAt: null,
      revenueGbp: null,
      feesGbp: null,
      refundsPending: false,
    },
    usdGbp: historical,
    saleExchange,
    revenueGbp: null,
    supplierGbp: null,
    feesGbp: null,
    grossProfitGbp: null,
    profitGbp: null,
    marginBps: null,
    calculationStatus: 'pending',
    reasons: [],
    updatedAt: new Date().toISOString(),
  };
  return calculateFinancial(row);
}
export function calculateFinancial(input: OperationsRow): OperationsRow {
  const r = structuredClone(input);
  const reasons: string[] = [];
  if (r.paid && !r.stripe.observedAt) r.selling.refundedMinor = null;
  const net =
    r.selling.refundedMinor === null ? null : r.selling.amountMinor - r.selling.refundedMinor;
  if (r.paid && net === null) reasons.push('Stripe refund totals have not yet been reconciled');
  if (!r.paid) {
    r.revenueGbp = 0;
    r.feesGbp = 0;
    reasons.push('Payment not confirmed');
  } else {
    r.revenueGbp = r.stripe.revenueGbp;
    if (r.revenueGbp === null) {
      if (net === null) r.revenueGbp = null;
      else if (r.selling.currency === 'GBP') r.revenueGbp = net;
      else if (r.selling.currency === 'USD') r.revenueGbp = convert(net, r.usdGbp);
      else if (r.usdGbp && r.saleExchange)
        r.revenueGbp = rounded(
          BigInt(net) * BigInt(r.saleExchange.denominator) * BigInt(r.usdGbp.numerator),
          BigInt(r.saleExchange.numerator) * BigInt(r.usdGbp.denominator),
        );
      reasons.push('GBP settlement pending; any revenue shown uses the frozen reference rate');
    }
    r.feesGbp = r.stripe.feesGbp;
    if (r.feesGbp === null) reasons.push('Actual GBP Stripe fees pending');
  }
  r.supplierGbp =
    r.supplier.purchasedUnits === 0
      ? 0
      : r.supplier.purchasedUnits === null
        ? null
        : convert(r.supplier.purchasedUnits, r.usdGbp, 100);
  if (r.supplier.purchasedUnits === null)
    reasons.push('Supplier purchase outcome pending or unknown');
  else if (r.supplierGbp === null) reasons.push('Historical supplier GBP valuation unavailable');
  if (r.stripe.refundsPending) reasons.push('Refund or dispute settlement pending');
  if (r.fulfilmentStatus === 'needs_attention')
    reasons.push('Fulfilment outcome or refund requires review');
  r.grossProfitGbp =
    r.revenueGbp !== null && r.supplierGbp !== null
      ? safeInteger(BigInt(r.revenueGbp) - BigInt(r.supplierGbp))
      : null;
  r.profitGbp =
    r.grossProfitGbp !== null && r.feesGbp !== null
      ? safeInteger(BigInt(r.grossProfitGbp) - BigInt(r.feesGbp))
      : null;
  r.marginBps =
    r.profitGbp !== null && r.revenueGbp !== null && r.revenueGbp > 0
      ? rounded(BigInt(r.profitGbp) * 10000n, BigInt(r.revenueGbp))
      : null;
  r.reasons = reasons;
  r.calculationStatus = reasons.length ? 'pending' : 'final';
  r.updatedAt = new Date().toISOString();
  return r;
}
export function summarize(rows: OperationsRow[]): OperationsReport['summary'] {
  const paid = rows.filter((r) => r.paid);
  const sum = (key: 'revenueGbp' | 'supplierGbp' | 'feesGbp' | 'profitGbp') =>
    paid.some((r) => r[key] === null)
      ? null
      : safeInteger(paid.reduce((n, r) => n + BigInt(r[key]!), 0n));
  const revenueGbp = sum('revenueGbp'),
    profitGbp = sum('profitGbp');
  return {
    sales: paid.length,
    revenueGbp,
    supplierGbp: sum('supplierGbp'),
    feesGbp: sum('feesGbp'),
    profitGbp,
    marginBps:
      revenueGbp !== null && revenueGbp > 0 && profitGbp !== null
        ? rounded(BigInt(profitGbp) * 10000n, BigInt(revenueGbp))
        : null,
    provisional: paid.filter((r) => r.calculationStatus === 'pending').length,
    records: rows.length,
  };
}
export function londonBounds(from: string, to: string) {
  const date = z.iso.date();
  date.parse(from);
  date.parse(to);
  if (from > to) throw new Error('From date must precede To date.');
  const midnight = (day: string) => {
    let value = Date.parse(day + 'T00:00:00Z');
    for (let i = 0; i < 3; i++) {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(value);
      const g = (key: string) => parts.find((p) => p.type === key)!.value;
      const local = Date.parse(
        `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:${g('second')}Z`,
      );
      value += Date.parse(day + 'T00:00:00Z') - local;
    }
    return new Date(value).toISOString();
  };
  const next = new Date(Date.parse(to + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
  return { start: midnight(from), end: midnight(next) };
}
export const financialSchema: z.ZodType<OperationsRow> = z.object({
  id: z.string().max(100),
  source: z.enum(['purchases', 'orders']),
  createdAt: z.iso.datetime(),
  reference: z.string().max(100),
  email: z.email().nullable(),
  customerId: z.string().nullable(),
  paid: z.boolean(),
  paymentStatus: z.string().max(80),
  fulfilmentStatus: z.string().max(80),
  packages: z
    .array(
      z.object({
        name: z.string().max(1000),
        countries: z.array(z.string().max(2)).max(250),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .max(10),
  selling: z.object({
    currency: z.enum(['USD', 'GBP', 'EUR']),
    amountMinor: nonnegative,
    refundedMinor: nonnegative.nullable(),
    discountMinor: nonnegative,
  }),
  supplier: z.object({
    currency: z.literal('USD'),
    scale: z.literal(10000),
    quotedUnits: nonnegative.nullable(),
    purchasedUnits: nonnegative.nullable(),
  }),
  stripe: z.object({
    currency: z.string().nullable(),
    feeMinor: integer.nullable(),
    balanceTransactions: z.array(z.string()).max(10001),
    exchangeRates: z.array(z.number().positive().nullable()).max(10001),
    observedAt: z.iso.datetime().nullable(),
    revenueGbp: integer.nullable(),
    feesGbp: integer.nullable(),
    refundsPending: z.boolean(),
  }),
  usdGbp: exchangeSchema.nullable(),
  saleExchange: exchangeSchema.nullable(),
  revenueGbp: integer.nullable(),
  supplierGbp: integer.nullable(),
  feesGbp: integer.nullable(),
  grossProfitGbp: integer.nullable(),
  profitGbp: integer.nullable(),
  marginBps: integer.nullable(),
  calculationStatus: z.enum(['pending', 'final']),
  reasons: z.array(z.string()),
  updatedAt: z.iso.datetime(),
});
