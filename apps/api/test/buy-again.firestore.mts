import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { BuyAgainService } from '../src/lib/buy-again.ts';
import type { TopupProfile, TopupPackage } from '../src/lib/topup-eligibility.ts';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8188');
const app = initializeApp({ projectId: 'demo-alozuri' }),
  db = getFirestore(app);
process.env.BUY_AGAIN_ENABLED = 'true';
test.after(() => deleteApp(app));
async function fixture() {
  const source = 'order_' + crypto.randomUUID().replaceAll('-', '');
  const uid = crypto.randomUUID();
  const original: TopupPackage = {
    packageCode: 'BASE',
    name: 'France',
    price: 10000,
    currencyCode: 'USD',
    volume: 1073741824,
    duration: 7,
    durationUnit: 'DAY',
    location: 'FR',
    dataType: 1,
    supportTopUpType: 2,
    speed: '4G',
  };
  const profile: TopupProfile = {
    esimTranNo: source,
    orderNo: source,
    iccid: '89852245280001113019',
    esimStatus: 'IN_USE',
    smdpStatus: 'ENABLED',
    expiredTime: '2030-01-01T00:00:00Z',
    packageList: [{ packageCode: 'BASE' }],
  };
  await db.doc('orders/' + source).set({
    uid,
    test: false,
    status: 'ready',
    supplierCode: 'BASE',
    supplierOrderNo: source,
    wholesaleUnits: 10000,
    createdAt: '2026-01-01T00:00:00Z',
    plan: {
      id: 'product',
      name: 'France',
      days: 7,
      dataGb: 1,
      countries: ['FR'],
      dataType: 'fixed',
    },
  });
  await db.doc('orderActivations/' + source).set({
    uid,
    ac: 'LPA:1$example.com$synthetic-code',
    iccid: profile.iccid,
    esimTranNo: source,
    topUpCount: 0,
    topUpHistoryKnown: true,
  });
  let calls = 0,
    timeout = false;
  const service = new BuyAgainService(db, {
    packages: async () => [original],
    topupProfile: async (esimTranNo) =>
      esimTranNo === profile.esimTranNo
        ? profile
        : { ...profile, esimTranNo, iccid: profile.iccid.slice(0, -1) + '8' },
    topupPackages: async () => [{ ...original, packageCode: 'TOPUP', slug: 'topup-slug' }],
    topup: async (input) => {
      assert.ok(input.transactionId.length <= 50);
      calls++;
      if (timeout) throw new Error('Synthetic timeout');
      return {
        transactionId: input.transactionId,
        iccid: profile.iccid,
        expiredTime: '2030-02-01T00:00:00Z',
        topUpEsimTranNo: 'confirmed-ref',
      };
    },
  });
  const paid = async (id: string) => {
    await db.doc('orders/' + id).set({ uid, status: 'paid', paidAt: new Date().toISOString() });
    await db.doc('fulfillmentJobs/' + id).set({ attempts: 0 });
  };
  return {
    service,
    uid,
    source,
    profile,
    paid,
    calls: () => calls,
    timeout: () => {
      timeout = true;
    },
  };
}
test('ownership, masked selection and historical unknown counters fail safely', async () => {
  const f = await fixture();
  await assert.rejects(f.service.options('foreign', f.source));
  const result = await f.service.options(f.uid, f.source);
  assert.equal(result.profiles.length, 1);
  assert.equal(result.profiles[0].maskedIccid, '•••• 3019');
  assert.ok(!JSON.stringify(result).includes(f.profile.iccid));
  await db.doc('orderActivations/' + f.source).update({ topUpHistoryKnown: false });
  assert.equal((await f.service.options(f.uid, f.source)).profiles.length, 0);
  const quote = await f.service.quote(f.uid, f.source);
  assert.equal(quote.decision, 'NEW_ESIM');
});
test('multiple profiles are returned without arbitrary automatic selection', async () => {
  const f = await fixture();
  const other = f.source + 'b';
  const order = await db.doc('orders/' + f.source).get();
  await db.doc('orders/' + other).set(order.data()!);
  const activation = await db.doc('orderActivations/' + f.source).get();
  await db
    .doc('orderActivations/' + other)
    .set({ ...activation.data(), esimTranNo: other, iccid: f.profile.iccid.slice(0, -1) + '8' });
  assert.equal((await f.service.options(f.uid, f.source)).profiles.length, 2);
});
test('duplicate paid workers and repeated delivery cannot submit two top-ups or increment twice', async () => {
  const f = await fixture();
  const q = await f.service.quote(f.uid, f.source, f.source);
  const decision = await f.service.decision(f.uid, q.id);
  const id = 'order_' + crypto.randomUUID().replaceAll('-', '') + 'a'.repeat(16);
  await f.paid(id);
  const results = await Promise.allSettled([
    f.service.fulfill(id, f.uid, decision),
    f.service.fulfill(id, f.uid, decision),
  ]);
  assert.ok(results.some((r) => r.status === 'fulfilled'));
  await f.service.fulfill(id, f.uid, decision);
  assert.equal(f.calls(), 1);
  assert.equal((await db.doc('orderActivations/' + f.source).get()).get('topUpCount'), 1);
  assert.equal((await db.doc('orders/' + id).get()).get('status'), 'ready');
});
test('timeout retains durable mutation marker and lock; retries and another paid order cannot buy again', async () => {
  const f = await fixture();
  const q = await f.service.quote(f.uid, f.source, f.source),
    decision = await f.service.decision(f.uid, q.id);
  const first = 'order_' + crypto.randomUUID().replaceAll('-', ''),
    second = first + 'b';
  await f.paid(first);
  await f.paid(second);
  f.timeout();
  await assert.rejects(f.service.fulfill(first, f.uid, decision));
  await assert.rejects(f.service.fulfill(first, f.uid, decision));
  await assert.rejects(f.service.fulfill(second, f.uid, decision));
  assert.equal(f.calls(), 1);
  assert.equal(
    (await db.doc('orders/' + first).get()).get('topupState'),
    'TOPUP_PENDING_RECONCILIATION',
  );
  assert.equal((await db.doc('orderActivations/' + f.source).get()).get('topupLockOrderId'), first);
});
test('quote ownership, expiry and maximum count are enforced', async () => {
  const f = await fixture(),
    q = await f.service.quote(f.uid, f.source, f.source);
  await assert.rejects(f.service.decision('foreign', q.id));
  await db.doc('buyAgainQuotes/' + q.id).update({ expiresAt: 0 });
  await assert.rejects(f.service.decision(f.uid, q.id));
  await db.doc('orderActivations/' + f.source).update({ topUpCount: 9 });
  assert.equal((await f.service.options(f.uid, f.source)).profiles.length, 0);
});

