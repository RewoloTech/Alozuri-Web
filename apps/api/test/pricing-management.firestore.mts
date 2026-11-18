import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
import { PricingManagement, applyPricing } from '../src/lib/pricing-management.ts';
import { syncCatalogue } from '../src/lib/catalogue-sync.ts';
import { pricePackage, validPackagePricing } from '../src/lib/package-pricing.ts';
import { ExchangeRates } from '../src/lib/exchange-rates.ts';
import { createApp } from '../src/app.ts';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8188');
const app = initializeApp({ projectId: 'demo-alozuri' }, 'pricing-management');
const db = getFirestore(app, 'pricing-management-test');
test.after(async () => {
  await db.terminate();
  await deleteApp(app);
});
test('save, simulate, publish, replay, daily import and rollback using current costs and historical FX', async () => {
  let cost = 50000;
  const products = ['ng', 'ci', 'za'];
  const provider = {
    id: 'esim-access',
    fetch: async (at: string) => ({
      fetched: products.length,
      plans: products.map((id) =>
        pricePackage({
          ...demoPlans[0],
          id,
          providerId: 'esim-access',
          name: id + ' 1GB',
          countries: [id.toUpperCase()],
          wholesaleUnits: cost,
          supplierCode: id,
          active: true,
          demo: false,
          syncedAt: at,
        }),
      ),
    }),
  };
  await syncCatalogue(provider, db);
  const now = new Date();
  const rates = new ExchangeRates(db, async () => ({
    source: 'frankfurter-ecb',
    asOf: now.toISOString().slice(0, 10),
    fetchedAt: now.toISOString(),
    rates: {
      GBP: { numerator: '75', denominator: '100' },
      EUR: { numerator: '9', denominator: '10' },
    },
  }));
  const service = new PricingManagement(db, rates),
    first = await service.workspace();
  const config = first.config,
    ref = db.doc('packages/ng');
  config.countries.NG = { profile: 'competitive', settings: {}, active: true };
  config.benchmarks.ng = {
    competitor: 'Example',
    packageName: 'Nigeria 1GB',
    allowance: '1GB',
    validity: '7 days',
    amount: 450,
    currency: 'GBP',
    url: 'https://example.test/ng',
    checked: now.toISOString().slice(0, 10),
  };
  const draft = await service.save(first.revision, config, 'admin');
  assert.equal((await ref.get()).get('priceCents'), 949);
  await assert.rejects(service.save(first.revision, config, 'another-admin'), /changed/);
  const preview = await service.preview(draft.revision),
    row = preview.rows.find((r) => r.id === 'ng')!;
  assert.equal(row.competitor, 600);
  assert.ok(row.affected && row.safe && row.proposed < 949);
  assert.deepEqual(
    preview.rows.filter((p) => p.affected).map((p) => p.id),
    ['ng'],
  );
  await assert.rejects(service.publish(draft.revision, 'invalid', 'admin'), /changed/);
  const version = await service.publish(draft.revision, preview.token, 'admin');
  await applyPricing(version, db, () => syncCatalogue(provider, db));
  await applyPricing(version, db, async () => {
    throw new Error('duplicate sync');
  });
  const published = await ref.get();
  assert.equal(published.get('priceCents'), row.proposed);
  assert.ok(validPackagePricing(published.data()!));
  const records = await ref.collection('pricingHistory').get();
  assert.ok(
    records.docs.some(
      (d) => d.get('configurationVersion') === version && d.get('pricingAdministrator') === 'admin',
    ),
  );
  cost = 80000;
  await syncCatalogue(provider, db);
  const updated = await ref.get();
  assert.ok(updated.get('priceCents') > row.proposed);
  assert.equal(updated.get('wholesaleUnits'), 80000);
  const rollback = await service.save(version, 'global', 'admin');
  const back = await service.preview(rollback.revision);
  assert.ok(back.rows.find((r) => r.id === 'ng')!.proposed > 949);
  const v2 = await service.publish(rollback.revision, back.token, 'admin');
  await applyPricing(v2, db, () => syncCatalogue(provider, db));
  const restored = await ref.get();
  assert.equal(restored.get('managedPricing'), undefined);
  assert.ok(validPackagePricing(restored.data()!));
  assert.equal(restored.get('wholesaleUnits'), 80000);
  assert.equal((await service.workspace()).job, 'complete');
  assert.equal((await service.workspace()).versions.length, 2);
  await applyPricing(version, db, async () => {
    throw new Error('obsolete sync');
  });
  const impossible = (await service.workspace()).config;
  impossible.countries.NG = {
    profile: 'custom',
    active: true,
    settings: { minimumContributionCents: 99999999 },
  };
  const unsafe = await service.save(v2, impossible, 'admin');
  const unavailable = unsafe.rows.find((r) => r.id === 'ng')!;
  assert.equal(unavailable.eligible, false);
  assert.equal(unavailable.margin, null);
  await assert.rejects(service.publish(unsafe.revision, unsafe.token, 'admin'), /unsafe/);
  await service.writeDraft(unsafe.revision, 'admin', null, 'cancel');
  assert.equal((await ref.get()).get('priceCents'), restored.get('priceCents'));
});
test('every management endpoint rejects guests, regular accounts and unverified administrators', async () => {
  const api = await createApp({
    demo: true,
    verify: async (token: string) => ({
      uid: 'test',
      admin: token === 'unverified',
      verified: token === 'customer',
    }),
  });
  try {
    for (const action of [
      'workspace',
      'draft',
      'cancel',
      'rollback',
      'publish',
      'retry',
      'preview',
    ]) {
      for (const token of ['', 'customer', 'unverified']) {
        const response = await api.inject({
          method: action === 'workspace' ? 'GET' : 'POST',
          url: '/v1/operations/pricing-management/' + action,
          headers: token ? { authorization: 'Bearer ' + token } : {},
        });
        assert.equal(response.statusCode, token ? 403 : 401);
      }
    }
    assert.equal(
      (
        await api.inject({
          method: 'POST',
          url: '/internal/pricing/apply',
          payload: { version: crypto.randomUUID() },
        })
      ).statusCode,
      401,
    );
  } finally {
    await api.close();
  }
});

