import { z } from 'zod';
import { type StoredPlan } from '../../../../packages/shared/src/index.ts';
import {
  pricingCountryCode,
  parameters,
  configSchema,
  type PricingConfig,
  type ResolvedPricing,
} from '../../../../packages/shared/src/pricing-management.ts';
import { decisionHash } from './catalogue-curation.js';
import { PRICING_POLICY } from './pricing.js';

export const defaults = {
  targetCents: null,
  undercutBps: null,
  minimumContributionCents: PRICING_POLICY.minimumContributionCents,
  minimumContributionBps: PRICING_POLICY.minimumContributionBps,
};
export function initialConfig(): PricingConfig {
  return {
    profiles: {
      standard: { name: 'Standard', settings: { ...defaults } },
      competitive: {
        name: 'Competitive',
        settings: { ...defaults, targetCents: 75, minimumContributionBps: 800 },
      },
      aggressive: {
        name: 'Aggressive',
        settings: { ...defaults, targetCents: 50, minimumContributionBps: 500 },
      },
      custom: { name: 'Custom', settings: { ...defaults } },
    },
    countries: {},
    regions: {},
    packages: {},
    benchmarks: {},
  };
}
const regions =
  /^(Middle East|North America|South America|Latin America|Central America|Caribbean|South[ -]?East Asia|Asia[ -]Pacific|Africa|Europe|Asia|Oceania|Global|Worldwide)\b/i;
export function pricingScope(plan: Pick<StoredPlan, 'name' | 'supplierName' | 'countries'>) {
  const codes = [...new Set(plan.countries)].sort();
  const label = (plan.supplierName ?? plan.name).trim();
  const match = regions.exec(label);
  if (codes.length === 1 && !match && pricingCountryCode(codes[0]))
    return { country: codes[0], region: null, bundle: null };
  if (codes.length < 2 || !match || !codes.every(pricingCountryCode))
    return { country: null, region: null, bundle: null };
  // A combined title such as “Europe & USA” is not an explicit Europe bundle.
  const remainder = label.slice(match[0].length).trim();
  if (remainder && !/^(?:\d|\(|unlimited\b|daily\b|regional\b|bundle\b)/i.test(remainder))
    return { country: null, region: null, bundle: null };
  const region = match[1].toLowerCase().replace(/ /g, '-').replace('worldwide', 'global');
  return { country: null, region, bundle: region + '-' + decisionHash(codes).slice(0, 12) };
}
export const snapshotSchema = z
  .object({
    config: configSchema,
    benchmarkUsd: z.record(z.string(), z.number().int().positive().max(99999999)),
  })
  .strict()
  .refine(
    (v) => Object.keys(v.config.benchmarks).every((k) => Object.hasOwn(v.benchmarkUsd, k)),
    'Missing benchmark conversion.',
  );
export type RuleSnapshot = z.infer<typeof snapshotSchema>;
export function readRules(json: unknown): RuleSnapshot {
  if (json === undefined) return { config: initialConfig(), benchmarkUsd: {} };
  return snapshotSchema.parse(JSON.parse(z.string().parse(json)));
}
export function resolvePricing(
  plan: Pick<StoredPlan, 'id' | 'countries' | 'name' | 'supplierName'>,
  snapshot: RuleSnapshot,
): ResolvedPricing | null {
  const { config } = snapshot,
    { country, region, bundle } = pricingScope(plan);
  const key = country ?? (bundle && config.regions[bundle]?.active ? bundle : region);
  const assigned = key ? (country ? config.countries[key] : config.regions[key]) : undefined;
  const rule = assigned?.active ? assigned : null;
  const override = config.packages[plan.id]?.active ? config.packages[plan.id] : null;
  const benchmark = config.benchmarks[plan.id] ?? null;
  if (!rule && !override && !benchmark) return null;
  const settings = rule
    ? { ...config.profiles[rule.profile].settings, ...rule.settings }
    : { ...defaults };
  return {
    ...settings,
    ...(override && ['custom', 'fixed'].includes(override.mode) ? override.settings : {}),
    scope: rule && key ? key : 'global',
    profile: rule?.profile ?? null,
    packageId: override ? plan.id : null,
    benchmark,
    benchmarkUsd: benchmark ? snapshot.benchmarkUsd[plan.id] : null,
    approvedCostUnits: override?.approvedCostUnits ?? null,
    fixedCents: override?.fixedCents ?? null,
  };
}
export const resolvedSchema = parameters
  .extend({
    scope: z.string(),
    profile: z.string().nullable(),
    packageId: z.string().nullable(),
    fixedCents: z.number().int().min(50).nullable(),
    approvedCostUnits: z.number().int().positive().nullable(),
    benchmarkUsd: z.number().int().positive().nullable(),
    benchmark: configSchema.shape.benchmarks.valueType.nullable(),
  })
  .strict();
