import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import type { Currency, Plan } from '../../../../packages/shared/src/index.ts';
import { database } from './firebase.js';
import { catalogueDate } from './package-pricing.js';
import { checkedMoney, ceilDiv, moneyInteger, roundRetailUp } from './pricing.js';

export const MINIMUM_CHARGE_MINOR: Record<Currency, number> = { USD: 50, GBP: 30, EUR: 50 };
export const currencySchema = z.enum(['USD', 'GBP', 'EUR']);
const rational = z.object({
  numerator: z.string().regex(/^[1-9]\d{0,15}$/),
  denominator: z.string().regex(/^[1-9]\d{0,15}$/),
});
export const fxSchema = z.object({
  source: z.literal('frankfurter-ecb'),
  asOf: z.iso.date(),
  fetchedAt: z.iso.datetime(),
  rates: z.object({ GBP: rational, EUR: rational }),
});
export type FxRates = z.infer<typeof fxSchema>;
export type PriceExchange = {
  source: string;
  asOf: string;
  fetchedAt: string;
  numerator: string;
  denominator: string;
};
export function usableRates(value: unknown, now = Date.now()): FxRates | null {
  const parsed = fxSchema.safeParse(value);
  if (!parsed.success) return null;
  const age = now - Date.parse(parsed.data.asOf);
  if (age < 0 || age > 7 * 86400000 || Date.parse(parsed.data.fetchedAt) > now) return null;
  for (const r of Object.values(parsed.data.rates)) {
    const n = BigInt(r.numerator),
      d = BigInt(r.denominator);
    if (n * 100n < d || n > d * 100n) return null;
  }
  return parsed.data;
}
export async function fetchEcbRates(now = Date.now()): Promise<FxRates> {
  const response = await fetch(
    'https://api.frankfurter.dev/v2/providers/ecb/rates?base=USD&quotes=GBP,EUR',
    { signal: AbortSignal.timeout(8000) },
  );
  if (!response.ok) throw new Error('Exchange rates unavailable.');
  const text = await response.text();
  if (text.length > 32000) throw new Error('Invalid exchange rates.');
  // Keep decimal rates as strings BEFORE JSON parsing, so conversion never multiplies floats.
  const rows = z
    .array(
      z.object({
        date: z.iso.date(),
        base: z.literal('USD'),
        quote: z.enum(['GBP', 'EUR']),
        rate: z.string().regex(/^\d+(?:\.\d{1,12})?$/),
      }),
    )
    .length(2)
    .parse(JSON.parse(text.replace(/("rate"\s*:\s*)(\d+(?:\.\d+)?)/g, '$1"$2"')));
  if (new Set(rows.map((r) => r.quote)).size !== 2 || rows[0].date !== rows[1].date)
    throw new Error('Incomplete exchange rates.');
  const convert = (quote: 'GBP' | 'EUR') => {
    const row = rows.find((r) => r.quote === quote)!;
    const [whole, fraction = ''] = row.rate.split('.');
    return {
      numerator: BigInt(whole + fraction).toString(),
      denominator: (10n ** BigInt(fraction.length)).toString(),
    };
  };
  const rates = usableRates(
    {
      source: 'frankfurter-ecb',
      asOf: rows[0].date,
      fetchedAt: new Date(now).toISOString(),
      rates: { GBP: convert('GBP'), EUR: convert('EUR') },
    },
    now,
  );
  if (!rates) throw new Error('Exchange rates are stale or invalid.');
  return rates;
}
export class ExchangeRates {
  private cached: FxRates | null = null;
  private expires = 0;
  private pending: Promise<FxRates> | null = null;
  constructor(
    private db?: Firestore,
    private fetchRates = fetchEcbRates,
    private now = Date.now,
  ) {}
  async current(): Promise<FxRates> {
    if (this.cached && this.now() < this.expires && usableRates(this.cached, this.now()))
      return this.cached;
    if (this.pending) return this.pending;
    this.pending = this.refresh().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
  private async refresh() {
    const now = this.now(),
      ref = (this.db ?? database()).doc('exchangeRates/USD');
    const stored = usableRates((await ref.get()).data(), now);
    if (stored && now - Date.parse(stored.fetchedAt) < 3600000) {
      this.cached = stored;
      this.expires = Date.parse(stored.fetchedAt) + 3600000;
      return stored;
    }
    try {
      const rates = usableRates(await this.fetchRates(now), now);
      if (!rates) throw new Error('Invalid exchange rates.');
      await ref.set(rates);
      this.cached = rates;
      this.expires = now + 3600000;
      return rates;
    } catch {
      const fallback = stored || usableRates(this.cached, now);
      if (!fallback) throw new Error('Currency prices are temporarily unavailable. Try USD.');
      this.cached = fallback;
      this.expires = now + 60000;
      return fallback;
    }
  }
}
export function priceExchange(
  currency: Currency,
  rates?: FxRates,
  now = Date.now(),
): PriceExchange {
  if (currency === 'USD')
    return {
      source: 'USD',
      asOf: catalogueDate(now),
      fetchedAt: new Date(now).toISOString(),
      numerator: '1',
      denominator: '1',
    };
  if (!rates || !usableRates(rates, now)) throw new Error('Current exchange rates required.');
  return {
    source: rates.source,
    asOf: rates.asOf,
    fetchedAt: rates.fetchedAt,
    ...rates.rates[currency],
  };
}
export function convertPrice(cents: number, currency: Currency, exchange: PriceExchange): number {
  if (!moneyInteger(cents)) throw new Error('Invalid selling price.');
  if (currency === 'USD') return cents;
  if (exchange.source !== 'frankfurter-ecb')
    throw new Error('A verified exchange rate is required.');
  const n = BigInt(exchange.numerator),
    d = BigInt(exchange.denominator);
  if (n <= 0n || d <= 0n) throw new Error('Invalid exchange rate.');
  const minor = ceilDiv(BigInt(cents) * n, d),
    minimum = BigInt(MINIMUM_CHARGE_MINOR[currency]);
  return roundRetailUp(checkedMoney(minor > minimum ? minor : minimum));
}
export function convertedPlan(plan: Plan, currency: Currency, exchange: PriceExchange): Plan {
  if (plan.currency !== 'USD') throw new Error('Expected base USD catalogue.');
  return { ...plan, currency, priceCents: convertPrice(plan.priceCents, currency, exchange) };
}
