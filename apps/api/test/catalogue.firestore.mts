import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { syncCatalogue } from '../src/lib/catalogue-sync.ts';
import type { CatalogueProvider } from '../src/lib/catalogue-provider.ts';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
import type { StoredPlan } from '../../../packages/shared/src/index.ts';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8188');
const app = initializeApp({ projectId: 'demo-alozuri' }, 'catalogue-test');
const db = getFirestore(app, 'catalogue-tests');
const plan = (id: string, providerId = 'esim-access'): StoredPlan => ({
  ...demoPlans[0],
  id,
  demo: false,
  active: true,
  providerId,
  supplierCode: id,
  wholesaleUnits: 1000,
});
test('provider-scoped sync preserves other suppliers, retires missing products and stores allowance metadata', async () => {
  await db.doc('packages/legacy').set({ ...plan('legacy'), providerId: null });
  await db.doc('packages/other').set(plan('other', 'second-provider'));
  const provider: CatalogueProvider = {
    id: 'esim-access',
    fetch: async (at) => ({
      fetched: 2,
      plans: [
        { ...plan('daily'), dataType: 'daily', dailyPolicy: 'reduced', syncedAt: at },
        { ...plan('fifty'), dataGb: 50, syncedAt: at },
      ],
    }),
  };
  const result = await syncCatalogue(provider, db);
  assert.equal(result.active, 2);
  assert.equal((await db.doc('packages/legacy').get()).get('active'), false);
  assert.equal((await db.doc('packages/other').get()).get('active'), true);
  assert.equal((await db.doc('packages/daily').get()).get('dailyPolicy'), 'reduced');
  assert.equal((await db.doc('packages/fifty').get()).get('dataGb'), 50);
  assert.equal((await db.doc('catalogueSync/esim-access').get()).get('status'), 'complete');
});
test('failed, empty or colliding provider results preserve the catalogue', async () => {
  await assert.rejects(
    syncCatalogue({ id: 'esim-access', fetch: async () => ({ fetched: 0, plans: [] }) }, db),
    /preserved/,
  );
  await assert.rejects(
    syncCatalogue(
      {
        id: 'second-provider',
        fetch: async () => ({ fetched: 1, plans: [plan('fifty', 'second-provider')] }),
      },
      db,
    ),
    /collision/,
  );
  assert.equal((await db.doc('packages/fifty').get()).get('providerId'), 'esim-access');
  assert.equal((await db.doc('packages/other').get()).get('active'), true);
  assert.equal((await db.doc('catalogueSync/esim-access').get()).get('status'), 'failed');
});
test('a held sync lease prevents concurrent fetches for the same provider', async () => {
  await db.doc('catalogueSync/esim-access').set({ leaseUntil: Date.now() + 60000 });
  let fetched = false;
  await assert.rejects(
    syncCatalogue(
      {
        id: 'esim-access',
        fetch: async () => {
          fetched = true;
          return { fetched: 0, plans: [] };
        },
      },
      db,
    ),
    /already running/,
  );
  assert.equal(fetched, false);
});
test.after(async () => {
  await db.terminate();
  await deleteApp(app);
});

test('imports reprice cost changes, preserve profitable overrides, date packages and skip duplicate package writes', async () => {
  let units = 10000;
  const provider: CatalogueProvider = {
    id: 'pricing-provider',
    fetch: async (at) => ({
      fetched: 1,
      plans: [
        { ...plan('pricing-package', 'pricing-provider'), wholesaleUnits: units, syncedAt: at },
      ],
    }),
  };
  await syncCatalogue(provider, db);
  const ref = db.doc('packages/pricing-package');
  const first = await ref.get();
  assert.equal(first.get('priceCents'), 249);
  assert.equal(first.get('catalogueDate'), new Date().toISOString().slice(0, 10));
  const duplicate = await syncCatalogue(provider, db);
  assert.equal(duplicate.written, 0);
  assert.ok((await ref.get()).updateTime!.isEqual(first.updateTime!));
  units = 20000;
  await syncCatalogue(provider, db);
  assert.equal((await ref.get()).get('priceCents'), 449);
  units = 10000;
  await syncCatalogue(provider, db);
  assert.equal((await ref.get()).get('priceCents'), 249);
  await ref.update({ priceOverrideUsdCents: 349 });
  await syncCatalogue(provider, db);
  assert.equal((await ref.get()).get('priceCents'), 349);
  units = 50000;
  const review = await syncCatalogue(provider, db);
  assert.equal(review.active, 0);
  assert.equal(review.reviewRequired, 1);
  assert.equal((await ref.get()).get('priceOverrideUsdCents'), 349);
  assert.equal((await ref.get()).get('active'), false);
});

