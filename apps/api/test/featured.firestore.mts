import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FEATURED_REGIONS } from '../../../packages/shared/src/featured.ts';
import { coverage, featuredPlan } from './fixtures/featured.ts';
import { syncCatalogue } from '../src/lib/catalogue-sync.ts';
import { FeaturedReader, publishFeaturedBundles } from '../src/lib/featured-bundles.ts';
import { bundleCandidate } from '../src/lib/featured-selection.ts';
import { convertPrice, priceExchange, type FxRates } from '../src/lib/exchange-rates.ts';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8188');
const app = initializeApp({ projectId: 'demo-alozuri' }, 'featured-tests'),
  db = getFirestore(app);
const source = FEATURED_REGIONS.flatMap((region) =>
  [5, 10, 20].map((gb) => featuredPlan(region + gb, coverage[region], gb)),
);
let fetched = 0;
const provider = {
  id: 'esim-access',
  fetch: async (syncedAt: string) => {
    fetched++;
    return { fetched: source.length, plans: source.map((plan) => ({ ...plan, syncedAt })) };
  },
};
test.before(async () => {
  await fetch(
    'http://127.0.0.1:8188/emulator/v1/projects/demo-alozuri/databases/(default)/documents',
    { method: 'DELETE' },
  );
});
test.after(async () => {
  await db.terminate();
  await deleteApp(app);
});
test('daily sync publishes four coherent references after pricing, and repeated generation is idempotent', async () => {
  await syncCatalogue(provider, db);
  const state = await db.doc('catalogueSync/esim-access').get(),
    docs = await db.collection('featured_bundles').get();
  assert.equal(state.get('status'), 'complete');
  assert.equal(docs.size, 4);
  for (const doc of docs.docs) {
    assert.equal(doc.get('catalogueSyncId'), state.get('runId'));
    assert.equal(doc.get('status'), 'active');
    const product = await db.doc('packages/' + doc.get('selectedPlanId')).get();
    assert.equal(doc.get('options.10.sourceHash'), bundleCandidate(product.data())?.sourceHash);
    assert.equal(product.get('priceCents'), product.get('sellingPriceUsdCents'));
  }
  const plans = (await db.collection('packages').get()).docs.map((doc) => doc.data());
  assert.equal(await publishFeaturedBundles(db, plans, state.get('runId'), state.ref), 0);
  const after = await db.collection('featured_bundles').get();
  for (const old of docs.docs)
    assert.ok(after.docs.find((doc) => doc.id === old.id)!.updateTime.isEqual(old.updateTime));
});
test('public bundle reads use precomputed references, existing exchange rates and no supplier fetch or private fields', async () => {
  const rates: FxRates = {
    source: 'frankfurter-ecb',
    asOf: new Date().toISOString().slice(0, 10),
    fetchedAt: new Date().toISOString(),
    rates: {
      GBP: { numerator: '8', denominator: '10' },
      EUR: { numerator: '11', denominator: '10' },
    },
  };
  const reader = new FeaturedReader(db, { current: async () => rates }),
    before = fetched;
  const usd = await reader.read('USD'),
    gbp = await reader.read('GBP'),
    eur = await reader.read('EUR');
  assert.equal(usd.length, 4);
  assert.equal(fetched, before);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++) {
      assert.equal(
        gbp[i].options[j].priceCents,
        convertPrice(usd[i].options[j].priceCents, 'GBP', priceExchange('GBP', rates)),
      );
      assert.equal(
        eur[i].options[j].priceCents,
        convertPrice(usd[i].options[j].priceCents, 'EUR', priceExchange('EUR', rates)),
      );
    }
  for (const secret of [
    'supplierCode',
    'wholesaleUnits',
    'supplierCost',
    'sourceHash',
    'pricingVersion',
  ])
    assert.ok(!JSON.stringify(usd).includes(secret));
  const direct = await fetch(
    'http://127.0.0.1:8188/v1/projects/demo-alozuri/databases/(default)/documents/featured_bundles/europe',
  );
  assert.equal(direct.status, 403);
});
test('the next supplier sync rebuilds derived bundles with the same authoritative catalogue prices', async () => {
  const previousState = await db.doc('catalogueSync/esim-access').get();
  const before = await new FeaturedReader(db).read('USD');
  const previousPrice = before[0].options.find((option) => option.dataGb === 10)?.priceCents;
  await syncCatalogue(
    {
      id: provider.id,
      fetch: async (syncedAt: string) => {
        const result = await provider.fetch(syncedAt);
        return {
          ...result,
          plans: result.plans.map((plan) =>
            plan.id === source[1].id ? { ...plan, wholesaleUnits: 50000 } : plan,
          ),
        };
      },
    },
    db,
  );
  const state = await db.doc('catalogueSync/esim-access').get();
  assert.notEqual(state.get('runId'), previousState.get('runId'));
  const published = await db.collection('featured_bundles').get();
  for (const doc of published.docs) assert.equal(doc.get('catalogueSyncId'), state.get('runId'));
  const product = await db.doc('packages/' + source[1].id).get();
  const after = await new FeaturedReader(db).read('USD');
  const option = after[0].options.find((row) => row.dataGb === 10);
  assert.ok(option);
  assert.equal(option.productId, product.id);
  assert.equal(option.priceCents, product.get('sellingPriceUsdCents'));
  assert.notEqual(option.priceCents, previousPrice);
});
test('failed sync and interrupted/source-mismatched publication preserve the previous complete snapshot', async () => {
  const before = await db.collection('featured_bundles').get();
  await assert.rejects(
    syncCatalogue(
      {
        id: 'esim-access',
        fetch: async () => {
          throw new Error('Supplier unavailable');
        },
      },
      db,
    ),
    /Supplier unavailable/,
  );
  let after = await db.collection('featured_bundles').get();
  for (const old of before.docs)
    assert.ok(after.docs.find((doc) => doc.id === old.id)!.updateTime.isEqual(old.updateTime));
  await syncCatalogue(provider, db);
  const state = await db.doc('catalogueSync/esim-access').get(),
    plans = (await db.collection('packages').get()).docs.map((doc) => doc.data());
  const published = await db.collection('featured_bundles').get();
  await db.doc('packages/' + source[1].id).update({ active: false });
  await assert.rejects(
    publishFeaturedBundles(db, plans, state.get('runId'), state.ref),
    /source changed/,
  );
  after = await db.collection('featured_bundles').get();
  for (const old of published.docs)
    assert.ok(after.docs.find((doc) => doc.id === old.id)!.updateTime.isEqual(old.updateTime));
});
test('unavailable or changed-price referenced plans are omitted without inventing an option or trusting stale snapshot prices', async () => {
  const reader = new FeaturedReader(db),
    rows = await reader.read('USD');
  assert.equal(
    rows[0].options.some((option) => option.dataGb === 10),
    false,
  );
  assert.equal(rows[0].defaultDataGb, 20);
  const ref = db.doc('packages/' + source[0].id);
  await ref.update({ priceCents: 1 });
  reader.invalidate();
  const changed = await reader.read('USD');
  assert.equal(
    changed[0].options.some((option) => option.dataGb === 5),
    false,
  );
  const malicious = await fetch(
    'http://127.0.0.1:8188/v1/projects/demo-alozuri/databases/(default)/documents/featured_bundles/europe',
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { status: { stringValue: 'active' } } }),
    },
  );
  assert.equal(malicious.status, 403);
});
