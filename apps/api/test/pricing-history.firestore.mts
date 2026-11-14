import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { syncCatalogue } from '../src/lib/catalogue-sync.ts';
import { PricingHistoryReports, pricingHistoryMetadata } from '../src/lib/pricing-history.ts';
import type { CatalogueProvider } from '../src/lib/catalogue-provider.ts';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8188');
const app = initializeApp({ projectId: 'demo-alozuri' }, 'pricing-history-test'),
  db = getFirestore(app, 'pricing-history-tests');
const report = new PricingHistoryReports(db);
test('daily sync reuses existing history, freezes labels, preserves repeated intraday changes and retirement', async () => {
  let units = 10000,
    retire = false;
  const provider: CatalogueProvider = {
    id: 'esim-access',
    fetch: async (at) => ({
      fetched: retire ? 1 : 2,
      plans: [
        {
          ...demoPlans[0],
          id: 'history-primary',
          name: 'Original Europe label',
          countries: ['FR', 'IT'],
          providerId: 'esim-access',
          supplierCode: 'history-primary',
          wholesaleUnits: units,
          active: true,
          demo: false,
          syncedAt: at,
        },
        ...(!retire
          ? [
              {
                ...demoPlans[0],
                id: 'history-retired',
                name: 'Retired country',
                countries: ['JP'],
                providerId: 'esim-access',
                supplierCode: 'history-retired',
                wholesaleUnits: 20000,
                active: true,
                demo: false,
                syncedAt: at,
              },
            ]
          : []),
      ],
    }),
  };
  await syncCatalogue(provider, db);
  const ref = db.doc('packages/history-primary');
  const initial = await ref.collection('pricingHistory').get();
  assert.equal(initial.size, 1);
  assert.equal(initial.docs[0].get('package.name'), 'Original Europe label');
  assert.equal(initial.docs[0].get('direction'), 'baseline');
  assert.equal((await syncCatalogue(provider, db)).written, 0);
  assert.equal((await ref.collection('pricingHistory').get()).size, 1);
  for (const price of [20000, 10000, 20000]) {
    units = price;
    await syncCatalogue(provider, db);
  }
  const changed = await ref.collection('pricingHistory').get();
  assert.equal(changed.size, 4);
  assert.equal(changed.docs.filter((d) => d.get('direction') === 'increased').length, 2);
  assert.equal(changed.docs.filter((d) => d.get('direction') === 'decreased').length, 1);
  retire = true;
  await syncCatalogue(provider, db);
  const retired = await db.doc('packages/history-retired').get();
  assert.equal(retired.get('active'), false);
  const retirement = await retired.ref
    .collection('pricingHistory')
    .orderBy('recordedAt', 'desc')
    .limit(1)
    .get();
  assert.equal(retirement.docs[0].get('active'), false);
  assert.equal(retirement.docs[0].get('direction'), 'unchanged');
  await ref.delete();
  const history = await report.report({
    from: '2020-01-01',
    to: '2030-01-01',
    packageId: 'history-primary',
  });
  assert.equal(history.rows.length, 4);
  assert.ok(
    history.rows.every(
      (r) => r.name === 'Original Europe label' && r.identitySource === 'snapshot',
    ),
  );
});
test('collection-group history paginates precisely through equal timestamps and scopes package/date cursors', async () => {
  const stamp = new Timestamp(Date.parse('2025-02-15T12:00:00Z') / 1000, 123456789);
  const before = { wholesaleUnits: 10000, priceCents: 300, active: true },
    after = { wholesaleUnits: 12500, priceCents: 300, active: true };
  for (let i = 0; i < 31; i++)
    await db.doc(`packages/history-pages/pricingHistory/p_${String(i).padStart(3, '0')}`).set({
      before,
      after,
      recordedAt: stamp,
      ...pricingHistoryMetadata(
        { id: 'history-pages', name: 'France price trend', countries: ['FR'] },
        before,
        after,
      ),
    });
  const first = await report.report({ from: '2025-02-15', to: '2025-02-15' });
  assert.equal(first.rows.length, 25);
  assert.ok(first.nextCursor);
  const second = await report.report({
    from: '2025-02-15',
    to: '2025-02-15',
    cursor: first.nextCursor!,
  });
  assert.equal(first.rows.length + second.rows.length, 31);
  assert.equal(new Set([...first.rows, ...second.rows].map((r) => r.id)).size, 31);
  assert.equal(second.nextCursor, null);
  const scoped = await report.report({
    from: '2025-02-15',
    to: '2025-02-15',
    packageId: 'history-pages',
  });
  assert.ok(scoped.nextCursor);
  const scopedNext = await report.report({
    from: '2025-02-15',
    to: '2025-02-15',
    packageId: 'history-pages',
    cursor: scoped.nextCursor!,
  });
  assert.equal(scoped.rows.length + scopedNext.rows.length, 31);
  assert.equal(new Set([...scoped.rows, ...scopedNext.rows].map((r) => r.id)).size, 31);

  assert.ok(first.rows.every((r) => r.changeBps === 2500));
  await assert.rejects(
    report.report({ from: '2025-02-14', to: '2025-02-15', cursor: first.nextCursor! }),
  );
  await assert.rejects(
    report.report({
      from: '2025-02-15',
      to: '2025-02-15',
      packageId: 'history-pages',
      cursor: first.nextCursor!,
    }),
  );
  const empty = await report.report({ from: '2025-02-16', to: '2025-02-16' });
  assert.equal(empty.rows.length, 0);
});
test('old audit records use explicitly labelled current metadata or retain their identifier after deletion', async () => {
  const parent = db.doc('packages/history-legacy');
  await parent.set({ name: 'Current name', countries: ['GB'] });
  await parent
    .collection('pricingHistory')
    .doc('old')
    .set({
      before: { wholesaleUnits: 10000, priceCents: 300 },
      after: { wholesaleUnits: 10000, priceCents: 350 },
      recordedAt: Timestamp.fromDate(new Date('2025-01-01T12:00:00Z')),
    });
  let result = await report.report({ from: '2025-01-01', to: '2025-01-01', packageId: parent.id });
  assert.equal(result.rows[0].identitySource, 'current_catalogue');
  assert.equal(result.rows[0].name, 'Current name');
  assert.equal(result.rows[0].direction, 'unchanged');
  await parent.delete();
  result = await report.report({ from: '2025-01-01', to: '2025-01-01', packageId: parent.id });
  assert.equal(result.rows[0].identitySource, 'unavailable');
  assert.equal(result.rows[0].name, parent.id);
});
test('search finds matching historical labels beyond the visible page with scoped continuations and a bounded scan', async () => {
  const before = { wholesaleUnits: 10000, priceCents: 300 },
    after = { wholesaleUnits: 11000, priceCents: 300 };
  const batch = db.batch();
  for (let i = 0; i < 261; i++) {
    const target = i === 0;
    batch.set(
      db.doc(`packages/search-bounded/pricingHistory/entry_${String(i).padStart(3, '0')}`),
      {
        before,
        after,
        recordedAt: Timestamp.fromDate(new Date(Date.parse('2024-05-01T12:00:00Z') + i * 1000)),
        ...pricingHistoryMetadata(
          {
            id: 'search-bounded',
            name: target ? 'Retired United Kingdom plan' : 'Japan connection',
            countries: target ? ['GB'] : ['JP'],
          },
          before,
          after,
        ),
      },
    );
  }
  await batch.commit();
  const input = { from: '2024-05-01', to: '2024-05-01', q: 'united kingdom' };
  const first = await report.report(input);
  assert.equal(first.query, input.q);
  assert.equal(first.rows.length, 0);
  assert.ok(first.nextCursor);
  const next = await report.report({ ...input, cursor: first.nextCursor! });
  assert.equal(next.rows.length, 1);
  assert.equal(next.rows[0].name, 'Retired United Kingdom plan');
  assert.equal(next.nextCursor, null);
  await assert.rejects(
    report.report({ ...input, q: 'Japan', cursor: first.nextCursor! }),
    /selection changed/,
  );
  const country = await report.report({ ...input, q: 'UK' });
  const found = await report.report({ ...input, q: 'UK', cursor: country.nextCursor! });
  assert.equal(found.rows[0].packageId, 'search-bounded');
  const noMatch = await report.report({
    from: '2024-05-02',
    to: '2024-05-02',
    q: 'United Kingdom',
  });
  assert.equal(noMatch.rows.length, 0);
  assert.equal(noMatch.nextCursor, null);
});
test.after(async () => {
  await deleteApp(app);
});
