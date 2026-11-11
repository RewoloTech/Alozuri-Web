// Offline, read-only analysis of private catalogue exports. Never connects to a service.
import { readFileSync, writeFileSync } from 'node:fs';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adaptPackage } from '../apps/api/src/lib/supplier.ts';
import { pricePackage, catalogueDate } from '../apps/api/src/lib/package-pricing.ts';
import {
  curateCatalogue,
  assertCuratedCatalogue,
  curationKey,
} from '../apps/api/src/lib/catalogue-curation.ts';
import {
  PRICING_VERSION,
  PRICING_POLICY,
  estimatedContribution,
  moneyInteger,
} from '../apps/api/src/lib/pricing.ts';
import type { StoredPlan } from '../packages/shared/src/index.ts';
const [beforePath, supplierPath, outputPath] = process.argv.slice(2);
if (!beforePath || !supplierPath || !outputPath)
  throw new Error(
    'Provide stored catalogue JSON, raw supplier JSON, and private output JSON path.',
  );
const before = z
  .array(z.object({ id: z.string(), data: z.record(z.string(), z.unknown()) }))
  .parse(JSON.parse(readFileSync(beforePath, 'utf8')));
const raw = z.array(z.unknown()).parse(JSON.parse(readFileSync(supplierPath, 'utf8')));
const byId = new Map(before.map((row) => [row.id, row.data]));
const at = Timestamp.now();
const normalized = raw
  .map((row) => adaptPackage(row, at.toDate().toISOString()))
  .filter((p): p is StoredPlan => p !== null);
const proposed = curateCatalogue(
  normalized.map((p) => {
    const old = { ...(byId.get(p.id) ?? {}) };
    if (typeof old.pricingUpdatedAt === 'string')
      old.pricingUpdatedAt = Timestamp.fromDate(new Date(old.pricingUpdatedAt));
    return pricePackage(p, old, at, true);
  }),
);
assertCuratedCatalogue(proposed);
const costs = proposed
  .map((p) => p.wholesaleUnits)
  .filter((n) => n > 0)
  .sort((a, b) => a - b);
const rows = proposed.map((p) => ({
  id: p.id,
  supplierCode: p.supplierCode,
  supplierName: p.supplierName ?? p.name,
  name: p.name,
  countries: p.countries,
  dataType: p.dataType,
  dataGb: p.dataGb,
  days: p.days,
  fairUse: p.fairUse,
  supplierCostUsd: p.wholesaleUnits / 10000,
  oldPriceCents: byId.get(p.id)?.priceCents ?? null,
  newPriceCents: p.priceCents,
  contributionCents:
    moneyInteger(p.wholesaleUnits) && moneyInteger(p.priceCents)
      ? estimatedContribution(p.wholesaleUnits, p.priceCents)
      : null,
  feeScenarios: PRICING_POLICY.fees.map((f) => ({
    name: f.name,
    contributionCents:
      moneyInteger(p.wholesaleUnits) && moneyInteger(p.priceCents)
        ? estimatedContribution(p.wholesaleUnits, p.priceCents, f)
        : null,
  })),
  active: p.active,
  visibility: p.catalogueVisibility,
  decision: p.catalogueDecision,
  flags: p.pricingFlags,
  replacedBy: p.replacedBy,
  comparison: p.supplierComparison ?? null,
}));
const visible = proposed.filter((p) => p.active && p.catalogueVisibility === 'public');
const families = new Map<string, number>();
for (const p of proposed) {
  const key = curationKey(p);
  families.set(key, (families.get(key) ?? 0) + 1);
}
const report = {
  mode: 'offline-read-only',
  version: PRICING_VERSION,
  date: catalogueDate(at.toDate()),
  policy: PRICING_POLICY,
  distributionUsd: Object.fromEntries(
    [0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99].map((q) => [
      q,
      costs[Math.floor((costs.length - 1) * q)] / 10000,
    ]),
  ),
  totals: {
    supplier: raw.length,
    normalized: normalized.length,
    public: visible.length,
    hidden: proposed.filter((p) => p.catalogueVisibility === 'hidden').length,
    review: proposed.filter((p) => !p.active).length,
    increased: rows.filter(
      (r) => typeof r.oldPriceCents === 'number' && r.newPriceCents > r.oldPriceCents,
    ).length,
    decreased: rows.filter(
      (r) => typeof r.oldPriceCents === 'number' && r.newPriceCents < r.oldPriceCents,
    ).length,
    unchanged: rows.filter((r) => r.newPriceCents === r.oldPriceCents).length,
    minimumPublicContributionCents: Math.min(
      ...visible.map((p) => estimatedContribution(p.wholesaleUnits, p.priceCents)),
    ),
    largestComparisonFamily: Math.max(...families.values()),
  },
  rows,
};
writeFileSync(outputPath, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(
  JSON.stringify({
    version: report.version,
    distributionUsd: report.distributionUsd,
    totals: report.totals,
  }),
);
