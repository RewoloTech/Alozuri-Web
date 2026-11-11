import { parseFeaturedBundles } from '@voyaspan/shared/featured';
import { cache } from 'react';
import { notFound } from 'next/navigation';
const MISSING = Symbol('missing-public-resource');
import { isCountryCode, type Plan, type Country } from '@voyaspan/shared';
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
async function publicJson(path: string): Promise<unknown> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  try {
    const response = await fetch(base + path, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    return response.status === 404 ? MISSING : response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
export const getPublicCountries = cache(async (): Promise<Country[]> => {
  const body = await publicJson('/v1/countries');
  if (!record(body) || !Array.isArray(body.countries)) return [];
  return body.countries.flatMap((c: unknown) =>
    record(c) &&
    typeof c.code === 'string' &&
    isCountryCode(c.code) &&
    typeof c.name === 'string' &&
    typeof c.flag === 'string' &&
    typeof c.region === 'string'
      ? [{ code: c.code, name: c.name, flag: c.flag, region: c.region }]
      : [],
  );
});
export function parsePublicPlan(input: unknown, id: string): Plan | null {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return null;
  if (!record(input)) return null;
  const p = input;
  if (
    p.id !== id ||
    typeof p.name !== 'string' ||
    p.name.length > 1000 ||
    !strings(p.countries) ||
    !p.countries.length ||
    !p.countries.every(isCountryCode) ||
    typeof p.priceCents !== 'number' ||
    !Number.isSafeInteger(p.priceCents) ||
    p.priceCents <= 0 ||
    p.priceCents > 99999999 ||
    p.currency !== 'USD' ||
    typeof p.dataGb !== 'number' ||
    !Number.isFinite(p.dataGb) ||
    p.dataGb < 0 ||
    typeof p.days !== 'number' ||
    !Number.isInteger(p.days) ||
    p.days <= 0 ||
    (p.dataType !== 'fixed' && p.dataType !== 'daily' && p.dataType !== 'unlimited') ||
    typeof p.activation !== 'string' ||
    !strings(p.networks) ||
    typeof p.fairUse !== 'string' ||
    typeof p.syncedAt !== 'string' ||
    p.demo === true
  )
    return null;
  const dataType =
    p.dataType === 'daily' ? 'daily' : p.dataType === 'unlimited' ? 'unlimited' : 'fixed';
  return {
    id,
    name: p.name,
    countries: p.countries,
    priceCents: p.priceCents,
    currency: 'USD',
    dataGb: p.dataGb,
    days: p.days,
    dataType,
    activation: p.activation,
    networks: p.networks,
    fairUse: p.fairUse,
    syncedAt: p.syncedAt,
    ...(p.dailyPolicy === 'reduced' || p.dailyPolicy === 'cutoff'
      ? { dailyPolicy: p.dailyPolicy }
      : {}),
    ...(typeof p.supplierNotes === 'string' ? { supplierNotes: p.supplierNotes } : {}),
  };
}
export const getPublicPlan = cache(async (id: string): Promise<Plan | null> => {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) notFound();
  const body = await publicJson('/v1/packages/' + encodeURIComponent(id));
  if (body === MISSING) notFound();
  return record(body) ? parsePublicPlan(body.plan, id) : null;
});
export const getCountryPlans = cache(async (code: string): Promise<Plan[]> => {
  if (!isCountryCode(code)) return [];
  const body = await publicJson('/v1/packages/match?countries=' + code + '&coverage=local');
  if (!record(body) || !Array.isArray(body.plans)) return [];
  return body.plans
    .flatMap((p: unknown) => {
      const parsed = record(p) && typeof p.id === 'string' ? parsePublicPlan(p, p.id) : null;
      return parsed ? [parsed] : [];
    })
    .slice(0, 6);
});
export const getSitemapPlanIds = cache(async (): Promise<string[]> => {
  const body = await publicJson('/v1/catalogue/sitemap');
  if (!record(body) || !Array.isArray(body.plans)) return [];
  return body.plans.flatMap((p: unknown) =>
    record(p) && typeof p.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(p.id) ? [p.id] : [],
  );
});

export const getPublicFeaturedBundles = cache(async () => {
  const body = await publicJson('/v1/featured-bundles?currency=USD');
  return record(body) ? parseFeaturedBundles(body.bundles, 'USD') : null;
});
