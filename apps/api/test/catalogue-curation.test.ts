import test from 'node:test';
import assert from 'node:assert/strict';
import { curateCatalogue } from '../src/lib/catalogue-curation.js';
import { pricePackage, validPackagePricing } from '../src/lib/package-pricing.js';
import {
  estimatedContribution,
  PRICING_POLICY,
  profitable,
  calculateSellingPrice,
} from '../src/lib/pricing.js';
import { cataloguePlan } from '../src/lib/repository.js';

import { supplierFixture } from './fixtures/catalogue.js';

test('US examples distinguish 500 MB, choose the cheapest equivalent and retain faster service at the same price', () => {
  const source = [
    supplierFixture({
      packageCode: 'half',
      name: 'United States 500MB/Day (USIP)',
      volume: 524288000,
      price: 4700,
      supportTopUpType: 1,
    }),
    supplierFixture({ packageCode: 'one-usip', name: 'United States 1GB/Day (USIP)', price: 7800 }),
    supplierFixture({ packageCode: 'one', price: 7500 }),
    supplierFixture({
      packageCode: 'fast',
      name: 'United States 1GB/Day FUP1Mbps',
      price: 8000,
      fupPolicy: '1 Mbps',
    }),
    supplierFixture({
      packageCode: 'half-expensive',
      volume: 524288000,
      price: 8600,
      supportTopUpType: 1,
    }),
  ];
  const rows = curateCatalogue(source),
    visible = rows.filter((p) => p.catalogueVisibility === 'public');
  assert.equal(source[0].dataGb, 500 / 1024);
  assert.equal(source[0].name, 'United States 500MB/Day');
  assert.equal(source[0].supplierName, 'United States 500MB/Day (USIP)');
  assert.equal(source[0].supplierComparison?.attributes.ipExport, 'US');
  assert.equal(rows[0].priceCents, 149);
  assert.equal(rows[3].priceCents, 199);
  assert.deepEqual(
    visible.map((p) => p.id),
    [source[0].id, source[3].id],
  );
  assert.equal(rows[1].catalogueDecision, 'equivalent_higher_cost');
  assert.equal(rows[1].replacedBy, source[3].id); // Resolve replacement chains to a visible SKU.
  assert.equal(rows[2].catalogueDecision, 'inferior_at_price');
  assert.equal(rows[4].replacedBy, source[0].id);
  for (const p of rows) {
    assert.ok(validPackagePricing(p));
    assert.ok(profitable(p.wholesaleUnits, p.priceCents));
  }
  assert.equal(cataloguePlan(rows[1]), null);
  const publicPlan = cataloguePlan(rows[3])!;
  for (const field of [
    'supplierComparison',
    'supplierName',
    'pricingFlags',
    'catalogueDecision',
    'replacedBy',
    'wholesaleUnits',
  ])
    assert.equal(field in publicPlan, false);
  assert.match(publicPlan.fairUse, /1 Mbps/);
});

test('different routing, networks, activation, expiry, restrictions, geography and unknown fields never merge', () => {
  for (const patch of [
    { ipExport: 'HK' },
    { speed: '3G/4G' },
    { activeType: 1 },
    { unusedValidTime: 30 },
    { cancelPolicy: 1 },
    { saleNote: 'No tethering' },
    { smsStatus: 0 },
    { name: 'United States 1GB/Day Business' },
    { description: 'A product restriction' },
    { location: 'US,CA' },
    { duration: 7 },
    { dataType: 3 },
    { newSupplierRestriction: 'restricted' },
    {
      locationNetworkList: [
        { locationCode: 'US', operatorList: [{ operatorName: 'T-Mobile', networkType: '5G' }] },
      ],
    },
  ]) {
    const rows = curateCatalogue([
      supplierFixture(),
      supplierFixture({ packageCode: 'different', ...patch }),
    ]);
    assert.equal(
      rows.filter((p) => p.catalogueVisibility === 'public').length,
      2,
      JSON.stringify(patch),
    );
  }
  const ambiguous = supplierFixture({ packageCode: 'unknown', ipExport: undefined });
  assert.equal(ambiguous.supplierComparison, undefined);
  assert.ok(ambiguous.pricingFlags?.includes('comparison_incomplete'));
  assert.equal(
    curateCatalogue([supplierFixture(), ambiguous]).filter(
      (p) => p.catalogueVisibility === 'public',
    ).length,
    2,
  );
});