test('profile expiring after quote switches to the same verified new package before any top-up', async () => {
  const f = await fixture(),
    q = await f.service.quote(f.uid, f.source, f.source);
  const decision = await f.service.decision(f.uid, q.id);
  f.profile.expiredTime = '2000-01-01T00:00:00Z';
  const id = 'order_' + crypto.randomUUID().replaceAll('-', '') + 'a'.repeat(16);
  await f.paid(id);
  assert.equal(await f.service.fulfill(id, f.uid, decision), false);
  assert.equal(f.calls(), 0);
  const order = await db.doc('orders/' + id).get();
  assert.equal(order.get('supplierCode'), 'BASE');
  assert.equal(order.get('repeatDecision.method'), 'NEW_ESIM');
});
test('unpaid order cannot mutate a supplier profile', async () => {
  const f = await fixture(),
    q = await f.service.quote(f.uid, f.source, f.source);
  const decision = await f.service.decision(f.uid, q.id);
  const id = 'order_' + crypto.randomUUID().replaceAll('-', '') + 'a'.repeat(16);
  await db.doc('orders/' + id).set({ uid: f.uid, status: 'pending_payment' });
  await assert.rejects(f.service.fulfill(id, f.uid, decision));
  assert.equal(f.calls(), 0);
});

test('concurrent paid orders cannot exceed the ninth top-up', async () => {
  const f = await fixture();
  await db.doc('orderActivations/' + f.source).update({ topUpCount: 8 });
  const q = await f.service.quote(f.uid, f.source, f.source);
  const decision = await f.service.decision(f.uid, q.id);
  const ids = [
    'order_' + crypto.randomUUID().replaceAll('-', ''),
    'order_' + crypto.randomUUID().replaceAll('-', ''),
  ];
  for (const id of ids) await f.paid(id);
  const results = await Promise.allSettled(ids.map((id) => f.service.fulfill(id, f.uid, decision)));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(f.calls(), 1);
  assert.equal((await db.doc('orderActivations/' + f.source).get()).get('topUpCount'), 9);
});

test('duplicate profile records share one physical eSIM lock and counter', async () => {
  const f = await fixture(),
    alias = f.source + 'alias';
  await db.doc('orderActivations/' + f.source).update({ topUpCount: 8 });
  const [source, profile] = await db.getAll(
    db.doc('orders/' + f.source),
    db.doc('orderActivations/' + f.source),
  );
  await db.doc('orders/' + alias).set(source.data()!);
  await db.doc('orderActivations/' + alias).set(profile.data()!);
  assert.equal((await f.service.options(f.uid, f.source)).profiles.length, 1);
  const quotes = await Promise.all([
    f.service.quote(f.uid, f.source, f.source),
    f.service.quote(f.uid, f.source, alias),
  ]);
  const decisions = await Promise.all(quotes.map((q) => f.service.decision(f.uid, q.id)));
  const ids = [
    'order_' + crypto.randomUUID().replaceAll('-', ''),
    'order_' + crypto.randomUUID().replaceAll('-', ''),
  ];
  for (const id of ids) await f.paid(id);
  const results = await Promise.allSettled(
    ids.map((id, index) => f.service.fulfill(id, f.uid, decisions[index])),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(f.calls(), 1);
  assert.equal((await f.service.options(f.uid, f.source)).profiles.length, 0);
});
