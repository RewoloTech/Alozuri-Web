import type { Country, DataAllowance, DataFilter, Plan } from './index.ts';

export type PlanSummary = Pick<
  Plan,
  | 'id'
  | 'name'
  | 'countries'
  | 'dataGb'
  | 'days'
  | 'priceCents'
  | 'currency'
  | 'dataType'
  | 'dailyPolicy'
  | 'fairUse'
  | 'demo'
>;
export const SEARCH_SORTS = ['recommended', 'price', 'value', 'data'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];
export type CoverageFilter = 'local' | 'all';
export type SearchFilters = {
  countries: string[];
  minGb: number;
  dataType: DataFilter;
  coverage: CoverageFilter;
  sort: SearchSort;
  pageSize: number;
};
export type SearchPage = {
  plans: PlanSummary[];
  total: number;
  nextCursor: string | null;
  facets: Record<DataAllowance, number>;
  revision: string;
};

const aliases: Record<string, string[]> = {
  GB: ['UK', 'Britain', 'Great Britain', 'United Kingdom'],
  US: ['USA', 'United States of America', 'America'],
  AE: ['UAE', 'Emirates'],
  TR: ['Turkey', 'Türkiye', 'Turkiye'],
  KR: ['South Korea', 'Republic of Korea'],
  CZ: ['Czechia', 'Czech Republic'],
  CI: ['Ivory Coast', 'Côte d’Ivoire', "Cote d'Ivoire"],
  NL: ['Netherlands', 'Holland'],
  MO: ['Macao', 'Macau'],
};
function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
export function filterDestinations(available: Country[], input: string): Country[] {
  const query = normalizeText(input.slice(0, 80));
  if (!query) return available;
  return available.filter((c) =>
    [c.code, c.name, ...(aliases[c.code] || [])].some((name) =>
      normalizeText(name).includes(query),
    ),
  );
}
export function planSummary(plan: Plan): PlanSummary {
  return {
    id: plan.id,
    name: plan.name,
    countries: [...plan.countries],
    dataGb: plan.dataGb,
    days: plan.days,
    priceCents: plan.priceCents,
    currency: plan.currency,
    dataType: plan.dataType,
    ...(plan.dailyPolicy ? { dailyPolicy: plan.dailyPolicy } : {}),
    fairUse: plan.fairUse,
    ...(plan.demo ? { demo: true } : {}),
  };
}