test('normalised order is stable and supplier identities remain distinct after curation', () => {
  const a = supplierFixture({ packageCode: 'a' }),
    b = supplierFixture({
      packageCode: 'b',
      price: 7800,
      locationNetworkList: [
        {
          operatorList: [
            { networkType: '5G', operatorName: 'AT&T' },
            { networkType: '5G', operatorName: 'Verizon' },
          ],
          locationCode: 'US',
        },
      ],
    });
  const summary = (plans: ReturnType<typeof curateCatalogue>) =>
    plans.map((p) => [p.id, p.catalogueVisibility, p.replacedBy]).sort();
  assert.deepEqual(summary(curateCatalogue([a, b])), summary(curateCatalogue([b, a])));
  assert.equal(curateCatalogue([a, b])[1].supplierCode, 'b');
  const ordered = curateCatalogue([
    supplierFixture({ packageCode: 'sequence-a', unknownRules: ['first', 'second'] }),
    supplierFixture({ packageCode: 'sequence-b', unknownRules: ['second', 'first'] }),
  ]);
  assert.equal(ordered.filter((p) => p.catalogueVisibility === 'public').length, 2);
});

test('value discounts remain profitable, preserve checkout price and recompute on supplier changes', () => {
  const a = supplierFixture({ packageCode: 'small', volume: 1073741824, price: 7500 }),
    b = supplierFixture({ packageCode: 'large', volume: 2147483648, price: 8000 });
  const priced = curateCatalogue([a, b]);
  assert.equal(priced[0].catalogueVisibility, 'hidden'); // $1.49 would not meet minimum contribution.
  const cheaper = supplierFixture({ packageCode: 'small-cheap', volume: 1073741824, price: 6000 });
  const expensive = supplierFixture({
    packageCode: 'large-cheap',
    volume: 2147483648,
    price: 7500,
  });
  const discounted = curateCatalogue([cheaper, expensive]);
  assert.ok(discounted[0].priceCents < discounted[1].priceCents);
  assert.ok(validPackagePricing(discounted[0]));
  assert.equal(pricePackage(cheaper, discounted[0]).priceCents, discounted[0].priceCents);
  const more = pricePackage({ ...cheaper, wholesaleUnits: 30000 }, discounted[0]);
  assert.ok(more.priceCents > discounted[0].priceCents);
  assert.ok(more.pricingFlags?.includes('supplier_cost_increase'));
});

test('fees, zero data, small-cost hysteresis and invalid money fail safely', () => {
  assert.equal(calculateSellingPrice(4700), 149);
  assert.equal(calculateSellingPrice(7500), 199);
  assert.equal(estimatedContribution(4700, 149), 64);
  assert.equal(estimatedContribution(8000, 199), 78);
  assert.ok(
    estimatedContribution(4700, 149, PRICING_POLICY.fees[0]) > estimatedContribution(4700, 149),
  );
  assert.equal(supplierFixture({ volume: 0 }).active, false);
  const ambiguous = supplierFixture({ dataType: 1, name: 'Unlimited', volume: 999 * 1073741824 });
  assert.equal(ambiguous.active, false);
  assert.ok(ambiguous.pricingFlags?.includes('allowance_classification_ambiguous'));
  const initial = supplierFixture({ price: 7800 });
  const stable = pricePackage({ ...initial, wholesaleUnits: 8000 }, initial);
  assert.equal(stable.priceCents, initial.priceCents);
  assert.ok(validPackagePricing(stable));
  assert.equal(profitable(7500, 149), false);
  for (const units of [0, -1, NaN, Infinity, 1.5])
    assert.throws(() => calculateSellingPrice(units));
});
