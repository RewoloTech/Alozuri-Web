export const FEATURED_REGIONS = ['europe', 'asia', 'north-america', 'global'] as const;
export type FeaturedRegion = (typeof FEATURED_REGIONS)[number];
export const REGION_NAMES: Record<FeaturedRegion, string> = {
  europe: 'Europe',
  asia: 'Asia',
  'north-america': 'North America',
  global: 'Global',
};
export const BUNDLE_ALLOWANCES = [5, 10, 20] as const;
export type BundleAllowance = (typeof BUNDLE_ALLOWANCES)[number];
export type FeaturedOption = {
  productId: string;
  dataGb: BundleAllowance;
  validityDays: number;
  countryCount: number;
  priceCents: number;
  currency: 'USD' | 'GBP' | 'EUR';
};
export type FeaturedBundle = {
  region: FeaturedRegion;
  regionName: string;
  status: 'active' | 'unavailable';
  defaultDataGb: BundleAllowance | null;
  options: FeaturedOption[];
  updatedAt: string | null;
};
export function defaultAllowance(values: readonly number[]): BundleAllowance | null {
  return [10, 20, 5].find((value): value is BundleAllowance => values.includes(value)) ?? null;
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
// Explicit public projection, also used on the SSR boundary. Unknown fields never
// become browser props, even if an upstream response accidentally includes them.
export function parseFeaturedBundles(
  value: unknown,
  expectedCurrency?: FeaturedOption['currency'],
): FeaturedBundle[] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const result: FeaturedBundle[] = [];
  for (const region of FEATURED_REGIONS) {
    const matches = value.filter((row) => record(row) && row.region === region);
    const row = matches[0];
    if (
      matches.length !== 1 ||
      !record(row) ||
      !Array.isArray(row.options) ||
      row.options.length > 3
    )
      return null;
    const options: FeaturedOption[] = [];
    for (const option of row.options) {
      if (
        !record(option) ||
        typeof option.productId !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(option.productId) ||
        (option.dataGb !== 5 && option.dataGb !== 10 && option.dataGb !== 20) ||
        typeof option.validityDays !== 'number' ||
        !Number.isInteger(option.validityDays) ||
        option.validityDays < 30 ||
        typeof option.countryCount !== 'number' ||
        !Number.isInteger(option.countryCount) ||
        option.countryCount < 2 ||
        typeof option.priceCents !== 'number' ||
        !Number.isSafeInteger(option.priceCents) ||
        option.priceCents <= 0 ||
        (option.currency !== 'USD' && option.currency !== 'GBP' && option.currency !== 'EUR') ||
        (expectedCurrency !== undefined && option.currency !== expectedCurrency)
      )
        return null;
      options.push({
        productId: option.productId,
        dataGb: option.dataGb,
        validityDays: option.validityDays,
        countryCount: option.countryCount,
        priceCents: option.priceCents,
        currency: option.currency,
      });
    }
    if (new Set(options.map((o) => o.dataGb)).size !== options.length) return null;
    const preferred = defaultAllowance(options.map((o) => o.dataGb));
    if (
      row.defaultDataGb !== preferred ||
      row.status !== (options.length ? 'active' : 'unavailable')
    )
      return null;
    if (
      row.updatedAt !== null &&
      (typeof row.updatedAt !== 'string' || !Number.isFinite(Date.parse(row.updatedAt)))
    )
      return null;
    result.push({
      region,
      regionName: REGION_NAMES[region],
      status: options.length ? 'active' : 'unavailable',
      defaultDataGb: preferred,
      options,
      updatedAt: row.updatedAt,
    });
  }
  return result;
}
export const unavailableBundles = (): FeaturedBundle[] =>
  FEATURED_REGIONS.map((region) => ({
    region,
    regionName: REGION_NAMES[region],
    status: 'unavailable',
    defaultDataGb: null,
    options: [],
    updatedAt: null,
  }));
