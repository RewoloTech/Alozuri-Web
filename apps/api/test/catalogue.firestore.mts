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
