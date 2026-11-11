import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { StoredPlan } from '../../../../packages/shared/src/index.ts';
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
  const price = override === null ? calculated : moneyInteger(override) ? override : 0;
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
    return data.priceOverrideUsdCents === null
      ? data.priceCents === calculateSellingPrice(units)
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
  };
}
export function samePackage(a: Record<string, unknown>, b: Record<string, unknown>) {
  if (
    'id' in b &&
    ['dailyPolicy', 'supplierNotes'].some((key) => a[key] !== undefined && b[key] === undefined)
  )
    return false;
  return Object.entries(b).every(
    ([key, value]) => JSON.stringify(a[key]) === JSON.stringify(value),
  );
}
