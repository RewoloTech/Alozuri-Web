import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { BuyAgainService } from '../src/lib/buy-again.ts';
import { TopupReconciliation } from '../src/lib/topup-reconciliation.ts';
import type { TopupProfile, TopupPackage } from '../src/lib/topup-eligibility.ts';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8188');
const app = initializeApp({ projectId: 'demo-alozuri' }),
  db = getFirestore(app);
process.env.BUY_AGAIN_ENABLED = 'true';
test.after(() => deleteApp(app));
async function fixture() {
  const source = 'order_' + crypto.randomUUID().replaceAll('-', '') + 'a'.repeat(16);
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
    originalSupplierPackage: original,
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
    topupPackages: async () => [
      { ...original, packageCode: 'TOPUP', slug: 'topup-slug', supportTopUpType: 1 },
    ],
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
    await db
      .doc('orders/' + id)
      .set({ uid, test: false, status: 'paid', paidAt: new Date().toISOString() });
    await db.doc('fulfillmentJobs/' + id).set({ attempts: 0 });
  };
  return {
    service,
    original,
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
test('missing original supplier terms or changed speed/FUP offer a new eSIM rather than an unverifiable top-up', async () => {
  const f = await fixture();
  await db.doc('orders/' + f.source).update({ originalSupplierPackage: null });
  assert.equal((await f.service.options(f.uid, f.source)).profiles.length, 0);
  assert.equal((await f.service.quote(f.uid, f.source)).decision, 'NEW_ESIM');
  for (const patch of [{ speed: '5G' }, { fupPolicy: '512kbps' }]) {
    await db
      .doc('orders/' + f.source)
      .update({ originalSupplierPackage: { ...f.original, ...patch } });
    assert.equal((await f.service.options(f.uid, f.source)).profiles.length, 0);
    await assert.rejects(f.service.quote(f.uid, f.source, f.source));
  }
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
  assert.equal((await db.doc('orders/' + first).get()).get('supplierAttempted'), true);
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

async function uncertainTopup() {
  const f = await fixture();
  const quote = await f.service.quote(f.uid, f.source, f.source);
  const decision = await f.service.decision(f.uid, quote.id);
  const id = 'order_' + crypto.randomUUID().replaceAll('-', '') + 'b'.repeat(16);
  const purchaseId = 'purchase_' + crypto.randomUUID().replaceAll('-', '') + 'c'.repeat(16);
  await f.paid(id);
  await db.doc('orders/' + id).update({ parentOrderId: purchaseId, repeatDecision: decision });
  await db.doc('purchases/' + purchaseId).set({
    uid: f.uid,
    test: false,
    status: 'paid',
    paidAt: new Date().toISOString(),
  });
  await db.doc('orderWork/' + purchaseId).set({
    kind: 'purchase',
    id: purchaseId,
    generation: 4,
    status: 'attention',
    leaseUntil: 0,
  });
  f.timeout();
  await assert.rejects(f.service.fulfill(id, f.uid, decision));
  f.profile.expiredTime = '2030-02-01T00:00:00Z';
  const input = {
    requestId: crypto.randomUUID(),
    supplierConfirmed: true,
    evidenceReference: 'Supplier support ticket TEST-100: confirmed transaction receipt',
    receipt: {
      transactionId: (await db.doc('orders/' + id).get()).get('supplierTransactionId'),
      iccid: f.profile.iccid,
      expiredTime: f.profile.expiredTime,
      topUpEsimTranNo: 'confirmed-ref',
    },
  };
  const service = new TopupReconciliation(
    db,
    { topupProfile: async () => f.profile },
    Date.now,
    null,
  );
  return { ...f, id, purchaseId, input, recovery: service };
}

test('supplier-confirmed receipt settles a lost response exactly once and resumes existing order work', async () => {
  const f = await uncertainTopup();
  await f.recovery.confirm(f.id, f.input, 'verified-admin');
  await f.recovery.confirm(f.id, f.input, 'verified-admin');
  assert.equal(f.calls(), 1, 'reconciliation must never send a chargeable request');
  const [order, profile, work, audits] = await Promise.all([
    db.doc('orders/' + f.id).get(),
    db.doc('orderActivations/' + f.source).get(),
    db.doc('orderWork/' + f.purchaseId).get(),
    db.collection('orders/' + f.id + '/topupReconciliations').get(),
  ]);
  assert.equal(order.get('status'), 'ready');
  assert.equal(order.get('topupState'), 'TOPUP_SUCCESSFUL');
  assert.equal(profile.get('topUpCount'), 1);
  assert.equal(profile.get('topupLockOrderId'), undefined);
  assert.equal(work.get('status'), 'pending');
  assert.equal(work.get('generation'), 5);
  assert.equal(audits.size, 1);
  assert.equal(audits.docs[0].get('recordedBy'), 'verified-admin');
  assert.equal(audits.docs[0].get('supplierEvidenceReference'), f.input.evidenceReference);
  assert.equal((await db.doc('orderActivations/' + f.id).get()).get('iccid'), f.profile.iccid);
  assert.equal((await db.doc('fulfillmentJobs/' + f.id).get()).exists, false);
  await assert.rejects(
    f.recovery.confirm(
      f.id,
      { ...f.input, evidenceReference: 'Changed evidence' },
      'verified-admin',
    ),
  );
});

test('reconciliation rejects mismatched, unconfirmed or uncorroborated receipts without releasing locks', async () => {
  const f = await uncertainTopup();
  for (const input of [
    { ...f.input, supplierConfirmed: false },
    { ...f.input, evidenceReference: '' },
    { ...f.input, receipt: { ...f.input.receipt, transactionId: 'foreign' } },
    { ...f.input, receipt: { ...f.input.receipt, iccid: '89852245280001113018' } },
    { ...f.input, receipt: { ...f.input.receipt, expiredTime: '2031-02-01T00:00:00Z' } },
    { ...f.input, receipt: { ...f.input.receipt, expiredTime: '2030-02-01' } },
  ])
    await assert.rejects(f.recovery.confirm(f.id, input, 'verified-admin'));
  assert.equal((await db.doc('orders/' + f.id).get()).get('status'), 'fulfilling');
  assert.equal((await db.doc('orderActivations/' + f.source).get()).get('topupLockOrderId'), f.id);
  assert.equal(f.calls(), 1);
});

test('concurrent settlement, active work and changed ownership cannot double-count or bypass payment blocks', async () => {
  const f = await uncertainTopup();
  await db.doc('orderWork/' + f.purchaseId).update({ leaseUntil: Date.now() + 60000 });
  await assert.rejects(f.recovery.confirm(f.id, f.input, 'verified-admin'));
  await db.doc('orderWork/' + f.purchaseId).update({ leaseUntil: 0 });
  await db.doc('orderActivations/' + f.source).update({ uid: 'foreign' });
  await assert.rejects(f.recovery.confirm(f.id, f.input, 'verified-admin'));
  await db.doc('orderActivations/' + f.source).update({ uid: f.uid });
  await db.doc('orders/' + f.id).update({ paymentBlocked: true, status: 'refunded' });
  const results = await Promise.allSettled([
    f.recovery.confirm(f.id, f.input, 'verified-admin'),
    f.recovery.confirm(f.id, { ...f.input, requestId: crypto.randomUUID() }, 'verified-admin'),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await db.doc('orderActivations/' + f.source).get()).get('topUpCount'), 1);
  assert.equal((await db.doc('orders/' + f.id).get()).get('status'), 'refunded');
  assert.equal((await db.doc('orderWork/' + f.purchaseId).get()).get('status'), 'attention');
});

test('failed queue dispatch leaves a durable settlement and an idempotent retry dispatches receipt work', async () => {
  const f = await uncertainTopup();
  let attempts = 0;
  const recovery = new TopupReconciliation(db, { topupProfile: async () => f.profile }, Date.now, {
    enqueue: async (work) => {
      assert.equal(work.id, f.purchaseId);
      assert.equal(work.generation, 5);
      if (++attempts === 1) throw Error('Synthetic queue outage');
    },
  });
  await assert.rejects(recovery.confirm(f.id, f.input, 'verified-admin'));
  assert.equal((await db.doc('orders/' + f.id).get()).get('status'), 'ready');
  assert.equal((await db.doc('orderWork/' + f.purchaseId).get()).get('status'), 'pending');
  await recovery.confirm(f.id, f.input, 'verified-admin');
  assert.equal(attempts, 2);
  assert.equal((await db.doc('orderWork/' + f.purchaseId).get()).get('status'), 'queued');
  assert.equal((await db.doc('orderActivations/' + f.source).get()).get('topUpCount'), 1);
  assert.equal(f.calls(), 1);
});

test('supplier HTTP permits serialize concurrent callers with a shared cooldown', async () => {
  const { supplierHttp } = await import('../src/lib/supplier-rate-limit.ts');
  const fetch = globalThis.fetch,
    starts: number[] = [];
  let active = 0,
    maxActive = 0;
  await db.doc('serviceLocks/esimAccessHttp').delete();
  globalThis.fetch = async () => {
    starts.push(Date.now());
    maxActive = Math.max(maxActive, ++active);
    await new Promise((resolve) => setTimeout(resolve, 20));
    active--;
    return Response.json({ success: true });
  };
  try {
    await Promise.all(
      Array.from({ length: 4 }, () => supplierHttp('https://supplier.invalid', {})),
    );
    assert.equal(maxActive, 1);
    assert.equal(starts.length, 4);
    for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 150);
  } finally {
    globalThis.fetch = fetch;
  }
});

test('supplier permits recover expired crash leases, retain cooldown after failures and never release another owner', async () => {
  const { supplierHttp } = await import('../src/lib/supplier-rate-limit.ts');
  const fetch = globalThis.fetch,
    ref = db.doc('serviceLocks/esimAccessHttp');
  await ref.set({ token: 'crashed-instance', until: Date.now() - 1 });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    assert.ok((await ref.get()).get('until') - Date.now() > 80000);
    if (calls === 1) throw Error('Synthetic network failure');
    await ref.set({ token: 'different-owner', until: Date.now() + 90000 });
    return Response.json({ success: true });
  };
  try {
    await assert.rejects(supplierHttp('https://supplier.invalid', {}));
    assert.ok((await ref.get()).get('until') <= Date.now() + 150);
    await supplierHttp('https://supplier.invalid', {});
    assert.equal((await ref.get()).get('token'), 'different-owner');
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = fetch;
    await ref.delete();
  }
});