test('pricing migration dry-run changes nothing, apply backs up once and a second apply is a no-op', async () => {
  const { migratePricing } = await import('../src/lib/pricing-migration.ts');
  const { PRICING_VERSION } = await import('../src/lib/pricing.ts');
  const ref = db.doc('packages/migration-test');
  await ref.set({
    ...plan('migration-test'),
    syncedAt: new Date().toISOString(),
    wholesaleUnits: 20000,
  });
  const before = await ref.get();
  const preview = await migratePricing(db);
  assert.ok(preview.changed > 0);
  assert.ok((await ref.get()).updateTime!.isEqual(before.updateTime!));
  await migratePricing(db, true);
  assert.equal((await ref.get()).get('priceCents'), 449);
  const backup = await db.doc(`pricingMigrations/${PRICING_VERSION}/packages/migration-test`).get();
  assert.equal(backup.get('before').priceCents, before.get('priceCents'));
  assert.equal((await migratePricing(db, true)).changed, 0);
  assert.ok(
    (
      await db.doc(`pricingMigrations/${PRICING_VERSION}/packages/migration-test`).get()
    ).updateTime!.isEqual(backup.updateTime!),
  );
  assert.equal((await db.doc('packages/other').get()).get('providerId'), 'second-provider');
});

test('exchange rates persist across instances, refresh after TTL and fail closed when no usable fallback remains', async () => {
  const { ExchangeRates } = await import('../src/lib/exchange-rates.ts');
  let now = Date.now(),
    calls = 0,
    failed = false;
  const fetchRates = async () => {
    calls++;
    if (failed) throw new Error('provider unavailable');
    return {
      source: 'frankfurter-ecb' as const,
      asOf: new Date(now).toISOString().slice(0, 10),
      fetchedAt: new Date(now).toISOString(),
      rates: {
        GBP: { numerator: '75', denominator: '100' },
        EUR: { numerator: '9', denominator: '10' },
      },
    };
  };
  await db.doc('exchangeRates/USD').delete();
  const rates = new ExchangeRates(db, fetchRates, () => now);
  await rates.current();
  await rates.current();
  await new ExchangeRates(db, fetchRates, () => now).current();
  assert.equal(calls, 1);
  now += 3600001;
  await rates.current();
  assert.equal(calls, 2);
  failed = true;
  now += 3600001;
  assert.ok(await rates.current());
  now += 8 * 86400000;
  await assert.rejects(rates.current(), /temporarily unavailable/);
});

test('source metadata removal is persisted without losing overrides or unrelated owner metadata', async () => {
  let daily = true;
  const provider: CatalogueProvider = {
    id: 'source-metadata',
    fetch: async (at) => ({
      fetched: 1,
      plans: [
        {
          ...plan('source-metadata-package', 'source-metadata'),
          syncedAt: at,
          ...(daily
            ? {
                dataType: 'daily' as const,
                dailyPolicy: 'reduced' as const,
                supplierNotes: 'Former conditions',
              }
            : { dataType: 'fixed' as const }),
        },
      ],
    }),
  };
  await syncCatalogue(provider, db);
  const ref = db.doc('packages/source-metadata-package');
  await ref.update({ ownerTag: 'keep', priceOverrideUsdCents: 349 });
  daily = false;
  await syncCatalogue(provider, db);
  const fresh = await ref.get();
  assert.equal(fresh.get('dailyPolicy'), undefined);
  assert.equal(fresh.get('supplierNotes'), undefined);
  assert.equal(fresh.get('ownerTag'), 'keep');
  assert.equal(fresh.get('priceOverrideUsdCents'), 349);
  assert.equal((await syncCatalogue(provider, db)).written, 0);
});

