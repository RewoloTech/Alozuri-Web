import test from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { calculateSellingPrice, profitable, roundRetailUp } from '../src/lib/pricing.js';
import {
  pricePackage,
  validPackagePricing,
  currentCatalogueDate,
} from '../src/lib/package-pricing.js';
import {
  convertPrice,
  priceExchange,
  usableRates,
  type FxRates,
} from '../src/lib/exchange-rates.js';
import { cataloguePlan } from '../src/lib/repository.js';
import { adaptPackage } from '../src/lib/supplier.js';
import { migrationPatch } from '../src/lib/pricing-migration.js';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
const input = {
  ...demoPlans[0],
  demo: false,
  active: true,
  supplierCode: 'private',
  wholesaleUnits: 10000,
  syncedAt: new Date().toISOString(),
};
for (const [units, expected] of [
  [5000, 149],
  [9000, 249],
  [10000, 249],
  [20000, 449],
  [49900, 949],
  [50000, 949],
  [100000, 1699],
  [149900, 2399],
  [150000, 2399],
  [200000, 3099],
  [299900, 4449],
  [300000, 4449],
  [400000, 5699],
])
  test(`tier and boundary cost ${units}/10000 USD sells at ${expected} cents`, () =>
    assert.equal(calculateSellingPrice(units), expected));
