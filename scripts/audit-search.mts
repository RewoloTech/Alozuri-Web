// Read-only catalogue audit. Never creates a payment, supplier order or database write.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { adaptPackage, SupplierClient } from '../apps/api/src/lib/supplier.ts';
import { SearchCatalogue, parseSearchCursor } from '../apps/api/src/lib/search.ts';
import {
  allowanceFilter,
  DATA_ALLOWANCES,
  type Plan,
  type SearchFilters,
} from '../packages/shared/src/index.ts';
const file = process.argv[2];
const raw: unknown[] =
  file === '--live'
    ? await new SupplierClient().packages()
    : JSON.parse(readFileSync(file || '/tmp/alozuri-supplier-catalogue.json', 'utf8'));
const at = new Date().toISOString();
const plans = raw
  .map((p) => adaptPackage(p, at))
  .filter((p): p is NonNullable<typeof p> => p !== null);
const start = performance.now(),
  catalogue = new SearchCatalogue(plans),
  indexMs = performance.now() - start;
function oracle(p: Plan, f: SearchFilters) {
  if (!f.countries.every((c) => p.countries.includes(c))) return false;
  if (f.coverage === 'local' && p.countries.length !== 1) return false;
  if (f.dataType === 'unlimited')
    return p.dataType === 'unlimited' || (p.dataType === 'daily' && p.dailyPolicy === 'reduced');
  if (f.dataType === 'daily') return p.dataType === 'daily' && p.dataGb >= f.minGb;
  return f.minGb > 0 || f.dataType === 'fixed'
    ? p.dataType === 'fixed' && p.dataGb >= f.minGb
    : true;
}
let comparisons = 0;
const timings: number[] = [];
const queries: SearchFilters[] = [];
for (const code of catalogue.countryCodes)
  for (const allowance of DATA_ALLOWANCES)
    for (const coverage of ['local', 'all'] as const) {
      const f = allowanceFilter(allowance);
      queries.push({ countries: [code], ...f, coverage, sort: 'price', pageSize: 12 });
    }
const trips = [
  ['FR', 'CH', 'IT'],
  ['GB', 'FR', 'US'],
  ['JP', 'KR'],
  ['FR', 'MD'],
  ...Array.from({ length: 50 }, (_, i) =>
    catalogue.countryCodes.filter((_, j) => (j + i) % 37 === 0).slice(0, 4),
  ),
];
for (const countries of trips)
  for (const allowance of DATA_ALLOWANCES)
    queries.push({
      countries,
      ...allowanceFilter(allowance),
      coverage: 'all',
      sort: 'price',
      pageSize: 12,
    });
for (const f of queries) {
  const expected = plans
    .filter((p) => oracle(p, f))
    .map((p) => p.id)
    .sort();
  const before = performance.now();
  let page = catalogue.search(f);
  timings.push(performance.now() - before);
  const actual = page.plans.map((p) => p.id);
  while (page.nextCursor) {
    page = catalogue.search(f, parseSearchCursor(page.nextCursor));
    actual.push(...page.plans.map((p) => p.id));
  }
  assert.deepEqual(actual.sort(), expected, JSON.stringify(f));
  comparisons++;
}
timings.sort((a, b) => a - b);
const sample = catalogue.search({
  countries: ['FR'],
  coverage: 'all',
  dataType: 'all',
  minGb: 0,
  sort: 'recommended',
  pageSize: 12,
});
console.log(
  JSON.stringify({
    fetched: raw.length,
    accepted: plans.length,
    countries: catalogue.countryCodes.length,
    independentQueryChecks: comparisons,
    indexBuildMs: Number(indexMs.toFixed(2)),
    warmSearchMedianMs: Number(timings[Math.floor(timings.length * 0.5)].toFixed(3)),
    warmSearchP95Ms: Number(timings[Math.floor(timings.length * 0.95)].toFixed(3)),
    samplePageBytes: Buffer.byteLength(JSON.stringify(sample)),
    samplePageRows: sample.plans.length,
    totalMatches: sample.total,
    privateFieldsExposed:
      JSON.stringify(sample).includes('wholesaleUnits') ||
      JSON.stringify(sample).includes('supplierCode'),
  }),
);
