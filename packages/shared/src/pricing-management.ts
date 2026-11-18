import { z } from 'zod';
import { continentOf } from './geography.ts';
import { isCountryCode } from './index.ts';
export const pricingCountryCode = (code: string) =>
  isCountryCode(code) && continentOf(code) !== null;

const cents = z.number().int().min(0).max(99999999);
const id = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,100}$/)
  .refine(
    (v) =>
      !['__proto__', 'constructor', 'prototype', 'toString', 'valueOf'].includes(v) &&
      !(v in Object.prototype),
  );
const label = z.string().trim().min(1).max(200);
export const parameters = z
  .object({
    targetCents: cents.nullable(),
    minimumContributionCents: cents,
    minimumContributionBps: z.number().int().min(0).max(5000),
    undercutBps: z.number().int().min(0).max(9999).nullable(),
  })
  .strict();
const assignment = z
  .object({ active: z.boolean(), profile: id, settings: parameters.partial() })
  .strict();
const benchmark = z
  .object({
    competitor: label,
    packageName: label,
    allowance: label,
    validity: label,
    amount: cents.min(1),
    currency: z.enum(['USD', 'EUR', 'GBP']),
    url: z.url({ protocol: /^https?$/ }).max(1000),
    checked: z.iso.date(),
  })
  .strict();
const override = z
  .object({
    active: z.boolean(),
    mode: z.enum(['country', 'region', 'custom', 'fixed']),
    settings: parameters.partial(),
    fixedCents: cents.min(50).nullable(),
    approvedCostUnits: z.number().int().positive().safe().nullable(),
  })
  .strict()
  .refine(
    (v) =>
      (v.mode === 'fixed') === (v.fixedCents !== null) &&
      (v.mode === 'fixed' || v.approvedCostUnits === null),
  );
export const configSchema = z
  .object({
    profiles: z.record(id, z.object({ name: label, settings: parameters }).strict()),
    countries: z.record(z.string().refine(pricingCountryCode), assignment),
    regions: z.record(z.string().regex(/^[a-z-]+(?:-[a-f0-9]{12})?$/), assignment),
    packages: z.record(id, override),
    benchmarks: z.record(id, benchmark),
  })
  .strict()
  .refine(
    (v) =>
      ['custom', 'aggressive', 'standard', 'competitive'].every((k) =>
        Object.hasOwn(v.profiles, k),
      ),
    'Required profile template missing.',
  )
  .refine(
    (v) =>
      Object.values({ ...v.countries, ...v.regions }).every((r) =>
        Object.hasOwn(v.profiles, r.profile),
      ),
    'Unknown pricing profile.',
  );
export type Parameters = z.infer<typeof parameters>;
export type PricingConfig = z.infer<typeof configSchema>;
export type Assignment = z.infer<typeof assignment>;
export type PackageRule = z.infer<typeof override>;
export type Benchmark = z.infer<typeof benchmark>;
export type ResolvedPricing = Parameters & {
  scope: string;
  profile: string | null;
  packageId: string | null;
  fixedCents: number | null;
  approvedCostUnits: number | null;
  benchmarkUsd: number | null;
  benchmark: Benchmark | null;
};
export type PricingRow = {
  id: string;
  name: string;
  country: string | null;
  region: string | null;
  bundle: string | null;
  continent: string | null;
  coverageCount: number;
  inheritedSettings: Parameters;
  units: number;
  current: number;
  proposed: number;
  fee: number | null;
  contribution: number | null;
  margin: number | null;
  minimum: number | null;
  target: number | null;
  competitor: number | null;
  competitorTarget: number | null;
  safe: boolean;
  exception: boolean;
  eligible: boolean;
  available: boolean;
  increased: boolean;
  affected: boolean;
  scope: string;
  profile: string | null;
  updated: string | null;
};
export type PricingWorkspace = {
  config: PricingConfig;
  revision: string;
  activeVersion: string;
  hasDraft: boolean;
  job: string;
  recent: { id: string; name: string; date: string; before: number; after: number }[];
  versions: { id: string; actor: string; date: string }[];
};
