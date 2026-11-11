import test from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { catalogueId } from '../src/lib/supplier.ts';
import {
  selectFeaturedBundles,
  bundleCandidate,
  BUNDLE_POLICY,
} from '../src/lib/featured-selection.ts';
import {
  FEATURED_REGIONS,
  defaultAllowance,
  parseFeaturedBundles,
} from '../../../packages/shared/src/featured.ts';
import { createApp } from '../src/app.ts';
import { at, coverage, featuredPlan } from './fixtures/featured.ts';
test('selection publishes real fixed-data options for all four regions, exact validity and cheaper equivalent products', () => {
  const rows = FEATURED_REGIONS.flatMap((region) =>
    [5, 10, 20].map((gb) => featuredPlan(region + gb, coverage[region], gb)),
  );
  rows.push(
    featuredPlan('costly', coverage.europe, 10, 30, 2999),
    featuredPlan('longer', coverage.europe, 10, 31, 1499),
  );
  const result = selectFeaturedBundles(rows, [], 'run1', at);
  for (const row of result) {
    assert.equal(row.status, 'active');
    assert.equal(row.defaultDataGb, 10);
    assert.equal(row.options['10'].productId, catalogueId(row.region + 10));
    assert.equal(Object.keys(row.options).length, 3);
    assert.equal(row.catalogueSyncId, 'run1');
  }
  assert.deepEqual(selectFeaturedBundles([...rows].reverse(), [], 'run1', at), result);
});
test('unavailable regions and missing data options never invent a fallback; 20 GB wins the two-sided default fallback', () => {
  const result = selectFeaturedBundles(
    [featuredPlan('five', coverage.europe, 5), featuredPlan('twenty', coverage.europe, 20)],
    [],
    'run',
    at,
  );
  assert.equal(result[0].defaultDataGb, 20);
  assert.equal(result[1].status, 'unavailable');
  assert.equal(result[1].selectedPlanId, null);
  assert.equal(result[0].options['10'], undefined);
  assert.equal(defaultAllowance([5]), 5);
});
test('invalid pricing, identifiers, geography, expiry, allowance and narrow global products are excluded', () => {
  const good = featuredPlan('good');
  const invalid = [
    { ...good, active: false },
    { ...good, id: 'invented-id' },
    { ...good, dataType: 'daily' },
    { ...good, countries: ['GB', 'FR', 'ZZ'] },
    { ...good, priceCents: 0 },
    { ...good, wholesaleUnits: undefined },
    { ...good, currency: 'EUR' },
    { ...good, days: 29 },
    { ...good, dataGb: 15 },
    { ...good, expiresAt: Timestamp.fromMillis(at.toMillis() - 1) },
    { ...good, catalogueDate: '2000-01-01' },
  ];
  assert.ok(invalid.every((row) => bundleCandidate(row, at.toMillis()) === null));
  const mismatches = [
    { ...featuredPlan('not-europe', coverage.asia), name: 'Europe and Global' },
    featuredPlan('not-global', ['US', 'GB', 'JP']),
  ];
  const result = selectFeaturedBundles(mismatches, [], 'run', at);
  assert.equal(result[0].status, 'unavailable');
  assert.equal(result[3].status, 'unavailable');
});
test('retains suitable products for small price differences and switches at 5%, reprices or replaces unavailable products', () => {
  const old = featuredPlan('old', coverage.europe, 10, 30, 1999);
  const prior = selectFeaturedBundles([old], [], 'old', at);
  const small = featuredPlan('small', coverage.europe, 10, 30, 1949);
  assert.equal(selectFeaturedBundles([old, small], prior, 'next', at)[0].selectedPlanId, old.id);
  const discount = featuredPlan('discount', coverage.europe, 10, 30, 1849);
  assert.equal(
    selectFeaturedBundles([old, discount], prior, 'next', at)[0].selectedPlanId,
    discount.id,
  );
  assert.equal(
    selectFeaturedBundles([{ ...old, active: false }, small], prior, 'next', at)[0].selectedPlanId,
    small.id,
  );
  const raised = featuredPlan('old', coverage.europe, 10, 30, 2499);
  assert.equal(
    selectFeaturedBundles([raised, small], prior, 'next', at)[0].selectedPlanId,
    small.id,
  );
  assert.equal(
    selectFeaturedBundles([old], prior, 'same', at)[0].options['10'].sourceHash,
    prior[0].options['10'].sourceHash,
  );
});
test('material verified extra coverage is configurable and can replace an otherwise equivalent retained option', () => {
  const old = featuredPlan('compact');
  const wider = featuredPlan(
    'wider',
    [...coverage.europe, 'DK', 'FI', 'CZ', 'SK', 'HU'],
    10,
    30,
    2049,
  );
  const prior = selectFeaturedBundles([old], [], 'prior', at);
  assert.equal(selectFeaturedBundles([old, wider], prior, 'next', at)[0].selectedPlanId, wider.id);
  assert.equal(
    selectFeaturedBundles([old, wider], prior, 'next', at, {
      ...BUNDLE_POLICY,
      materialCoverageGainPercent: 100,
    })[0].selectedPlanId,
    old.id,
  );
});
test('a cheaper narrow plan cannot hide a qualifying comparable discount', () => {
  const old = featuredPlan('wide-old', [...coverage.europe, 'DK', 'FI', 'CZ', 'SK']);
  const narrow = featuredPlan('narrow', coverage.europe, 10, 30, 1499);
  const equivalent = featuredPlan('equivalent', old.countries, 10, 30, 1849);
  const prior = selectFeaturedBundles([old], [], 'prior', at);
  assert.equal(
    selectFeaturedBundles([old, narrow, equivalent], prior, 'next', at)[0].selectedPlanId,
    equivalent.id,
  );
});
test('public featured route validates currency before persistence and never exposes private selection data', async () => {
  let reads = 0;
  const api = await createApp({
    repository: {
      plans: async () => {
        throw Error('No catalogue scan');
      },
      orders: async () => [],
      order: async () => null,
    },
    payments: null,
    commerce: null,
    fulfillment: null,
    featured: async () => {
      reads++;
      return FEATURED_REGIONS.map((region) => ({
        region,
        regionName: region,
        supplierCostUsdCents: 123,
        supplierCode: 'private-supplier-code',
        privateSelectionId: 'private-selection-id',
        status: 'unavailable',
        defaultDataGb: null,
        options: [],
        updatedAt: null,
      }));
    },
  });
  try {
    assert.equal((await api.inject('/v1/featured-bundles?currency=BAD')).statusCode, 400);
    assert.equal(reads, 0);
    const response = await api.inject('/v1/featured-bundles?currency=GBP');
    assert.equal(response.statusCode, 200);
    assert.ok(parseFeaturedBundles(response.json().bundles));
    assert.equal(reads, 1);
    assert.ok(!response.body.includes('supplierCode'));
    assert.ok(!response.body.includes('supplierCost'));
    assert.ok(!response.body.includes('privateSelectionId'));
  } finally {
    await api.close();
  }
});

test('an exact five percent discount crosses the switch threshold using integer prices', () => {
  const old = featuredPlan('threshold-old', coverage.europe, 10, 30, 2000),
    previous = selectFeaturedBundles([old], [], 'old', at);
  const almost = featuredPlan('threshold-almost', coverage.europe, 10, 30, 1901),
    exact = featuredPlan('threshold-exact', coverage.europe, 10, 30, 1900);
  assert.equal(selectFeaturedBundles([old, almost], previous, 'new', at)[0].selectedPlanId, old.id);
  assert.equal(
    selectFeaturedBundles([old, exact], previous, 'new', at)[0].selectedPlanId,
    exact.id,
  );
});
