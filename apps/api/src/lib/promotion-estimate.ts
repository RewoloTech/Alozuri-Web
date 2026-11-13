import { z } from 'zod';
import { PRICING_POLICY, ceilDiv } from './pricing.js';

const integer = z.number().int().safe();
export const promotionEstimateSchema = z.object({
  currency: z.enum(['USD', 'GBP', 'EUR']),
  revenueMinor: integer.positive(),
  supplierMinor: integer.nonnegative(),
  feeMinor: integer.nonnegative(),
  contributionMinor: integer,
  marginBps: integer,
  basis: z.string(),
});
/** Frozen checkout estimate, before refunds; actual ledger figures remain authoritative. */
export function promotionEstimate(
  amount: number,
  currency: 'USD' | 'GBP' | 'EUR',
  supplierUnits: number,
  exchange: { numerator: string; denominator: string } | null,
) {
  if (currency !== 'USD' && !exchange) return null;
  const numerator = currency === 'USD' ? 1n : BigInt(exchange!.numerator);
  const denominator = currency === 'USD' ? 1n : BigInt(exchange!.denominator);
  if (numerator <= 0n || denominator <= 0n) throw new Error('Invalid promotion exchange rate.');
  integer.positive().parse(amount);
  integer.nonnegative().parse(supplierUnits);
  const supplierMinor = Number(ceilDiv(BigInt(supplierUnits) * numerator, 100n * denominator));
  const policy = PRICING_POLICY.fees[2];
  const feeMinor = Number(
    ceilDiv(BigInt(amount) * BigInt(policy.bps), 10000n) +
      ceilDiv(BigInt(policy.fixedCents) * numerator, denominator),
  );
  const contributionMinor = amount - supplierMinor - feeMinor;
  return promotionEstimateSchema.parse({
    currency,
    revenueMinor: amount,
    supplierMinor,
    feeMinor,
    contributionMinor,
    marginBps: Number((BigInt(contributionMinor) * 10000n) / BigInt(amount)),
    basis: `Estimated ${policy.bps / 100}% plus USD ${(policy.fixedCents / 100).toFixed(2)} per payment; frozen checkout FX and supplier quote; before refunds, other expenses and taxes`,
  });
}
