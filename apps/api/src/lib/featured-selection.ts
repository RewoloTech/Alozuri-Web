import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Plan } from '../../../../packages/shared/src/index.ts';
import { continentOf, type Continent } from '../../../../packages/shared/src/geography.ts';
import {
  FEATURED_REGIONS,
  REGION_NAMES,
  BUNDLE_ALLOWANCES,
  defaultAllowance,
  type FeaturedRegion,
} from '../../../../packages/shared/src/featured.ts';
import { cataloguePlan } from './repository.js';
import { catalogueId } from './supplier.js';
export const SELECTION_VERSION = 'regional-global-v1';
export const BUNDLE_POLICY = {
  preferredDays: 30,
  switchDiscountPercent: 5,
  comparableCoveragePercent: 90,
  materialCoverageGainPercent: 25,
  materialCountryGain: 5,
  materialPricePremiumPercent: 10,
  minimumRegionalSharePercent: 80,
  minimumGlobalCountries: 25,
  minimumGlobalContinents: 3,
  minimumCountriesPerContinent: 3,
  regions: {
    europe: { continent: 'Europe', minimum: 15, required: ['GB', 'FR', 'DE', 'ES', 'IT'] },
    asia: { continent: 'Asia', minimum: 5, required: ['JP', 'SG', 'TH'] },
    'north-america': { continent: 'North America', minimum: 2, required: ['US', 'CA'] },
  },
} satisfies {
  regions: Record<
    Exclude<FeaturedRegion, 'global'>,
    { continent: Continent; minimum: number; required: string[] }
  >;
} & Record<string, unknown>;
export type BundlePolicy = typeof BUNDLE_POLICY;
export const bundleRecordSchema = z.object({
  region: z.enum(FEATURED_REGIONS),
  regionName: z.string(),
  status: z.enum(['active', 'unavailable']),
  defaultDataGb: z.union([z.literal(5), z.literal(10), z.literal(20)]).nullable(),
  preferredValidityDays: z.literal(30),
  selectedPlanId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,100}$/)
    .nullable(),
  countryCount: z.number().int().nonnegative(),
  options: z.record(
    z.string().regex(/^(5|10|20)$/),
    z.object({
      productId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
      dataGb: z.union([z.literal(5), z.literal(10), z.literal(20)]),
      validityDays: z.number().int().min(30),
      countryCount: z.number().int().min(2),
      sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ),
  updatedAt: z.instanceof(Timestamp),
  catalogueSyncId: z.string().min(1).max(100),
  selectionVersion: z.literal(SELECTION_VERSION),
});
export type BundleRecord = z.infer<typeof bundleRecordSchema>;
export type BundleCandidate = { plan: Plan; supplierCode: string; sourceHash: string };
const privateSchema = z
  .object({
    supplierCode: z.string().min(1).max(200),
    providerId: z.literal('esim-access').optional(),
    pricingVersion: z.string(),
  })
  .passthrough();