test('supplier revalidation uses the public price during rollout and the managed price after its batch commits', async () => {
  const { currentCheckoutPlan } = await import('../src/lib/payments.ts');
  const { adaptPackage } = await import('../src/lib/supplier.ts');
  const { PricingHistoryReports } = await import('../src/lib/pricing-history.ts');
  const isolated = getFirestore(app, 'pricing-checkout-test');
  const offer = {
    packageCode: 'ng-fixture',
    name: 'Nigeria 1GB',
    price: 50000,
    currencyCode: 'USD',
    volume: 1073741824,
    duration: 7,
    durationUnit: 'DAY',
    durationType: 1,
    dataType: 1,
    location: 'NG',
    activeType: 2,
  };
  const supplier = { packages: async () => [offer] };
  const provider = {
    id: 'esim-access',
    fetch: async (at: string) => ({ fetched: 1, plans: [adaptPackage(offer, at)!] }),
  };
  try {
    await syncCatalogue(provider, isolated);
    const id = adaptPackage(offer, new Date().toISOString())!.id;
    const service = new PricingManagement(isolated),
      w = await service.workspace();
    w.config.countries.NG = { active: true, profile: 'competitive', settings: {} };
    const saved = await service.save(w.revision, w.config, 'admin');
    const version = await service.publish(saved.revision, saved.token, 'admin');
    assert.equal((await currentCheckoutPlan(id, supplier, isolated)).priceCents, 949);
    await applyPricing(version, isolated, () => syncCatalogue(provider, isolated));
    assert.equal(
      (await currentCheckoutPlan(id, supplier, isolated)).priceCents,
      saved.rows[0].proposed,
    );
    const day = new Date().toISOString().slice(0, 10);
    const history = await new PricingHistoryReports(isolated).report({
      from: day,
      to: day,
      version,
    });
    assert.ok(history.rows.length && history.rows.every((r) => r.configurationVersion === version));
    assert.equal(history.rows[0].rule?.profile, 'competitive');
    assert.equal(history.rows[0].targetCents, 75);
    offer.price = 85000;
    await assert.rejects(currentCheckoutPlan(id, supplier, isolated), /changed/i);
    const updated = await currentCheckoutPlan(id, supplier, isolated);
    assert.ok(updated.priceCents > saved.rows[0].proposed && validPackagePricing(updated));
  } finally {
    await isolated.terminate();
  }
});
