import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { CommerceService } from '../src/lib/commerce.ts';
import { createApp } from '../src/app.ts';
import { FulfillmentService, firestoreFulfillmentStore } from '../src/lib/fulfillment.ts';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
import type { StoredPlan } from '../../../packages/shared/src/index.ts';
import type { Repository } from '../src/lib/repository.ts';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8188');
const app = initializeApp({ projectId: 'demo-alozuri' }),
  db = getFirestore(app),
  signer = new Stripe('sk_test_fixture');
let serial = 0;
function fixture(
  testMode = false,
  capacity?: (items: { wholesaleUnits: number; quantity: number }[]) => Promise<void>,
) {
  const plans: StoredPlan[] = demoPlans
    .slice(0, 2)
    .map((p) => ({ ...p, demo: false, active: true, supplierCode: p.id, wholesaleUnits: 1000 }));
  let creates = 0;
  const emails: { id: string; email: string; url: string }[] = [];
  const intent = {
    id: 'pi_fixture_' + ++serial,
    livemode: !testMode,
    status: 'requires_payment_method',
    amount: 0,
    amount_received: 0,
    currency: 'usd',
    metadata: {} as Record<string, string>,
    client_secret: 'pi_fixture_secret',
    latest_charge: { id: 'ch_fixture', refunded: false, amount_refunded: 0, disputed: false },
  };
  const refunds: Stripe.Refund[] = [];
  const stripe = {
    paymentIntents: {
      create: async (
        params: Stripe.PaymentIntentCreateParams,
        options: { idempotencyKey: string },
      ) => {
        creates++;
        assert.ok(options.idempotencyKey);
        assert.equal(params.automatic_payment_methods?.enabled, true);
        Object.assign(intent, { amount: params.amount, metadata: params.metadata });
        return intent;
      },
      retrieve: async () => intent,
    },
    webhooks: signer.webhooks,
    charges: { retrieve: async () => ({ ...intent.latest_charge, payment_intent: intent.id }) },
    refunds: { list: async () => ({ data: refunds }) },
  } as unknown as Stripe;
  const service = new CommerceService(
    stripe,
    testMode ? 'test' : 'live',
    'whsec_fixture',
    'a'.repeat(48),
    'https://alozuri.com',
    async (id) => {
      const p = plans.find((p) => p.id === id);
      if (!p) throw new Error('Unavailable');
      return { ...p, syncedAt: new Date().toISOString() };
    },
    db,
    {
      send: async (input) => {
        emails.push(input);
      },
    },
    capacity,
  );
  const input = {
    items: [
      { planId: plans[0].id, quantity: 2 },
      { planId: plans[1].id, quantity: 1 },
    ],
    email: 'guest@example.com',
    emailConfirmation: 'guest@example.com',
    requestId: crypto.randomUUID(),
    compatible: true as const,
    currency: 'USD' as const,
    expectedTotalCents: plans[0].priceCents * 2 + plans[1].priceCents,
  };
  async function event(
    type = 'payment_intent.succeeded',
    eventId = 'evt_' + crypto.randomUUID().replaceAll('-', ''),
  ) {
    const payload = JSON.stringify({
      id: eventId,
      object: 'event',
      livemode: !testMode,
      type,
      data: { object: intent },
    });
    return service.webhook(
      Buffer.from(payload),
      signer.webhooks.generateTestHeaderString({ payload, secret: 'whsec_fixture' }),
    );
  }
  return {
    plans,
    intent,
    stripe,
    service,
    input,
    event,
    emails,
    refunds,
    getCreates: () => creates,
  };
}
test.before(async () => {
  await fetch(
    'http://127.0.0.1:8188/emulator/v1/projects/demo-alozuri/databases/(default)/documents',
    { method: 'DELETE' },
  );
});
test('guest multi-item checkout retries one intent, paid webhook allocates one eSIM per unit, and delivery is private', async () => {
  const f = fixture(),
    first = await f.service.checkout(f.input, null),
    second = await f.service.checkout(f.input, null);
  assert.equal(first.orderId, second.orderId);
  assert.equal(first.accessToken, second.accessToken);
  assert.equal(f.getCreates(), 1);
  await assert.rejects(f.service.order(first.orderId, null, 'wrong-token'), /not found/);
  assert.equal(
    (await f.service.order(first.orderId, null, first.accessToken)).email,
    'guest@example.com',
  );
  const before = await db.collection('orders').where('parentOrderId', '==', first.orderId).get();
  assert.equal(before.size, 0);
  f.intent.status = 'processing';
  await f.event('payment_intent.processing');
  assert.equal(
    (await db.collection('orders').where('parentOrderId', '==', first.orderId).get()).size,
    0,
  );
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await Promise.all([
    f.event('payment_intent.succeeded', 'evt_cart_one'),
    f.event('payment_intent.succeeded', 'evt_cart_two'),
  ]);
  const units = await db.collection('orders').where('parentOrderId', '==', first.orderId).get();
  assert.equal(units.size, 3);
  assert.equal(new Set(units.docs.map((d) => d.id)).size, 3);
  assert.ok(units.docs.every((d) => d.get('chargeTotalCents') === f.input.expectedTotalCents));
  const transactions = new Set<string>();
  let allocation = 0;
  const worker = new FulfillmentService(f.stripe, firestoreFulfillmentStore(), {
    order: async (tx) => {
      transactions.add(tx);
      return 'supplier-' + tx;
    },
    profile: async () => ({
      ac: 'LPA:1$example.com$code-' + ++allocation,
      iccid: '89852245280001113' + String(allocation).padStart(2, '0'),
      esimTranNo: 'allocation-' + allocation,
    }),
  });
  await worker.run();
  assert.equal(transactions.size, 3);
  const order = await f.service.order(first.orderId, null, first.accessToken);
  assert.ok(order.allocations.every((a) => a.status === 'ready'));
  await assert.rejects(
    f.service.activation(first.orderId, units.docs[0].id, null, 'wrong'),
    /not found/,
  );
  assert.ok(
    (
      await f.service.activation(first.orderId, units.docs[0].id, null, first.accessToken)
    ).ac.startsWith('LPA:1$'),
  );
  await f.service.notify();
  await f.service.notify();
  assert.equal(f.emails.filter((e) => e.id === first.orderId).length, 1);
  assert.ok(f.emails[0].url.includes('#access='));
  const history = await f.service.history({
    uid: 'new-account',
    verified: true,
    admin: false,
    email: 'guest@example.com',
  });
  assert.ok(history.some((o) => o.id === first.orderId));
  const outsider = await f.service.history({
    uid: 'other',
    verified: true,
    admin: false,
    email: 'other@example.com',
  });
  assert.ok(!outsider.some((o) => o.id === first.orderId));
});
test('test checkout never queues real delivery, bad prices and amounts are rejected, and failed payments cannot fulfil', async () => {
  const f = fixture(true);
  await assert.rejects(
    f.service.checkout({ ...f.input, expectedTotalCents: 1 }, null),
    /price changed/,
  );
  assert.equal(f.getCreates(), 0);
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'requires_payment_method';
  await f.event('payment_intent.payment_failed');
  assert.equal(
    (await db.collection('orders').where('parentOrderId', '==', result.orderId).get()).size,
    0,
  );
  f.intent.status = 'succeeded';
  f.intent.amount_received = 1;
  await assert.rejects(f.event(), /amount/);
  f.intent.amount_received = f.intent.amount;
  await f.event();
  const units = await db.collection('orders').where('parentOrderId', '==', result.orderId).get();
  assert.equal(units.size, 3);
  for (const unit of units.docs)
    assert.equal((await db.collection('fulfillmentJobs').doc(unit.id).get()).exists, false);
  await assert.rejects(f.service.webhook(Buffer.from('{}'), 'bad'), /signature/);
});
test('authenticated carts merge once, isolate owners, retain unavailable items for removal and reject stale writes', async () => {
  const f = fixture();
  let catalogue = f.plans;
  const repository: Repository = {
    plans: async () => catalogue,
    orders: async () => [],
    order: async () => null,
  };
  const api = await createApp({
    repository,
    commerce: f.service,
    payments: null,
    fulfillment: null,
    verify: async (token) => ({
      uid: token,
      verified: true,
      admin: false,
      email: token + '@example.com',
    }),
  });
  try {
    const headers = { authorization: 'Bearer alice' },
      mergeId = crypto.randomUUID(),
      payload = { items: [{ planId: f.plans[0].id, quantity: 2 }], mergeId };
    assert.equal(
      (await api.inject({ method: 'POST', url: '/v2/cart/merge', payload })).statusCode,
      401,
    );
    const one = await api.inject({ method: 'POST', url: '/v2/cart/merge', headers, payload });
    assert.equal(one.statusCode, 200);
    const two = await api.inject({ method: 'POST', url: '/v2/cart/merge', headers, payload });
    assert.equal(two.json().items[0].quantity, 2);
    assert.equal(
      (await api.inject({ url: '/v2/cart', headers: { authorization: 'Bearer bob' } })).json().items
        .length,
      0,
    );
    assert.equal(
      (
        await api.inject({
          method: 'PUT',
          url: '/v2/cart',
          headers,
          payload: { items: payload.items, version: 0 },
        })
      ).statusCode,
      409,
    );
    catalogue = [];
    const unavailable = await api.inject({ url: '/v2/cart', headers });
    assert.equal(unavailable.statusCode, 200);
    assert.equal(unavailable.json().items[0].unavailable, true);
    const cleared = await api.inject({
      method: 'PUT',
      url: '/v2/cart',
      headers,
      payload: { items: [], version: unavailable.json().version },
    });
    assert.equal(cleared.statusCode, 200);
    const invalid = await api.inject({
      method: 'POST',
      url: '/v2/checkout',
      payload: { ...f.input, price: 1 },
    });
    assert.equal(invalid.statusCode, 400);
    const currency = await api.inject({
      method: 'POST',
      url: '/v2/quote',
      payload: { items: f.input.items, currency: 'EUR' },
    });
    assert.equal(currency.statusCode, 400);
  } finally {
    await api.close();
  }
});
test('an unfunded supplier blocks checkout before creating a Stripe intent or purchase record', async () => {
  const f = fixture(false, async () => {
    throw new Error('Supplier balance unavailable');
  });
  const before = (await db.collection('purchases').get()).size;
  await assert.rejects(f.service.checkout(f.input, null), /Supplier balance unavailable/);
  assert.equal(f.getCreates(), 0);
  assert.equal((await db.collection('purchases').get()).size, before);
});
test.after(async () => {
  await db.terminate();
  await deleteApp(app);
});
