import { z } from 'zod';
import { productOffersSchema } from './canonical-products.js';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { StoredPlan } from '../../../../packages/shared/src/index.ts';
import type { ResolvedPricing } from '../../../../packages/shared/src/pricing-management.ts';
import { resolvedSchema } from './pricing-rules.js';
import { canonical, decisionHash } from './catalogue-curation.js';
import {
  approvedFixed,
  calculatePricing,
  profitable,
  PRICING_VERSION,
  supplierCostCents,
  moneyInteger,
} from './pricing.js';

export const catalogueDate = (at: Date | string | number = Date.now()) =>
  new Date(at).toISOString().slice(0, 10);
export function currentCatalogueDate(date: unknown, now = Date.now()): boolean {
  return date === catalogueDate(now) || date === catalogueDate(now - 86400000);
}
export function pricePackage(
  incoming: StoredPlan,
  previous: Record<string, unknown> = {},
  at = Timestamp.now(),
  resetValue = false,
  rule: ResolvedPricing | null = previous.managedPricing
    ? resolvedSchema.parse(previous.managedPricing)
    : null,
): StoredPlan {
  if (previous.productOffers !== undefined)
    incoming = { ...incoming, productOffers: productOffersSchema.parse(previous.productOffers) };
  const date = catalogueDate(incoming.syncedAt);
  const syncedAt =
    previous.catalogueDate === date &&
    typeof previous.syncedAt === 'string' &&
    Number.isFinite(Date.parse(previous.syncedAt)) &&
    catalogueDate(previous.syncedAt) === date &&
    Date.parse(previous.syncedAt) <= Date.parse(incoming.syncedAt)
      ? previous.syncedAt
      : incoming.syncedAt;
  const version = rule ? PRICING_VERSION + '-' + decisionHash(rule).slice(0, 16) : PRICING_VERSION;
  const override = previous.priceOverrideUsdCents ?? null;
  const units = moneyInteger(incoming.wholesaleUnits) ? incoming.wholesaleUnits : 0;
  let competitorTarget: number | null = null;
  let calculated = 0,
    cost = 0,
    valid = incoming.active;
  try {
    cost = supplierCostCents(incoming.wholesaleUnits);
    const proposal = calculatePricing(incoming.wholesaleUnits, rule ?? undefined);
    calculated = proposal.price;
    competitorTarget = proposal.competitorTarget;
  } catch {
    valid = false;
  }
  let adjustment = 0;
  const oldUnits = previous.wholesaleUnits;
  const flags: string[] = [...(incoming.pricingFlags ?? [])];
  if (
    previous.pricingVersion === version &&
    oldUnits === units &&
    Array.isArray(previous.pricingFlags)
  )
    flags.push(
      ...previous.pricingFlags.filter(
        (flag): flag is string =>
          typeof flag === 'string' &&
          ![
            'comparison_incomplete',
            'competitor_target_missed',
            'approved_minimum_exception',
          ].includes(flag),
      ),
    );
  if (!incoming.supplierComparison) flags.push('comparison_incomplete');
  if (moneyInteger(oldUnits) && units > oldUnits * 1.25) flags.push('supplier_cost_increase');
  if (
    !rule &&
    override === null &&
    previous.pricingVersion === version &&
    moneyInteger(oldUnits) &&
    (oldUnits !== units || previous.priceAdjustmentReason === 'stable') &&
    Math.abs(units - oldUnits) * 100 <= oldUnits * 5 &&
    moneyInteger(previous.priceCents) &&
    Math.abs(previous.priceCents - calculated) <= 50 &&
    profitable(units, previous.priceCents)
  )
    adjustment = previous.priceCents - calculated;
  let adjustmentReason: StoredPlan['priceAdjustmentReason'] = adjustment === 0 ? 'none' : 'stable';
  if (
    !resetValue &&
    !rule &&
    override === null &&
    previous.pricingVersion === version &&
    oldUnits === units &&
    incoming.supplierComparison &&
    canonical(previous.supplierComparison) === canonical(incoming.supplierComparison) &&
    previous.priceAdjustmentReason === 'value' &&
    typeof previous.priceAdjustmentUsdCents === 'number' &&
    Number.isSafeInteger(previous.priceAdjustmentUsdCents) &&
    previous.priceAdjustmentUsdCents < 0 &&
    profitable(units, calculated + previous.priceAdjustmentUsdCents)
  ) {
    adjustment = previous.priceAdjustmentUsdCents;
    adjustmentReason = 'value';
  }
  const fixed = rule?.fixedCents ?? (rule?.packageId ? null : override);
  const price = fixed === null ? calculated + adjustment : moneyInteger(fixed) ? fixed : 0;
  if (competitorTarget !== null && price > competitorTarget) flags.push('competitor_target_missed');
  if (rule && !profitable(units, price, rule) && approvedFixed(units, price, rule))
    flags.push('approved_minimum_exception');
  if (
    moneyInteger(previous.priceCents) &&
    Math.abs(price - previous.priceCents) > Math.max(100, previous.priceCents * 0.5)
  )
    flags.push('retail_price_change');
  valid =
    valid &&
    (profitable(incoming.wholesaleUnits, price, rule ?? undefined) ||
      approvedFixed(units, price, rule)) &&
    price <= 99999999;
  const unchanged =
    previous.pricingVersion === version &&
    previous.wholesaleUnits === units &&
    previous.priceOverrideUsdCents === override &&
    previous.sellingPriceUsdCents === price &&
    previous.pricingStatus === (valid ? 'valid' : 'review_required') &&
    previous.pricingUpdatedAt instanceof Timestamp;
  const { managedPricing: priorRule, ...base } = incoming;
  void priorRule;
  return {
    ...base,
    ...(z.array(z.string().max(100)).max(50).safeParse(previous.tags).success
      ? { tags: z.array(z.string().max(100)).max(50).parse(previous.tags) }
      : {}),
    ...(moneyInteger(oldUnits) && oldUnits !== units && units > 0
      ? { lastSupplierMovement: units > oldUnits ? ('increase' as const) : ('decrease' as const) }
      : previous.lastSupplierMovement === 'increase' || previous.lastSupplierMovement === 'decrease'
        ? { lastSupplierMovement: previous.lastSupplierMovement }
        : {}),
    wholesaleUnits: units,
    packageId: incoming.id,
    supplier: 'esimaccess',
    supplierCostUsdCents: cost,
    sellingPriceUsdCents: price,
    priceCents: price,
    priceAdjustmentUsdCents: adjustment,
    priceAdjustmentReason: adjustmentReason,
    pricingFlags: [...new Set(flags)].sort(),
    pricingVersion: version,
    ...(rule ? { managedPricing: rule } : {}),
    pricingUpdatedAt:
      unchanged && previous.pricingUpdatedAt instanceof Timestamp ? previous.pricingUpdatedAt : at,
    priceOverrideUsdCents: override === null ? null : typeof override === 'number' ? override : 0,
    pricingStatus: valid ? 'valid' : 'review_required',
    catalogueDate: date,
    syncedAt,
    active: valid,
  };
}
// A direct Admin SDK write cannot become purchasable merely by declaring itself valid.
export function validPackagePricing(data: Record<string, unknown>): boolean {
  try {
    const units = data.wholesaleUnits;
    const rule =
      data.managedPricing === undefined ? null : resolvedSchema.parse(data.managedPricing);
    if (rule?.packageId && rule.packageId !== data.id) return false;
    const version = rule
      ? PRICING_VERSION + '-' + decisionHash(rule).slice(0, 16)
      : PRICING_VERSION;
    if (
      !moneyInteger(units) ||
      data.pricingVersion !== version ||
      data.pricingStatus !== 'valid' ||
      data.supplier !== 'esimaccess' ||
      data.packageId !== data.id ||
      !(data.pricingUpdatedAt instanceof Timestamp) ||
      data.supplierCostUsdCents !== supplierCostCents(units) ||
      data.sellingPriceUsdCents !== data.priceCents ||
      !moneyInteger(data.priceCents) ||
      (!profitable(units, data.priceCents, rule ?? undefined) &&
        !approvedFixed(units, data.priceCents, rule))
    )
      return false;
    const adjustment = data.priceAdjustmentUsdCents ?? 0;
    const reason = data.priceAdjustmentReason ?? 'none';
    const validAdjustment =
      typeof adjustment === 'number' &&
      Number.isSafeInteger(adjustment) &&
      ((reason === 'none' && adjustment === 0) ||
        (reason === 'stable' && Math.abs(adjustment) <= 50) ||
        (reason === 'value' && adjustment < 0));
    const fixed = rule?.fixedCents ?? (rule?.packageId ? null : data.priceOverrideUsdCents);
    if (rule && adjustment !== 0) return false;
    return fixed === null
      ? validAdjustment &&
          data.priceCents === calculatePricing(units, rule ?? undefined).price + adjustment
      : moneyInteger(fixed) && data.priceCents === fixed;
  } catch {
    return false;
  }
}
// Source fields that become absent must be removed, while preserving unrelated owner metadata.
export function packageWrite(plan: StoredPlan): Record<string, unknown> {
  return {
    ...plan,
    managedPricing: plan.managedPricing ?? FieldValue.delete(),
    dailyPolicy: plan.dailyPolicy ?? FieldValue.delete(),
    supplierNotes: plan.supplierNotes ?? FieldValue.delete(),
    supplierComparison: plan.supplierComparison ?? FieldValue.delete(),
    supplierName: plan.supplierName ?? FieldValue.delete(),
  };
}
export function samePackage(a: Record<string, unknown>, b: Record<string, unknown>) {
  if (
    'id' in b &&
    ['managedPricing', 'dailyPolicy', 'supplierNotes', 'supplierComparison', 'supplierName'].some(
      (key) => a[key] !== undefined && b[key] === undefined,
    )
  )
    return false;
  return Object.entries(b).every(([key, value]) => canonical(a[key]) === canonical(value));
}

export function pricingDecision(data: Record<string, unknown>) {
  const keys = [
    'wholesaleUnits',
    'priceCents',
    'pricingVersion',
    'priceOverrideUsdCents',
    'pricingStatus',
    'priceAdjustmentUsdCents',
    'priceAdjustmentReason',
    'pricingFlags',
    'catalogueVisibility',
    'catalogueDecision',
    'replacedBy',
    'supplierComparison',
    'active',
  ];
  if (data.managedPricing) keys.push('managedPricing');
  return Object.fromEntries(keys.map((key) => [key, data[key] ?? null]));
}
