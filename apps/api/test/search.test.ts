import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SearchCatalogue,
  parseSearchCursor,
  searchQuerySchema,
  searchCatalogue,
} from '../src/lib/search.js';
import { platformProxyTrust } from '../src/lib/proxy.js';
import { createApp } from '../src/app.js';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
import { type Plan, type SearchFilters } from '../../../packages/shared/src/index.ts';
const base: Plan = { ...demoPlans[0], demo: false, countries: ['FR', 'CH', 'IT'] };
const plans: Plan[] = [
  ...Array.from({ length: 25 }, (_, i) => ({
    ...base,
    id: 'fixed-' + String(i).padStart(2, '0'),
    dataGb: i + 1,
    priceCents: 100 + i,
  })),
  { ...base, id: 'fifty', dataGb: 50 },
  { ...base, id: 'daily', dataGb: 2, dataType: 'daily', dailyPolicy: 'reduced' },
  { ...base, id: 'cutoff', dataGb: 3, dataType: 'daily', dailyPolicy: 'cutoff' },
  { ...base, id: 'unlimited', dataGb: 999, dataType: 'unlimited' },
  { ...base, id: 'partial', countries: ['FR', 'IT'], dataType: 'unlimited' },
  { ...base, id: 'local', countries: ['FR'], dataGb: 50 },
];
const filters: SearchFilters = {
  countries: ['FR', 'CH', 'IT'],
  coverage: 'all',
  minGb: 0,
  dataType: 'all',
  sort: 'price',
  pageSize: 12,
};
test('indexed search intersects every country and keeps local, daily, unlimited and fixed semantics distinct', () => {
  const c = new SearchCatalogue(plans);
  assert.equal(c.search(filters).total, 29);
  assert.deepEqual(
    c.search({ ...filters, minGb: 50, dataType: 'fixed' }).plans.map((p) => p.id),
    ['fifty'],
  );
  assert.deepEqual(
    new Set(c.search({ ...filters, dataType: 'unlimited' }).plans.map((p) => p.id)),
    new Set(['daily', 'unlimited']),
  );
  const local = c.search({ ...filters, countries: ['FR'], coverage: 'local' });
  assert.equal(local.total, 1);
  assert.equal(local.plans[0].id, 'local');
  assert.equal(c.search({ ...filters, countries: ['MD'] }).total, 0);
  assert.equal(c.search({ ...filters, countries: [] }).total, 0);
  assert.deepEqual(
    c.search({ ...filters, countries: ['IT', 'FR', 'CH', 'FR'] }).plans,
    c.search(filters).plans,
  );
  assert.equal(local.facets['50'], 1);
  assert.equal(local.facets.unlimited, 0);
});
test('pagination returns every match exactly once with stable global ordering and bounded summaries', () => {
  const c = new SearchCatalogue(plans);
  let page = c.search(filters);
  const all = [...page.plans];
  while (page.nextCursor) {
    page = c.search(filters, parseSearchCursor(page.nextCursor));
    all.push(...page.plans);
  }
  assert.equal(all.length, 29);
  assert.equal(new Set(all.map((p) => p.id)).size, 29);
  assert.ok(all.every((p, i) => !i || all[i - 1].priceCents <= p.priceCents));
  for (const p of all)
    for (const field of [
      'wholesaleUnits',
      'supplierCode',
      'activation',
      'networks',
      'supplierNotes',
      'syncedAt',
    ])
      assert.equal(field in p, false);
  const first = c.search(filters);
  assert.equal(first.plans.length, 12);
  assert.ok(first.nextCursor);
  assert.throws(
    () => c.search({ ...filters, dataType: 'unlimited' }, parseSearchCursor(first.nextCursor!)),
    /does not match/,
  );
  const changed = new SearchCatalogue(plans.map((p) => ({ ...p, priceCents: p.priceCents + 1 })));
  assert.throws(
    () => changed.search(filters, parseSearchCursor(first.nextCursor!)),
    /catalogue changed/,
  );
  assert.throws(() => parseSearchCursor('eyJiYWQiOiJwYWdlIn0'), /Invalid search page/);
  assert.equal(searchCatalogue(plans), searchCatalogue(plans));
});
test('recommended results never hide products sharing a GB size and do not leak private provider data', () => {
  const two = [
    { ...base, id: 'a', supplierCode: 'private', wholesaleUnits: 1 },
    { ...base, id: 'b', priceCents: base.priceCents + 1 },
  ];
  const page = new SearchCatalogue(two).search({ ...filters, sort: 'recommended' });
  assert.deepEqual(new Set(page.plans.map((p) => p.id)), new Set(['a', 'b']));
  assert.equal(JSON.stringify(page).includes('private'), false);
  assert.equal(page.total, 2);
  assert.equal(page.nextCursor, null);
});
test('search validation rejects injection, repeated values, excessive pages and arbitrary sorts before catalogue access', async () => {
  let reads = 0;
  const app = await createApp({
    payments: null,
    commerce: null,
    fulfillment: null,
    repository: {
      plans: async () => {
        reads++;
        return plans;
      },
      orders: async () => [],
      order: async () => null,
    },
  });
  try {
    for (const query of [
      'countries[$ne]=FR',
      'countries=FR&sort=__proto__',
      'countries=FR&providerId=private',
      'countries=FR&pageSize=100000',
      'countries=FR&minGb=Infinity',
      'countries=FR&minGb=-1',
      'countries=FR&cursor=***',
      'countries=FR&cursor=eyJiYWQiOiJwYWdlIn0',
      'countries=FR&sort=price&sort=data',
      'countries=' + 'FR,'.repeat(100),
    ])
      assert.equal((await app.inject('/v2/search/plans?' + query)).statusCode, 400, query);
    assert.equal(reads, 0);
    const good = await app.inject(
      '/v2/search/plans?countries=FR,CH,IT&coverage=all&pageSize=12&sort=price',
    );
    assert.equal(good.statusCode, 200);
    assert.equal(good.json().total, 29);
    assert.equal(good.json().plans.length, 12);
    assert.equal(good.headers['cache-control'], 'no-store');
    const next = await app.inject(
      '/v2/search/plans?countries=FR,CH,IT&coverage=all&pageSize=12&sort=price&cursor=' +
        good.json().nextCursor,
    );
    assert.equal(next.statusCode, 200);
    assert.notEqual(next.json().plans[0].id, good.json().plans[0].id);
  } finally {
    await app.close();
  }
  assert.deepEqual(searchQuerySchema.parse({ countries: 'fr, CH,fr' }).countries, ['FR', 'CH']);
});
test('only the immediate private platform peer is trusted; forged earlier proxy hops do not bypass search limits', async () => {
  const trust = platformProxyTrust(true);
  assert.equal(trust('169.254.1.1', 0), true);
  assert.equal(trust('169.254.1.1', 1), false);
  assert.equal(trust('198.51.100.1', 0), false);
  assert.equal(platformProxyTrust(false)('127.0.0.1', 0), false);
  const app = await createApp({
    trustPlatformProxy: true,
    payments: null,
    commerce: null,
    fulfillment: null,
    repository: { plans: async () => plans, orders: async () => [], order: async () => null },
  });
  try {
    for (let i = 0; i < 60; i++)
      assert.equal(
        (
          await app.inject({
            url: '/v2/search/plans?countries=FR',
            headers: { 'x-forwarded-for': `192.0.2.${i},203.0.113.10` },
          })
        ).statusCode,
        200,
      );
    assert.equal(
      (
        await app.inject({
          url: '/v2/search/plans?countries=FR',
          headers: { 'x-forwarded-for': '192.0.2.250,203.0.113.10' },
        })
      ).statusCode,
      429,
    );
    assert.equal(
      (
        await app.inject({
          url: '/v2/search/plans?countries=FR',
          headers: { 'x-forwarded-for': '192.0.2.250,203.0.113.11' },
        })
      ).statusCode,
      200,
    );
  } finally {
    await app.close();
  }
});

