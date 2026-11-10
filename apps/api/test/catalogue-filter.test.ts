import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptPackage } from '../src/lib/supplier.js';
import { createApp } from '../src/app.js';
const source = {
  packageCode: 'P50',
  name: 'France 50GB',
  price: 10000,
  currencyCode: 'USD',
  volume: 50 * 1073741824,
  duration: 30,
  durationUnit: 'DAY',
  durationType: 1,
  dataType: 1,
  location: 'FR,CH,IT',
  activeType: 2,
};
test('supplier adapter retains 50 GB and maps documented daily policies without claiming full-speed unlimited', () => {
  const at = new Date().toISOString();
  const fixed = adaptPackage(source, at)!;
  assert.equal(fixed.dataGb, 50);
  assert.equal(fixed.providerId, 'esim-access');
  const daily = adaptPackage(
    { ...source, dataType: 2, volume: 2 * 1073741824, duration: 1, fupPolicy: '384 Kbps' },
    at,
  )!;
  assert.equal(daily.dataType, 'daily');
  assert.equal(daily.dailyPolicy, 'reduced');
  assert.match(daily.fairUse, /2 GB high-speed per day.*384 Kbps/);
  assert.equal(adaptPackage({ ...source, dataType: 3 }, at)!.dailyPolicy, 'cutoff');
  const unlimited = adaptPackage(
    {
      ...source,
      name: 'Japan Unlimited-10Mbps 3Days',
      activeType: 3,
      location: 'JP',
      volume: 999 * 1073741824,
      saleNote: 'Not refundable after purchase.',
    },
    at,
  )!;
  assert.equal(unlimited.dataType, 'unlimited');
  assert.match(unlimited.activation, /after purchase/);
  assert.equal(unlimited.supplierNotes, 'Not refundable after purchase.');
  assert.equal(adaptPackage({ ...source, volume: 999 * 1073741824 }, at)!.dataType, 'fixed');
});
test('API applies 50 GB/unlimited filters and rejects unknown filter types', async () => {
  const at = new Date().toISOString();
  const plans = [
    adaptPackage(source, at)!,
    adaptPackage(
      {
        ...source,
        packageCode: 'daily',
        dataType: 2,
        volume: 1073741824,
        duration: 1,
        fupPolicy: '512 Kbps',
      },
      at,
    )!,
    adaptPackage({ ...source, packageCode: 'partial', dataType: 2, location: 'FR,IT' }, at)!,
    adaptPackage({ ...source, packageCode: 'local', location: 'FR' }, at)!,
  ];
  const app = await createApp({
    demo: false,
    payments: null,
    commerce: null,
    fulfillment: null,
    repository: { plans: async () => plans, orders: async () => [], order: async () => null },
  });
  try {
    const local = await app.inject('/v1/packages/match?countries=FR&coverage=local');
    assert.equal(local.statusCode, 200);
    assert.equal(local.json().plans.length, 1);
    assert.ok(local.json().plans.every((p: { countries: string[] }) => p.countries.length === 1));
    const fixed = await app.inject('/v1/packages/match?countries=FR,CH,IT&minGb=50&dataType=fixed');
    assert.equal(fixed.statusCode, 200);
    assert.equal(fixed.json().plans.length, 1);
    assert.equal(fixed.json().plans[0].dataGb, 50);
    const unlimited = await app.inject('/v1/packages/match?countries=FR,CH,IT&dataType=unlimited');
    assert.equal(unlimited.statusCode, 200);
    assert.equal(unlimited.json().plans.length, 1);
    assert.equal(unlimited.json().plans[0].dailyPolicy, 'reduced');
    assert.equal(
      (await app.inject('/v1/packages/match?countries=FR&dataType=fake')).statusCode,
      400,
    );
  } finally {
    await app.close();
  }
});
