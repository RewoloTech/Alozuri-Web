import { createHash } from 'node:crypto';
import { z } from 'zod';
import { isCountryCode } from '../../../../packages/shared/src/index.ts';
import type { Plan } from '../../../../packages/shared/src/index.ts';
import { continentOf } from '../../../../packages/shared/src/geography.ts';
import { coverageMatchesRegion } from './featured-selection.js';
import { FEATURED_REGIONS } from '../../../../packages/shared/src/featured.ts';
import { promotionEstimate } from './promotion-estimate.js';
import { PRICING_POLICY } from './pricing.js';
import { MINIMUM_CHARGE_MINOR, type PriceExchange } from './exchange-rates.js';
export const promotionMarginSetting = z
  .string()
  .regex(/^-?\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(-10000).max(9999));
// Promotion losses are intentional merchant-funded discounts; normal retail targets stay separate.
export const PROMOTION_MIN_CONTRIBUTION_BPS = promotionMarginSetting.parse(
  process.env.PROMOTION_MIN_CONTRIBUTION_BPS ?? '-2000',
);
const ids = z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/)).max(500);
export const promotionScope = z
  .object({
    kind: z.enum(['all', 'products', 'destinations', 'regions', 'tags']).default('all'),
    values: ids.default([]),
    excludedProducts: ids.default([]),
  })
  .strict()
  .refine((v) => v.kind === 'all' || v.values.length > 0, 'Select at least one target.')
  .refine(
    (v) => v.kind !== 'destinations' || v.values.every(isCountryCode),
    'Select valid destination codes.',
  )
  .refine(
    (v) =>
      v.kind !== 'regions' ||
      v.values.every((r) =>
        [
          'europe',
          'asia',
          'north-america',
          'global',
          'africa',
          'south-america',
          'oceania',
        ].includes(r),
      ),
    'Select a supported catalogue region.',
  );
export const discountConfig = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('percent'), value: z.number().int().min(1).max(50) }).strict(),
  z.object({ kind: z.literal('fixed'), value: z.number().int().positive().max(99999999) }).strict(),
  z.object({ kind: z.literal('price'), value: z.number().int().positive().max(99999999) }).strict(),
]);
export const promotionExtensions = {
  name: z.string().trim().min(1).max(120).optional(),
  scope: promotionScope.optional(),
  discount: discountConfig.optional(),
  automatic: z.boolean().optional(),
  priority: z.number().int().min(0).max(10000).optional(),
  minimumOrderUsdCents: z.number().int().nonnegative().max(99999999).optional(),
  campaignId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,100}$/)
    .optional(),
};
export type PromotionPolicy = { code: string; discountPercent: number } & {
  [K in keyof typeof promotionExtensions]?: z.infer<(typeof promotionExtensions)[K]>;
};
export function matchesPromotion(p: PromotionPolicy, plan: Plan): boolean {
  if (p.scope?.excludedProducts.includes(plan.id)) return false;
  const scope = p.scope;
  if (!scope || scope.kind === 'all') return true;
  if (scope.kind === 'products') return scope.values.includes(plan.id);
  if (scope.kind === 'destinations') return plan.countries.every((c) => scope.values.includes(c));
  if (scope.kind === 'tags') return (plan.tags ?? []).some((tag) => scope.values.includes(tag));
  return scope.values.some((region) =>
    FEATURED_REGIONS.some((r) => r === region)
      ? coverageMatchesRegion(
          plan.countries,
          FEATURED_REGIONS.find((r) => r === region)!,
        )
      : plan.countries.length > 0 &&
        plan.countries.every((c) => continentOf(c)?.toLowerCase().replaceAll(' ', '-') === region),
  );
}
export function promotionConfigHash(p: PromotionPolicy) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        p.code,
        p.discountPercent,
        p.scope ?? null,
        p.discount ?? null,
        p.automatic ?? false,
        p.priority ?? 0,
        p.minimumOrderUsdCents ?? 0,
        p.campaignId ?? null,
      ]),
    )
    .digest('hex');
}
/** The existing percentage rounding is preserved. Monetary settings are USD minor units. */
export function discountedUnit(amount: number, p: PromotionPolicy, fx: PriceExchange): number {
  const d = p.discount ?? { kind: 'percent' as const, value: p.discountPercent };
  const converted = Number((BigInt(d.value) * BigInt(fx.numerator)) / BigInt(fx.denominator));
  const next =
    d.kind === 'percent'
      ? amount - Number((BigInt(amount) * BigInt(d.value)) / 100n)
      : d.kind === 'fixed'
        ? amount - converted
        : converted;
  if (
    !Number.isSafeInteger(next) ||
    next <= 0 ||
    next >= amount ||
    (amount - next) * 100 > amount * 50
  )
    throw new Error('Promotion must reduce the price by no more than 50%.');
  return next;
}
export function promotionMarginAllowed(
  final: number,
  currency: Plan['currency'],
  units: number,
  fx: PriceExchange,
  minimumBps = PROMOTION_MIN_CONTRIBUTION_BPS,
) {
  z.number().int().min(-10000).max(9999).parse(minimumBps);
  if (final < MINIMUM_CHARGE_MINOR[currency]) return false;
  const estimate = promotionEstimate(final, currency, units, fx);
  if (!estimate) return false;
  const otherCosts =
    (BigInt(PRICING_POLICY.otherCostCents) * BigInt(fx.numerator) + BigInt(fx.denominator) - 1n) /
    BigInt(fx.denominator);
  const net = BigInt(estimate.contributionMinor) - otherCosts;
  return net * 10000n >= BigInt(final) * BigInt(minimumBps);
}
