import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firestorePaymentStore } from '../src/lib/payments.ts';
import { firestoreFulfillmentStore } from '../src/lib/fulfillment.ts';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
import type Stripe from 'stripe';
import type { StoredPlan } from '../../../packages/shared/src/index.ts';
assert.equal(
  process.env.FIRESTORE_EMULATOR_HOST,
  '127.0.0.1:8188',
  'Run only against the local Firestore emulator.',
);
const app = initializeApp({ projectId: 'demo-alozuri' }),
  db = getFirestore(app);
const plan: StoredPlan = {
  ...demoPlans[0],
  demo: false,
  active: true,
  supplierCode: 'fixture-sku',
  wholesaleUnits: 1000,
};
const activation = {
  ac: 'LPA:1$example.com$PRIVATE-TEST-CODE',
  iccid: '89852245280001113019',
  esimTranNo: 'test-profile',
};
test('live payment atomically queues one delivery; concurrent workers lease once; replay cannot overwrite ready', async () => {
  const payments = firestorePaymentStore('live'),
    delivery = firestoreFulfillmentStore();
  const request = crypto.randomUUID(),
    order = await payments.reserve('alice', request, plan);
  await payments.bind(order.id, 'cs_live_emulator');
  const session = {
    id: 'cs_live_emulator',
    livemode: true,
    mode: 'payment',
    payment_intent: 'pi_emulator',
    payment_status: 'paid',
    status: 'complete',
    amount_total: order.amountCents,
    currency: 'usd',
    client_reference_id: order.id,
    metadata: { voyaspanOrderId: order.id, voyaspanUid: 'alice' },
  } as Stripe.Checkout.Session;
  await Promise.all([
    payments.apply('evt_emulator_one', session, 'paid'),
    payments.apply('evt_emulator_two', session, 'paid'),
  ]);
  const job = db.collection('fulfillmentJobs').doc(order.id);
  assert.equal((await job.get()).exists, true);
  assert.equal(
    (await db.collection('orders').doc(order.id).get()).get('paymentIntentId'),
    'pi_emulator',
  );
  const claims = await Promise.all([delivery.claim(order.id), delivery.claim(order.id)]);
  assert.equal(claims.filter(Boolean).length, 1);
  const claim = claims.find(Boolean)!;
  await delivery.finish(claim, { status: 'ready' }, activation);
  await payments.apply('evt_emulator_replay', session, 'paid');
  await payments.apply('evt_emulator_expired', session, 'expired');
  assert.equal((await job.get()).exists, false);
  assert.equal((await payments.find('alice', order.id))?.status, 'ready');
  assert.deepEqual(await delivery.activation('alice', order.id), activation);
  assert.equal(await delivery.activation('bob', order.id), null);
  assert.equal(await payments.find('bob', order.id), null);
  // A verified dispute blocks installation details and cannot be undone by a late paid event.
  await payments.adjust(
    'evt_dispute_emulator',
    {
      id: 'ch_fixture',
      livemode: true,
      amount: order.amountCents,
      currency: 'usd',
      payment_intent: 'pi_emulator',
      disputed: true,
      amount_refunded: 0,
      refunded: false,
    } as Stripe.Charge,
    false,
  );
  assert.equal(await delivery.activation('alice', order.id), null);
  await payments.apply('evt_emulator_late_paid', session, 'paid');
  assert.equal((await payments.find('alice', order.id))?.status, 'provision_error');
  assert.equal((await job.get()).exists, false);
});
test('test orders cannot enter live delivery and mode changes cannot reuse their snapshots', async () => {
  const testStore = firestorePaymentStore('test'),
    liveStore = firestorePaymentStore('live');
  const request = crypto.randomUUID(),
    testOrder = await testStore.reserve('alice', request, plan),
    liveOrder = await liveStore.reserve('alice', request, plan);
  assert.notEqual(testOrder.id, liveOrder.id);
  const session = {
    id: 'cs_test_emulator',
    mode: 'payment',
    livemode: false,
    payment_status: 'paid',
    payment_intent: 'pi_test',
    amount_total: testOrder.amountCents,
    currency: 'usd',
    client_reference_id: testOrder.id,
    metadata: { voyaspanOrderId: testOrder.id, voyaspanUid: 'alice' },
  } as Stripe.Checkout.Session;
  await testStore.apply('evt_test_emulator', session, 'paid');
  assert.equal((await db.collection('fulfillmentJobs').doc(testOrder.id).get()).exists, false);
  await assert.rejects(liveStore.find('alice', testOrder.id), /environment/);
  await assert.rejects(liveStore.apply('evt_wrong_environment', session, 'paid'), /environment/);
});
test('a crashed worker loses its lease and cannot overwrite a newer worker result', async () => {
  const store = firestorePaymentStore('live'),
    delivery = firestoreFulfillmentStore(),
    order = await store.reserve('alice', crypto.randomUUID(), plan);
  await db
    .collection('orders')
    .doc(order.id)
    .update({ status: 'paid', sessionId: 'cs_live_lease', paymentIntentId: 'pi_lease' });
  const ref = db.collection('fulfillmentJobs').doc(order.id);
  await ref.set({ nextAttemptAt: 0, leaseUntil: 0, attempts: 0 });
  const first = (await delivery.claim(order.id))!;
  await ref.update({ leaseUntil: 0 });
  const second = (await delivery.claim(order.id))!;
  assert.notEqual(first.lease, second.lease);
  await assert.rejects(delivery.finish(first, { status: 'ready' }, activation), /lease/);
  await delivery.finish(second, { status: 'ready' }, activation);
  assert.deepEqual(await delivery.activation('alice', order.id), activation);
});
test.after(async () => {
  await db.terminate();
  await deleteApp(app);
});