export function bundleCandidate(data: unknown, now = Date.now()): BundleCandidate | null {
  const raw = privateSchema.safeParse(data),
    plan = cataloguePlan(data, now);
  if (
    !raw.success ||
    !plan ||
    plan.demo ||
    plan.dataType !== 'fixed' ||
    !BUNDLE_ALLOWANCES.some((gb) => gb === plan.dataGb) ||
    plan.days < 30 ||
    plan.priceCents > 99999999 ||
    catalogueId(raw.data.supplierCode) !== plan.id ||
    plan.countries.length < 2 ||
    new Set(plan.countries).size !== plan.countries.length ||
    plan.countries.some((c) => !continentOf(c))
  )
    return null;
  if (raw.data.expiresAt !== undefined) {
    const expiry =
      raw.data.expiresAt instanceof Timestamp
        ? raw.data.expiresAt.toMillis()
        : typeof raw.data.expiresAt === 'string'
          ? Date.parse(raw.data.expiresAt)
          : NaN;
    if (!Number.isFinite(expiry) || expiry <= now) return null;
  }
  const sourceHash = createHash('sha256')
    .update(
      JSON.stringify({
        ...plan,
        countries: [...plan.countries].sort(),
        networks: [...plan.networks].sort(),
        syncedAt: undefined,
        pricingVersion: raw.data.pricingVersion,
        supplierCode: raw.data.supplierCode,
      }),
    )
    .digest('hex');
  return { plan, supplierCode: raw.data.supplierCode, sourceHash };
}
export function eligibleRegion(
  candidate: BundleCandidate,
  region: FeaturedRegion,
  policy = BUNDLE_POLICY,
): boolean {
  const codes = candidate.plan.countries;
  if (region === 'global') {
    const groups = new Map<Continent, number>();
    for (const code of codes) {
      const area = continentOf(code);
      if (area) groups.set(area, (groups.get(area) || 0) + 1);
    }
    return (
      codes.length >= policy.minimumGlobalCountries &&
      ['GB', 'US', 'JP'].every((c) => codes.includes(c)) &&
      [...groups.values()].filter((n) => n >= policy.minimumCountriesPerContinent).length >=
        policy.minimumGlobalContinents
    );
  }
  const rule = policy.regions[region],
    inside = codes.filter((c) => continentOf(c) === rule.continent).length;
  return (
    inside >= rule.minimum &&
    inside * 100 >= codes.length * policy.minimumRegionalSharePercent &&
    rule.required.every((c) => codes.includes(c))
  );
}
function compare(a: BundleCandidate, b: BundleCandidate, policy: BundlePolicy) {
  return (
    Number(a.plan.days !== policy.preferredDays) - Number(b.plan.days !== policy.preferredDays) ||
    a.plan.priceCents - b.plan.priceCents ||
    b.plan.countries.length - a.plan.countries.length ||
    Number(!!b.plan.networks.length) - Number(!!a.plan.networks.length) ||
    a.plan.id.localeCompare(b.plan.id)
  );
}
function choose(
  rows: BundleCandidate[],
  previousId: string | undefined,
  policy: BundlePolicy,
): BundleCandidate | undefined {
  const ordered = [...rows].sort((a, b) => compare(a, b, policy)),
    best = ordered[0],
    old = rows.find((row) => row.plan.id === previousId);
  if (!best || !old) return best;
  if (best.plan.days === policy.preferredDays && old.plan.days !== policy.preferredDays)
    return best;
  const discounted = ordered.find(
    (row) =>
      row.plan.days >= old.plan.days &&
      row.plan.countries.length * 100 >=
        old.plan.countries.length * policy.comparableCoveragePercent &&
      BigInt(row.plan.priceCents) * 100n <=
        BigInt(old.plan.priceCents) * BigInt(100 - policy.switchDiscountPercent),
  );
  if (discounted) return discounted;
  const material = ordered.find(
    (row) =>
      row.plan.days >= old.plan.days &&
      old.plan.countries.every((c) => row.plan.countries.includes(c)) &&
      row.plan.countries.length - old.plan.countries.length >= policy.materialCountryGain &&
      row.plan.countries.length * 100 >=
        old.plan.countries.length * (100 + policy.materialCoverageGainPercent) &&
      BigInt(row.plan.priceCents) * 100n <=
        BigInt(old.plan.priceCents) * BigInt(100 + policy.materialPricePremiumPercent),
  );
  return material ?? old;
}
export function selectFeaturedBundles(
  source: readonly unknown[],
  previous: readonly BundleRecord[],
  catalogueSyncId: string,
  at = Timestamp.now(),
  policy = BUNDLE_POLICY,
): BundleRecord[] {
  const candidates = source
    .map((row) => bundleCandidate(row, at.toMillis()))
    .filter((row): row is BundleCandidate => row !== null);
  return FEATURED_REGIONS.map((region) => {
    const old = previous.find((row) => row.region === region),
      options: BundleRecord['options'] = {};
    for (const dataGb of BUNDLE_ALLOWANCES) {
      const chosen = choose(
        candidates.filter(
          (row) => row.plan.dataGb === dataGb && eligibleRegion(row, region, policy),
        ),
        old?.options[String(dataGb)]?.productId,
        policy,
      );
      if (chosen)
        options[String(dataGb)] = {
          productId: chosen.plan.id,
          dataGb,
          validityDays: chosen.plan.days,
          countryCount: chosen.plan.countries.length,
          sourceHash: chosen.sourceHash,
        };
    }
    const preferred = defaultAllowance(Object.values(options).map((o) => o.dataGb)),
      selected = preferred === null ? null : options[String(preferred)];
    return {
      region,
      regionName: REGION_NAMES[region],
      status: selected ? 'active' : 'unavailable',
      defaultDataGb: preferred,
      preferredValidityDays: 30,
      selectedPlanId: selected?.productId ?? null,
      countryCount: selected?.countryCount ?? 0,
      options,
      updatedAt: at,
      catalogueSyncId,
      selectionVersion: SELECTION_VERSION,
    };
  });
}