test('automatic pricing is monotonic at every supplier unit through $40 and preserves contribution after fees', () => {
  let last = 0;
  for (let units = 1; units <= 400000; units++) {
    const price = calculateSellingPrice(units);
    assert.ok(price >= last, `non-monotonic at ${units}`);
    assert.ok(profitable(units, price));
    assert.ok(price % 100 === 49 || price % 100 === 99);
    last = price;
  }
});
test('rounding retains valid endings and always rounds upwards', () => {
  assert.equal(profitable(70000, 1000), true); // $2.18 contribution after conservative fees.
  assert.equal(profitable(70000, 800), false); // Insufficient contribution after fees.
  assert.equal(profitable(1, 49), false); // Fixed fees and contribution replace the old retail floor.
  for (const [from, to] of [
    [1, 49],
    [49, 49],
    [50, 99],
    [99, 99],
    [100, 149],
    [149, 149],
    [150, 199],
    [199, 199],
    [200, 249],
  ])
    assert.equal(roundRetailUp(from), to);
  for (const bad of [0, -1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => calculateSellingPrice(bad));
});
test('updates preserve overrides, reject unprofitable prices, retain timestamps, and reprice on version/cost changes', () => {
  const a = Timestamp.fromMillis(1000),
    b = Timestamp.fromMillis(2000);
  const first = pricePackage(input, {}, a);
  assert.ok(validPackagePricing(first));
  assert.equal(pricePackage(input, first, b).pricingUpdatedAt, a);
  const increased = pricePackage({ ...input, wholesaleUnits: 20000 }, first, b);
  assert.ok(increased.priceCents > first.priceCents);
  assert.equal(pricePackage(input, increased, b).priceCents, first.priceCents);
  assert.equal(pricePackage(input, { ...first, pricingVersion: 'old' }, b).pricingUpdatedAt, b);
  const override = pricePackage(input, { ...first, priceOverrideUsdCents: 349 }, b);
  assert.equal(override.priceCents, 349);
  assert.ok(validPackagePricing(override));
  const invalid = pricePackage({ ...input, wholesaleUnits: 50000 }, override, b);
  assert.equal(invalid.priceOverrideUsdCents, 349);
  assert.equal(invalid.active, false);
  assert.equal(invalid.pricingStatus, 'review_required');
  assert.equal(validPackagePricing({ ...first, priceCents: 1 }), false);
  assert.equal(validPackagePricing({ ...first, pricingUpdatedAt: 'forged' }), false);
});
test('UTC catalogue dates accept today or yesterday across midnight, and reject older/future or bypassed records', () => {
  const now = Date.parse('2026-11-11T00:01:00Z');
  assert.ok(currentCatalogueDate('2026-11-11', now));
  assert.ok(currentCatalogueDate('2026-11-10', now));
  assert.equal(currentCatalogueDate('2026-11-09', now), false);
  assert.equal(currentCatalogueDate('2026-11-12', now), false);
  const current = pricePackage({ ...input, syncedAt: '2026-11-10T00:01:00Z' });
  assert.ok(cataloguePlan(current, now));
  assert.equal(cataloguePlan({ ...current, catalogueDate: '2026-11-09' }, now), null);
  assert.equal(cataloguePlan({ ...input, catalogueDate: '2026-11-11' }, now), null);
  const publicPlan = cataloguePlan(current, now)!;
  for (const key of [
    'wholesaleUnits',
    'supplierCostUsdCents',
    'sellingPriceUsdCents',
    'priceOverrideUsdCents',
    'pricingVersion',
    'pricingUpdatedAt',
    'pricingStatus',
  ])
    assert.equal(key in publicPlan, false);
});
test('missing/invalid supplier costs and wrong currencies are imported unavailable for review', () => {
  const source = {
    packageCode: 'price-test',
    name: 'France',
    currencyCode: 'USD',
    price: 10000,
    volume: 1073741824,
    duration: 7,
    durationUnit: 'DAY',
    durationType: 1,
    dataType: 1,
    location: 'FR',
    activeType: 2,
  };
  for (const price of [undefined, null, 0, -1, 1.5, '100', NaN, Infinity]) {
    const p = adaptPackage({ ...source, price }, new Date().toISOString());
    assert.ok(p);
    assert.equal(p.active, false);
    assert.equal(p.pricingStatus, 'review_required');
  }
  assert.equal(
    adaptPackage({ ...source, currencyCode: 'EUR' }, new Date().toISOString())!.active,
    false,
  );
});
test('migration preserves metadata/overrides and is idempotent without rewriting historical orders', () => {
  const patch = migrationPatch(input.id, input);
  const migrated = { ...input, ...patch };
  assert.deepEqual(migrationPatch(input.id, migrated), {});
  assert.ok(validPackagePricing(migrated));
  assert.equal(
    migrationPatch(input.id, { ...input, wholesaleUnits: null }).pricingStatus,
    'review_required',
  );
  assert.equal(migrationPatch(input.id, { ...input, currency: 'EUR' }).active, false);
});
test('currency conversion is rational, upward rounded and never relabels USD cents', () => {
  const rates: FxRates = {
    source: 'frankfurter-ecb',
    asOf: new Date().toISOString().slice(0, 10),
    fetchedAt: new Date().toISOString(),
    rates: {
      GBP: { numerator: '75', denominator: '100' },
      EUR: { numerator: '11', denominator: '10' },
    },
  };
  assert.equal(convertPrice(1999, 'GBP', priceExchange('GBP', rates)), 1500);
  assert.equal(convertPrice(1999, 'EUR', priceExchange('EUR', rates)), 2199);
  const lowRate = {
    ...rates,
    rates: { ...rates.rates, GBP: { numerator: '7', denominator: '10' } },
  };
  assert.equal(convertPrice(149, 'GBP', priceExchange('GBP', lowRate)), 105);
  assert.equal(convertPrice(199, 'GBP', priceExchange('GBP', lowRate)), 140);
  assert.equal(convertPrice(1999, 'USD', priceExchange('USD')), 1999);
  assert.throws(() => convertPrice(1999, 'GBP', priceExchange('USD')), /verified exchange/);
  assert.throws(() => priceExchange('EUR'), /required/);
  assert.equal(usableRates({ ...rates, asOf: '2000-01-01' }), null);
  assert.equal(usableRates({ ...rates, asOf: '2999-01-01' }), null);
});

test('public search and plan endpoints convert prices on the server without exposing internal pricing metadata', async () => {
  const { createApp } = await import('../src/app.js');
  const base = cataloguePlan(pricePackage({ ...input, countries: ['FR'] }))!;
  const rates: FxRates = {
    source: 'frankfurter-ecb',
    asOf: new Date().toISOString().slice(0, 10),
    fetchedAt: new Date().toISOString(),
    rates: {
      GBP: { numerator: '75', denominator: '100' },
      EUR: { numerator: '9', denominator: '10' },
    },
  };
  const app = await createApp({
    payments: null,
    commerce: null,
    fulfillment: null,
    repository: { plans: async () => [base], orders: async () => [], order: async () => null },
    exchangeRates: { current: async () => rates },
  });
  try {
    for (const currency of ['GBP', 'EUR'] as const) {
      const r = await app.inject('/v2/search/plans?countries=FR&currency=' + currency);
      assert.equal(r.statusCode, 200);
      assert.equal(r.json().plans[0].currency, currency);
      assert.equal(
        r.json().plans[0].priceCents,
        convertPrice(base.priceCents, currency, priceExchange(currency, rates)),
      );
      const detail = await app.inject('/v1/packages/' + base.id + '?currency=' + currency);
      assert.equal(detail.json().plan.priceCents, r.json().plans[0].priceCents);
      assert.equal(r.body.includes('supplierCostUsdCents'), false);
      assert.equal(detail.body.includes('pricingVersion'), false);
    }
    assert.equal((await app.inject('/v2/search/plans?countries=FR&currency=JPY')).statusCode, 400);
  } finally {
    await app.close();
  }
});