test('curated sync keeps supplier variants, is idempotent, audits decisions and uses the exact selected SKU at checkout', async (t) => {
  const db = getFirestore(app, 'curation-checkout-tests');
  t.after(() => db.terminate());
  const { supplierFixture } = await import('./fixtures/catalogue.ts');
  const { priceCart } = await import('../src/lib/commerce.ts');
  const { cataloguePlan } = await import('../src/lib/repository.ts');
  let halfCost = 4700;
  const base = [
    supplierFixture({
      packageCode: 'curated-half',
      volume: 524288000,
      price: halfCost,
      supportTopUpType: 1,
    }),
    supplierFixture({ packageCode: 'curated-one', price: 7500 }),
    supplierFixture({ packageCode: 'curated-duplicate', price: 7800 }),
    supplierFixture({ packageCode: 'curated-fast', price: 8000, fupPolicy: '1 Mbps' }),
  ];
  const provider: CatalogueProvider = {
    id: 'esim-access',
    fetch: async (syncedAt) => ({
      fetched: base.length,
      plans: base.map((p, i) => ({
        ...p,
        providerId: 'esim-access',
        syncedAt,
        wholesaleUnits: i === 0 ? halfCost : p.wholesaleUnits,
      })),
    }),
  };
  const result = await syncCatalogue(provider, db);
  assert.equal(result.active, 2);
  assert.equal(result.hidden, 2);
  const refs = base.map((p) => db.doc('packages/' + p.id));
  const first = await db.getAll(...refs);
  assert.equal(first[0].get('priceCents'), 149);
  assert.equal(first[3].get('priceCents'), 199);
  assert.equal(first[2].get('supplierCode'), 'curated-duplicate');
  assert.equal(first[2].get('catalogueVisibility'), 'hidden');
  assert.equal(first[2].get('replacedBy'), base[3].id);
  assert.equal(cataloguePlan(first[2].data()), null);
  assert.equal((await refs[0].collection('pricingHistory').get()).size, 1);
  const { storedPlanSchema } = await import('../src/lib/validation.ts');
  const { z } = await import('zod');
  const load = async (id: string) =>
    storedPlanSchema
      .extend({
        supplierCode: z.string().min(1),
        wholesaleUnits: z.number().int().positive(),
      })
      .passthrough()
      .parse((await db.doc('packages/' + id).get()).data());
  const quote = await priceCart([{ planId: base[0].id, quantity: 1 }], load);
  assert.equal(quote.quote.totalCents, 149);
  assert.equal(quote.snapshots[0].supplierCode, 'curated-half');
  assert.equal(quote.snapshots[0].wholesaleUnits, 4700);
  await assert.rejects(priceCart([{ planId: base[2].id, quantity: 1 }], load), /unavailable/);
  assert.equal((await syncCatalogue(provider, db)).written, 0);
  assert.ok((await refs[0].get()).updateTime!.isEqual(first[0].updateTime!));
  assert.equal((await refs[0].collection('pricingHistory').get()).size, 1);
  halfCost = 20000;
  await syncCatalogue(provider, db);
  const changed = await refs[0].get();
  assert.ok(changed.get('priceCents') > 149);
  assert.ok(changed.get('pricingFlags').includes('supplier_cost_increase'));
  assert.equal((await refs[0].collection('pricingHistory').get()).size, 2);
  assert.equal((await syncCatalogue(provider, db)).written, 0);
});
