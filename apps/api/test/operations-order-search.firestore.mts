import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { OperationsEsims } from '../src/lib/operations-esims.ts';
import { EsimUsageService } from '../src/lib/usage.ts';
import { customerReference } from '../src/lib/operations-order-search.ts';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8188');
const app = initializeApp({ projectId: 'demo-alozuri' }, 'order-search-tests'),
  db = getFirestore(app);
let serial = 0,
  supplierReads = 0;
const reports = new OperationsEsims(
  db,
  new EsimUsageService(db, {
    usage: async (_order, transaction) => {
      supplierReads++;
      return {
        kind: 'fixed',
        usedBytes: 0,
        totalBytes: 1073741824,
        remainingBytes: 1073741824,
        profileStatus: 'GOT_RESOURCE',
        smdpStatus: 'INSTALLATION',
        esimTranNo: transaction,
        expiresAt: null,
        checkedAt: new Date().toISOString(),
      };
    },
  }),
);
async function purchase(email: string, supplierOrderNo?: string) {
  const n = ++serial,
    hex = 'c0' + n.toString(16).padStart(14, '0') + '0'.repeat(32);
  const ref = db.doc('purchases/purchase_' + hex),
    uid = 'owner-' + n;
  const plan = {
    name: 'United Kingdom 1GB',
    countries: ['GB'],
    priceCents: 1500,
    currency: 'GBP',
    dataType: 'fixed',
    supplier: 'esimaccess',
    supplierName: 'Original supplier product name',
  };
  await ref.set({
    uid,
    email,
    createdAt: '2026-11-13T12:00:00.000Z',
    paidAt: '2026-11-13T12:00:01.000Z',
    status: 'paid',
    test: false,
    totalCents: 3000,
    currency: 'GBP',
    items: [{ quantity: 2, wholesaleUnits: 5000, plan }],
  });
  const units = [];
  for (let j = 0; j < 2; j++) {
    const unit = db.doc('orders/order_' + (n * 2 + j).toString(16).padStart(48, '0'));
    await unit.set({
      uid,
      test: false,
      parentOrderId: ref.id,
      createdAt: '2026-11-13T12:00:00.000Z',
      paidAt: '2026-11-13T12:00:01.000Z',
      status: 'ready',
      plan,
      amountCents: 1500,
      currency: 'GBP',
      supplierCode: 'GB_FIXTURE',
      supplierOrderNo: supplierOrderNo ?? 'B-' + n,
    });
    await db.doc('orderActivations/' + unit.id).set({
      uid,
      esimTranNo: '261113' + (n * 2 + j).toString().padStart(8, '0'),
      ac: 'PRIVATE-QR-CREDENTIAL',
      iccid: 'PRIVATE-ICCID',
    });
    units.push(unit);
  }
  return { ref, units };
}
test('email search paginates server-side, normalizes input and never calls the supplier', async () => {
  for (let i = 0; i < 23; i++) await purchase('search-pagination@example.test');
  const first = await reports.search({ q: ' SEARCH-PAGINATION@EXAMPLE.TEST ' });
  assert.equal(first.rows.length, 10);
  assert.equal(first.rows[0].esims.length, 2);
  assert.equal(first.rows[0].esims[0].supplier.name, 'eSIM Access');
  assert.ok(first.rows[0].esims[0].esimTranNo);
  assert.ok(!JSON.stringify(first.rows).includes('PRIVATE'));
  assert.ok(first.nextCursor);
  const second = await reports.search({ q: first.query, cursor: first.nextCursor });
  assert.equal(second.rows.length, 10);
  assert.ok(second.nextCursor);
  const third = await reports.search({ q: first.query, cursor: second.nextCursor });
  assert.equal(third.rows.length, 3);
  assert.equal(third.nextCursor, null);
  assert.equal(new Set([...first.rows, ...second.rows, ...third.rows].map((r) => r.id)).size, 23);
  assert.equal(supplierReads, 0);
  await assert.rejects(
    reports.search({ q: 'other@example.test', cursor: first.nextCursor }),
    /Search changed/,
  );
  await assert.rejects(reports.search({ q: first.query, cursor: 'bad-cursor' }), /Invalid/);
});
test('supplier number search deduplicates multiple eSIMs across page boundaries', async () => {
  for (let i = 0; i < 14; i++) await purchase('supplier-page@example.test', 'B-COMMON-SEARCH');
  const first = await reports.search({ q: 'B-COMMON-SEARCH' });
  assert.equal(first.rows.length, 10);
  assert.ok(first.nextCursor);
  const second = await reports.search({ q: first.query, cursor: first.nextCursor });
  assert.equal(second.rows.length, 4);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.rows, ...second.rows].map((r) => r.id)).size, 14);
  assert.equal(supplierReads, 0);
});
test('stored and historic references, transaction numbers and full details preserve original order facts', async () => {
  const f = await purchase('detail-search@example.test');
  const original = customerReference(await f.ref.get());
  assert.equal((await reports.search({ q: original })).rows[0].id, f.ref.id);
  await f.ref.update({ orderReference: 'AZ-261113-K7M4Q2' });
  assert.equal(
    (await reports.search({ q: 'az-261113-k7m4q2' })).rows[0].reference,
    'AZ-261113-K7M4Q2',
  );
  const number = (await db.doc('orderActivations/' + f.units[0].id).get()).get('esimTranNo');
  const results = await reports.search({ q: number });
  assert.equal(results.rows[0].id, f.ref.id);
  assert.equal(supplierReads, 0);
  const detail = await reports.details(results.rows[0].id);
  assert.equal(detail.reference, 'AZ-261113-K7M4Q2');
  assert.equal(detail.createdAt, '2026-11-13T12:00:00.000Z');
  assert.equal(detail.email, 'detail-search@example.test');
  assert.equal(detail.amountMinor, 3000);
  assert.equal(detail.currency, 'GBP');
  assert.equal(detail.fulfilmentStatus, 'fulfilled');
  assert.equal(detail.units.length, 2);
  assert.equal(detail.units[0].amountMinor, 1500);
  assert.equal(detail.units[0].supplier.name, 'eSIM Access');
  assert.ok(!JSON.stringify(detail).includes('PRIVATE'));
  await f.units[1].update({
    supplierId: 'another_vendor',
    supplierDisplayName: 'Another Supplier',
  });
  assert.equal((await reports.details(f.ref.id)).units[1].supplier.name, 'Another Supplier');
  await f.units[1].update({ supplierOrderNo: 'az-vendor-mixedCase' });
  const providerRow = (await reports.search({ q: 'az-vendor-mixedCase' })).rows[0];
  assert.equal(providerRow.esims[0].supplier.name, 'eSIM Access');
  assert.equal(providerRow.esims[1].supplier.name, 'Another Supplier');
  assert.ok(providerRow.esims[1].esimTranNo);
  assert.equal((await reports.search({ q: 'az-vendor-mixedCase' })).rows[0].id, f.ref.id);
  assert.equal((await reports.search({ q: 'AZ-VENDOR-MIXEDCASE' })).rows.length, 0);
  await f.units[0].update({ status: 'fulfilling' });
  await f.units[1].update({ status: 'provision_wait' });
  assert.equal((await reports.details(f.ref.id)).fulfilmentStatus, 'fulfilling');
});
test('legacy orders, empty results and coincident supplier references return each customer order once', async () => {
  const legacy = db.doc('orders/order_' + 'b'.repeat(48));
  await legacy.set({
    uid: 'legacy-owner',
    test: false,
    email: 'legacy-search@example.test',
    createdAt: '2026-11-13T11:00:00.000Z',
    status: 'paid',
    amountCents: 500,
    currency: 'EUR',
    supplierOrderNo: 'B-LEGACY-SEARCH',
    plan: { name: 'Legacy plan' },
  });
  assert.equal((await reports.search({ q: 'legacy-search@example.test' })).rows[0].id, legacy.id);
  assert.equal((await reports.search({ q: 'B-LEGACY-SEARCH' })).rows[0].currency, 'EUR');
  assert.deepEqual((await reports.search({ q: 'absent@example.test' })).rows, []);
  const f = await purchase('duplicate-search@example.test', '26111399999999');
  for (const unit of f.units)
    await db.doc('orderActivations/' + unit.id).update({ esimTranNo: '26111399999999' });
  assert.equal((await reports.search({ q: '26111399999999' })).rows.length, 1);
});
test.after(async () => {
  await deleteApp(app);
});
