import test from 'node:test';
import assert from 'node:assert/strict';
import { pricingMovement, pricingHistoryMetadata } from '../src/lib/pricing-history.ts';
import { createApp } from '../src/app.ts';
test('supplier movements preserve exact four-decimal USD amounts and both selling prices', () => {
  const before = { wholesaleUnits: 10001, priceCents: 300, active: true },
    after = { wholesaleUnits: 12001, priceCents: 350, active: true };
  const result = pricingMovement(before, after);
  assert.equal(result.direction, 'increased');
  assert.equal(result.changeBps, 2000);
  assert.equal(result.previousSupplierUnits, 10001);
  assert.equal(result.currentSupplierUnits, 12001);
  assert.equal(result.previousSellingMinor, 300);
  assert.equal(result.currentSellingMinor, 350);
  assert.equal(result.previousMarginBps, 6666);
  assert.equal(result.currentMarginBps, 6571);
  assert.equal(result.marginChangeBps, -95);
  assert.deepEqual(before, { wholesaleUnits: 10001, priceCents: 300, active: true });
});
test('decreases, stable selling prices, baselines and missing prices are distinct', () => {
  assert.equal(
    pricingMovement(
      { wholesaleUnits: 20000, priceCents: 500 },
      { wholesaleUnits: 10000, priceCents: 500 },
    ).changeBps,
    -5000,
  );
  assert.equal(
    pricingMovement({ wholesaleUnits: 20000 }, { wholesaleUnits: 10000 }).direction,
    'decreased',
  );
  assert.equal(
    pricingMovement({ wholesaleUnits: 10000 }, { wholesaleUnits: 10000, active: false }).direction,
    'unchanged',
  );
  const baseline = pricingMovement({}, { wholesaleUnits: 10000, priceCents: 300 });
  assert.equal(baseline.direction, 'baseline');
  assert.equal(baseline.changeBps, null);
  const unavailable = pricingMovement(
    { wholesaleUnits: 10000 },
    { wholesaleUnits: 0, priceCents: 0 },
  );
  assert.equal(unavailable.direction, 'unavailable');
  assert.equal(unavailable.currentMarginBps, null);
});
test('extreme valid integers cannot break the sync or produce unsafe percentages', () => {
  const row = pricingMovement(
    { wholesaleUnits: 1, priceCents: 1 },
    { wholesaleUnits: Number.MAX_SAFE_INTEGER, priceCents: 1 },
  );
  assert.equal(row.direction, 'increased');
  assert.equal(row.changeBps, null);
  assert.equal(row.currentMarginBps, null);
});
test('history metadata freezes only the package label and pricing facts', () => {
  const metadata = pricingHistoryMetadata(
    { id: 'france', name: 'France connection', countries: ['FR'], secret: 'not-public' },
    { wholesaleUnits: 10000, priceCents: 300 },
    { wholesaleUnits: 15000, priceCents: 300, active: false },
  );
  assert.deepEqual(metadata.package, {
    id: 'france',
    name: 'France connection',
    countries: ['FR'],
  });
  assert.equal(metadata.currentMarginBps, 5000);
  assert.equal(metadata.active, false);
  assert.equal(metadata.supplierScale, 10000);
});
test('pricing history API checks the same current administrator permissions before any query', async () => {
  let reads = 0;
  const app = await createApp({
    demo: true,
    payments: null,
    commerce: null,
    fulfillment: null,
    profiles: null,
    financial: null,
    pricingHistory: {
      report: async (input) => {
        reads++;
        return {
          ...input,
          packageId: input.packageId ?? null,
          timezone: 'Europe/London',
          rows: [],
          nextCursor: null,
        };
      },
    },
    verify: async (token) => {
      if (token === 'invalid') throw new Error();
      return { uid: token, verified: token !== 'unverified', admin: token === 'admin' };
    },
  });
  try {
    for (const [token, status] of [
      [null, 401],
      ['invalid', 401],
      ['customer', 403],
      ['unverified', 403],
      ['admin', 200],
    ] as const) {
      const response = await app.inject({
        url: '/v1/operations/pricing-history?from=2026-11-01&to=2026-11-30',
        headers: token ? { authorization: 'Bearer ' + token, 'x-admin': 'true' } : {},
      });
      assert.equal(response.statusCode, status);
      assert.equal(response.headers['cache-control'], 'no-store');
    }
    assert.equal(reads, 1);
    for (const query of ['&packageId=../orders', '&admin=true', '&limit=50000']) {
      const response = await app.inject({
        url: '/v1/operations/pricing-history?from=2026-11-01&to=2026-11-30' + query,
        headers: { authorization: 'Bearer admin' },
      });
      assert.equal(response.statusCode, 400);
    }
    assert.equal(reads, 1);
  } finally {
    await app.close();
  }
});