test('multi-country requests include regional/global coverage by default without broadening single-country searches', () => {
  const multi = searchQuerySchema.parse({ countries: 'FR,CH,IT' });
  assert.equal(multi.coverage, 'all');
  const result = new SearchCatalogue(plans).search(multi);
  assert.equal(result.total, 29);
  assert.ok(
    result.plans.every((p) => ['FR', 'CH', 'IT'].every((code) => p.countries.includes(code))),
  );
  assert.equal(searchQuerySchema.parse({ countries: 'FR' }).coverage, 'local');
  assert.equal(searchQuerySchema.parse({ countries: 'FR,FR' }).coverage, 'local');
  assert.equal(searchQuerySchema.parse({ countries: 'FR,CH', coverage: 'local' }).coverage, 'all');
});

test('European and global bundles are both returned when each covers every selected country', () => {
  const rows = [
    { ...base, id: 'europe', name: 'Europe', countries: ['FR', 'DE', 'IT'] },
    { ...base, id: 'global', name: 'Global', countries: ['FR', 'DE', 'US', 'GB'] },
    { ...base, id: 'partial', name: 'Partial coverage', countries: ['FR', 'US'] },
  ];
  const result = new SearchCatalogue(rows).search(searchQuerySchema.parse({ countries: 'FR,DE' }));
  assert.deepEqual(new Set(result.plans.map((plan) => plan.id)), new Set(['europe', 'global']));
});
