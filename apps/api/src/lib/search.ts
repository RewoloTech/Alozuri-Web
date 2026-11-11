import { currencySchema } from './exchange-rates.js';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  allowanceFilter,
  comparePlanValue,
  DATA_ALLOWANCES,
  isCountryCode,
  normalizeCountries,
  planSummary,
  suggestedPlans,
  type DataAllowance,
  type Plan,
  type SearchFilters,
  type SearchPage,
} from '../../../../packages/shared/src/index.ts';
import { planSchema } from './validation.js';
export class SearchError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}
const country = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .refine(isCountryCode);
export const searchQuerySchema = z
  .object({
    currency: currencySchema.default('USD'),
    countries: z
      .string()
      .max(200)
      .transform((s) => normalizeCountries(s.split(',')))
      .pipe(z.array(country).min(1).max(50)),
    minGb: z.coerce.number().finite().min(0).max(10000).default(0),
    dataType: z.enum(['all', 'fixed', 'daily', 'unlimited']).default('all'),
    coverage: z.enum(['local', 'all']).optional(),
    sort: z.enum(['recommended', 'price', 'value', 'data']).default('recommended'),
    pageSize: z.coerce.number().int().min(1).max(48).default(12),
    cursor: z
      .string()
      .min(1)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .strict()
  .transform((input) => {
    // A local-only package cannot cover multiple countries. Discard a stale
    // local flag from older clients instead of silently eliminating every bundle.
    const coverage: SearchFilters['coverage'] =
      input.countries.length > 1 ? 'all' : (input.coverage ?? 'local');
    return { ...input, coverage };
  });
const bookmarkSchema = z
  .object({
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    query: z.string().regex(/^[a-f0-9]{64}$/),
    offset: z.number().int().positive().max(100000),
  })
  .strict();
type Bookmark = z.infer<typeof bookmarkSchema>;
export function parseSearchCursor(cursor: string | undefined): Bookmark | undefined {
  if (!cursor) return;
  try {
    return bookmarkSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
  } catch {
    throw new SearchError('Invalid search page. Start a new search.');
  }
}
const hash = (input: unknown) => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const priceOrder = (a: Plan, b: Plan) =>
  a.priceCents - b.priceCents ||
  a.countries.length - b.countries.length ||
  b.days - a.days ||
  a.id.localeCompare(b.id);
function matchesData(p: Plan, minGb: number, type: SearchFilters['dataType']) {
  if (type === 'unlimited')
    return p.dataType === 'unlimited' || (p.dataType === 'daily' && p.dailyPolicy === 'reduced');
  if (type === 'daily') return p.dataType === 'daily' && p.dataGb >= minGb;
  if (type === 'fixed' || minGb > 0) return p.dataType === 'fixed' && p.dataGb >= minGb;
  return true;
}
export class SearchCatalogue {
  readonly revision: string;
  readonly countryCodes: string[];
  private plans = new Map<string, Plan>();
  private countries = new Map<string, Set<string>>();
  constructor(source: Plan[]) {
    const plans = source.map((p) => planSchema.parse(p)).sort((a, b) => a.id.localeCompare(b.id));
    for (const p of plans) {
      if (this.plans.has(p.id)) throw new Error('Duplicate catalogue product ID.');
      this.plans.set(p.id, p);
      for (const code of new Set(p.countries)) {
        let ids = this.countries.get(code);
        if (!ids) {
          ids = new Set();
          this.countries.set(code, ids);
        }
        ids.add(p.id);
      }
    }
    this.countryCodes = [...this.countries.keys()].filter(isCountryCode).sort();
    this.revision = hash(plans);
  }
  search(filters: SearchFilters, cursor?: Bookmark): SearchPage {
    const normalized = { ...filters, countries: normalizeCountries(filters.countries).sort() };
    const fingerprint = hash(normalized);
    if (cursor && cursor.query !== fingerprint)
      throw new SearchError('Search page does not match these filters. Start a new search.');
    if (cursor && cursor.revision !== this.revision)
      throw new SearchError('The catalogue changed. Refresh your search.', 409);
    const sets = normalized.countries
      .map((c) => this.countries.get(c) || new Set<string>())
      .sort((a, b) => a.size - b.size);
    const covered: Plan[] = [];
    if (sets.length && sets[0].size)
      for (const id of sets[0]) {
        if (!sets.every((s) => s.has(id))) continue;
        const p = this.plans.get(id)!;
        if (normalized.coverage === 'local' && p.countries.length !== 1) continue;
        covered.push(p);
      }
    const facets = Object.fromEntries(
      DATA_ALLOWANCES.map((key: DataAllowance) => {
        const f = allowanceFilter(key);
        return [key, covered.filter((p) => matchesData(p, f.minGb, f.dataType)).length];
      }),
    ) as Record<DataAllowance, number>;
    const candidates = covered.filter((p) => matchesData(p, normalized.minGb, normalized.dataType));
    candidates.sort(
      normalized.sort === 'value'
        ? (a, b) => comparePlanValue(a, b) || priceOrder(a, b)
        : normalized.sort === 'data'
          ? (a, b) =>
              Number(b.dataType === 'unlimited') - Number(a.dataType === 'unlimited') ||
              b.dataGb - a.dataGb ||
              priceOrder(a, b)
          : priceOrder,
    );
    let ordered = candidates;
    if (normalized.sort === 'recommended') {
      const featured = suggestedPlans(candidates, 4);
      const unlimited = candidates.find(
        (p) =>
          p.dataType === 'unlimited' || (p.dataType === 'daily' && p.dailyPolicy === 'reduced'),
      );
      const daily = candidates.find((p) => p.dataType === 'daily' && p.dailyPolicy === 'cutoff');
      const picks = [
        ...new Map(
          [...featured, ...(unlimited ? [unlimited] : []), ...(daily ? [daily] : [])].map((p) => [
            p.id,
            p,
          ]),
        ).values(),
      ];
      const picked = new Set(picks.map((p) => p.id));
      ordered = [...picks, ...candidates.filter((p) => !picked.has(p.id))];
    }
    const offset = cursor?.offset || 0;
    if (offset > ordered.length) throw new SearchError('Invalid search page. Start a new search.');
    const next = offset + normalized.pageSize;
    const nextCursor =
      next < ordered.length
        ? Buffer.from(
            JSON.stringify({ revision: this.revision, query: fingerprint, offset: next }),
          ).toString('base64url')
        : null;
    return {
      plans: ordered.slice(offset, next).map(planSummary),
      total: ordered.length,
      nextCursor,
      facets,
      revision: this.revision,
    };
  }
}
const indexes = new WeakMap<Plan[], SearchCatalogue>();
export function searchCatalogue(source: Plan[]): SearchCatalogue {
  let index = indexes.get(source);
  if (!index) {
    index = new SearchCatalogue(source);
    indexes.set(source, index);
  }
  return index;
}
