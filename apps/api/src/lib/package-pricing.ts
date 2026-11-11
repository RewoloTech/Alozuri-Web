import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { StoredPlan } from '../../../../packages/shared/src/index.ts';
import { canonical } from './catalogue-curation.js';
import {
  calculateSellingPrice,
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
): StoredPlan {
  const date = catalogueDate(incoming.syncedAt);
  const syncedAt =
    previous.catalogueDate === date &&
    typeof previous.syncedAt === 'string' &&
    Number.isFinite(Date.parse(previous.syncedAt)) &&
    catalogueDate(previous.syncedAt) === date &&
    Date.parse(previous.syncedAt) <= Date.parse(incoming.syncedAt)
      ? previous.syncedAt
      : incoming.syncedAt;
  const override = previous.priceOverrideUsdCents ?? null;
  const units = moneyInteger(incoming.wholesaleUnits) ? incoming.wholesaleUnits : 0;
  let calculated = 0,
    cost = 0,
    valid = incoming.active;
  try {
    cost = supplierCostCents(incoming.wholesaleUnits);
    calculated = calculateSellingPrice(incoming.wholesaleUnits);
  } catch {
    valid = false;
  }
  let adjustment = 0;
  const oldUnits = previous.wholesaleUnits;
  const flags: string[] = [...(incoming.pricingFlags ?? [])];
  if (
    previous.pricingVersion === PRICING_VERSION &&
    oldUnits === units &&
    Array.isArray(previous.pricingFlags)
  )
    flags.push(
      ...previous.pricingFlags.filter(
        (flag): flag is string => typeof flag === 'string' && flag !== 'comparison_incomplete',
      ),
    );
  if (!incoming.supplierComparison) flags.push('comparison_incomplete');
  if (moneyInteger(oldUnits) && units > oldUnits * 1.25) flags.push('supplier_cost_increase');
  if (
    override === null &&
    previous.pricingVersion === PRICING_VERSION &&
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
    override === null &&
    previous.pricingVersion === PRICING_VERSION &&
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
  const price = override === null ? calculated + adjustment : moneyInteger(override) ? override : 0;
  if (
    moneyInteger(previous.priceCents) &&
    Math.abs(price - previous.priceCents) > Math.max(100, previous.priceCents * 0.5)
  )
    flags.push('retail_price_change');
  valid = valid && profitable(incoming.wholesaleUnits, price) && price <= 99999999;
  const unchanged =
    previous.pricingVersion === PRICING_VERSION &&
    previous.wholesaleUnits === units &&
    previous.priceOverrideUsdCents === override &&
    previous.sellingPriceUsdCents === price &&
    previous.pricingStatus === (valid ? 'valid' : 'review_required') &&
    previous.pricingUpdatedAt instanceof Timestamp;
  return {
    ...incoming,
    wholesaleUnits: units,
    packageId: incoming.id,
    supplier: 'esimaccess',
    supplierCostUsdCents: cost,
    sellingPriceUsdCents: price,
    priceCents: price,
    priceAdjustmentUsdCents: adjustment,
    priceAdjustmentReason: adjustmentReason,
    pricingFlags: [...new Set(flags)].sort(),
    pricingVersion: PRICING_VERSION,
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
    if (
      !moneyInteger(units) ||
      data.pricingVersion !== PRICING_VERSION ||
      data.pricingStatus !== 'valid' ||
      data.supplier !== 'esimaccess' ||
      data.packageId !== data.id ||
      !(data.pricingUpdatedAt instanceof Timestamp) ||
      data.supplierCostUsdCents !== supplierCostCents(units) ||
      data.sellingPriceUsdCents !== data.priceCents ||
      !profitable(units, data.priceCents)
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
    return data.priceOverrideUsdCents === null
      ? validAdjustment && data.priceCents === calculateSellingPrice(units) + adjustment
      : moneyInteger(data.priceOverrideUsdCents) && data.priceCents === data.priceOverrideUsdCents;
  } catch {
    return false;
  }
}
// Source fields that become absent must be removed, while preserving unrelated owner metadata.
export function packageWrite(plan: StoredPlan): Record<string, unknown> {
  return {
    ...plan,
    dailyPolicy: plan.dailyPolicy ?? FieldValue.delete(),
    supplierNotes: plan.supplierNotes ?? FieldValue.delete(),
    supplierComparison: plan.supplierComparison ?? FieldValue.delete(),
    supplierName: plan.supplierName ?? FieldValue.delete(),
  };
}
export function samePackage(a: Record<string, unknown>, b: Record<string, unknown>) {
  if (
    'id' in b &&
    ['dailyPolicy', 'supplierNotes', 'supplierComparison', 'supplierName'].some(
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
  return Object.fromEntries(keys.map((key) => [key, data[key] ?? null]));
}
