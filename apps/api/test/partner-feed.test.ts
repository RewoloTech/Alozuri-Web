import test from 'node:test';
import assert from 'node:assert/strict';
import { partnerFeed, structuredFairUse } from '../src/lib/partner-feed.js';
import { createApp } from '../src/app.js';
import { supplierFixture } from './fixtures/catalogue.js';
const now = Date.now();
const fixed = {
  ...supplierFixture({ dataType: 1, name: 'US 1GB', duration: 30 }),
  id: 'us-fixed',
  syncedAt: new Date(now).toISOString(),
};
const daily = { ...supplierFixture(), id: 'us-daily', syncedAt: fixed.syncedAt };
test('structured fair-use fields preserve verified daily caps and speeds without guessing unknown policies', () => {
  assert.deepEqual(structuredFairUse(daily), {
    capMb: 1024,
    resetPeriod: 'day',
    speedAfter: '512 Kbps',
  });
  assert.deepEqual(
    structuredFairUse({
      ...daily,
      dataGb: 500 / 1024,
      fairUse: '500 MB high-speed per day, then reduced speed (512 Kbps).',
    }),
    { capMb: 500, resetPeriod: 'day', speedAfter: '512 Kbps' },
  );
  assert.equal(structuredFairUse({ ...daily, fairUse: 'Policy not available' }), null);
  assert.equal(structuredFairUse({ ...daily, dataGb: 9 }), null);
  assert.equal(structuredFairUse({ ...daily, dataType: 'unlimited' }), null);
});
test('partner feed uses retail prices, stable IDs and verified coverage without supplier data', () => {
  const feed = partnerFeed([fixed, daily], 'catalogue', now);
  const json = JSON.stringify(feed);
  assert.ok(!/wholesale|supplierCode|packageCode|providerProductId/.test(json));
  assert.ok('provider' in feed);
  const p = feed.plans.find((p) => 'externalId' in p && p.externalId === fixed.id);
  assert.ok(p && 'price' in p && 'checkoutUrl' in p);
  assert.equal(p.price, (fixed.priceCents / 100).toFixed(2));
  assert.equal(p.checkoutUrl, 'https://alozuri.com/plans/us-fixed');
  const d = feed.plans.find((p) => 'externalId' in p && p.externalId === daily.id);
  assert.ok(d && 'dataMb' in d && 'dailyDataMb' in d);
  assert.equal(d.dataMb, null);
  assert.equal(d.dailyDataMb, 1024);
  assert.equal(partnerFeed([daily, fixed], 'catalogue', now).revision, feed.revision);
  assert.notEqual(
    partnerFeed([{ ...fixed, priceCents: fixed.priceCents + 1 }, daily], 'catalogue', now).revision,
    feed.revision,
  );
});
test('feed excludes demo, stale and future plans; narrow formats omit incompatible plans', () => {
  const feed = partnerFeed(
    [
      fixed,
      daily,
      { ...fixed, id: 'demo', demo: true },
      { ...fixed, id: 'stale', syncedAt: new Date(now - 37 * 3600000).toISOString() },
      { ...fixed, id: 'future', syncedAt: new Date(now + 1).toISOString() },
    ],
    'inbox',
    now,
  );
  assert.equal(feed.plans.length, 1);
  const multi = { ...fixed, id: 'multi', countries: ['US', 'CA'] };
  assert.equal(partnerFeed([fixed, multi], 'inbox', now).plans.length, 1);
  assert.equal(partnerFeed([fixed, daily, multi], 'rating', now).plans.length, 2);
  assert.throws(() => partnerFeed([], 'catalogue', now));
  assert.throws(() => partnerFeed([fixed, fixed], 'catalogue', now));
});
test('public feed refuses preview mode and unknown query parameters', async () => {
  const app = await createApp({ demo: true, payments: null, commerce: null, fulfillment: null });
  try {
    assert.equal((await app.inject('/v1/catalogue/feed')).statusCode, 503);
    assert.equal((await app.inject('/v1/catalogue/feed?format=secret')).statusCode, 400);
    assert.equal((await app.inject('/v1/catalogue/feed?wholesale=true')).statusCode, 400);
  } finally {
    await app.close();
  }
});

test('live feed follows refreshed retail catalogue and emits no internal fields', async () => {
  let plans = [fixed];
  const app = await createApp({
    demo: false,
    repository: { plans: async () => plans, orders: async () => [], order: async () => null },
    payments: null,
    commerce: null,
    fulfillment: null,
  });
  try {
    const first = await app.inject('/v1/catalogue/feed');
    assert.equal(first.statusCode, 200);
    assert.equal(first.headers['cache-control'], 'no-store');
    assert.equal(first.json().plans[0].price, (fixed.priceCents / 100).toFixed(2));
    plans = [{ ...fixed, priceCents: fixed.priceCents + 17 }];
    const next = await app.inject('/v1/catalogue/feed');
    assert.equal(next.statusCode, 200);
    assert.notEqual(next.json().revision, first.json().revision);
    assert.equal(next.json().plans[0].price, (plans[0].priceCents / 100).toFixed(2));
    plans = [];
    assert.equal((await app.inject('/v1/catalogue/feed')).statusCode, 503);
  } finally {
    await app.close();
  }
});
