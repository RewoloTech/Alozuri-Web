import { SAFE_EMAIL_RETRY_MS } from '../src/lib/order-confirmations.ts';
import { POLICIES } from '../../../packages/shared/src/policies.ts';
import { CHECKOUT_LEGAL_ACCEPTANCE } from '../../../packages/shared/src/legal.ts';
import { convertPrice, priceExchange, type FxRates } from '../src/lib/exchange-rates.ts';
import type { Currency } from '../../../packages/shared/src/index.ts';
import { pricePackage } from '../src/lib/package-pricing.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { ConfirmationEmail } from '../src/lib/order-email.ts';
import { CommerceService } from '../src/lib/commerce.ts';
import { EsimUsageService, USAGE_CACHE_MS, type UsageSupplier } from '../src/lib/usage.ts';
import type { UsageSnapshot } from '../../../packages/shared/src/esim-usage.ts';
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
  currency: Currency = 'USD',
  emailFailure?: () => boolean,
  usageOptions?: { supplier: UsageSupplier; now?: () => number },
  deliveryEvent?: () => string,
) {
  const plans: StoredPlan[] = demoPlans.slice(0, 2).map((p) =>
    pricePackage(
      {
        ...p,
        demo: false,
        active: true,
        supplierCode: p.id,
        wholesaleUnits: 1000,
        syncedAt: new Date().toISOString(),
      },
      { priceOverrideUsdCents: p.priceCents },
    ),
  );
  let creates = 0;
  const emails: ConfirmationEmail[] = [];
  const intent = {
    id: 'pi_fixture_' + ++serial,
    livemode: !testMode,
    status: 'requires_payment_method',
    amount: 0,
    amount_received: 0,
    currency: 'usd',
    metadata: {} as Record<string, string>,
    client_secret: 'pi_fixture_secret',
    latest_charge: {
      id: 'ch_fixture',
      refunded: false,
      amount_refunded: 0,
      disputed: false,
      payment_method_details: { type: 'card', card: { wallet: null } },
    },
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
        assert.equal(params.receipt_email, undefined);
        Object.assign(intent, {
          amount: params.amount,
          currency: params.currency,
          metadata: params.metadata,
        });
        return intent;
      },
      retrieve: async () => intent,
    },
    webhooks: signer.webhooks,
    charges: { retrieve: async () => ({ ...intent.latest_charge, payment_intent: intent.id }) },
    refunds: { list: async () => ({ data: refunds }) },
  } as unknown as Stripe;
  const rates: FxRates = {
    source: 'frankfurter-ecb',
    asOf: new Date().toISOString().slice(0, 10),
    fetchedAt: new Date().toISOString(),
    rates: {
      GBP: { numerator: '8', denominator: '10' },
      EUR: { numerator: '11', denominator: '10' },
    },
  };
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
        if (emailFailure?.()) throw new Error('Temporary email-provider failure');
        emails.push(input);
        return { providerMessageId: 'email_' + input.id };
      },
      deliveryStatus: async () => deliveryEvent?.() ?? 'delivered',
    },
    capacity,
    { current: async () => rates },
    new EsimUsageService(
      db,
      usageOptions?.supplier ?? {
        usage: async () => {
          throw new Error('No live supplier calls in tests');
        },
      },
      usageOptions?.now,
    ),
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
    legal: CHECKOUT_LEGAL_ACCEPTANCE,
    currency,
    expectedTotalCents:
      convertPrice(plans[0].priceCents, currency, priceExchange(currency, rates)) * 2 +
      convertPrice(plans[1].priceCents, currency, priceExchange(currency, rates)),
  };
  async function event(
    type = 'payment_intent.succeeded',
    eventId = 'evt_' + crypto.randomUUID().replaceAll('-', ''),
  ) {
    const payload = JSON.stringify({
      id: eventId,
      object: 'event',
      created: 1794430800,
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
  await f.service.notify();
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
  // The worker's next scheduled notification run occurs after the pending-email retry.
  await db.collection('purchases').doc(first.orderId).update({ emailDueAt: Date.now() });
  await f.service.notify();
  await f.service.notify();
  assert.equal(f.emails.filter((e) => e.id === first.orderId).length, 1);
  assert.ok(f.emails[0].text.includes('Rewolo Technologies Ltd'));
  assert.ok(f.emails[0].text.includes('Your Purchase Contract'));
  assert.ok(f.emails[0].text.includes('I wish to cancel my Alozuri order'));
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
      payload: { items: f.input.items, currency: 'JPY' },
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

for (const currency of ['GBP', 'EUR'] as const)
  test(`${currency} quote, Stripe intent, webhook and historical receipt preserve the same charged minor units`, async () => {
    const f = fixture(true, undefined, currency);
    const quote = await f.service.quote(f.input.items, currency);
    assert.equal(quote.currency, currency);
    assert.notEqual(quote.totalCents, f.plans[0].priceCents * 2 + f.plans[1].priceCents);
    const result = await f.service.checkout(f.input, null);
    assert.equal(f.intent.amount, quote.totalCents);
    assert.equal(f.intent.currency, currency.toLowerCase());
    assert.equal(result.quote.totalCents, quote.totalCents);
    const saved = await db.doc('purchases/' + result.orderId).get();
    assert.equal(saved.get('items')[0].exchange.source, 'frankfurter-ecb');
    assert.equal(saved.get('items')[0].baseSellingPriceUsdCents, f.plans[0].priceCents);
    f.intent.status = 'succeeded';
    f.intent.amount_received = f.intent.amount;
    const eventId = 'evt_fx_' + crypto.randomUUID().replaceAll('-', '');
    await f.event('payment_intent.succeeded', eventId);
    await f.event('payment_intent.succeeded', eventId);
    const units = await db.collection('orders').where('parentOrderId', '==', result.orderId).get();
    assert.equal(units.size, 3);
    assert.ok(units.docs.every((d) => d.get('currency') === currency));
    f.plans[0].priceCents = 1; // A later catalogue change cannot rewrite the amount already paid.
    const receipt = await f.service.order(result.orderId, null, result.accessToken);
    assert.equal(receipt.totalCents, quote.totalCents);
    assert.equal(receipt.currency, currency);
    assert.equal(receipt.items[0].plan.priceCents, quote.items[0].plan.priceCents);
  });

test('GBP and EUR contract emails retain the charged currency and total after catalogue changes', async () => {
  for (const currency of ['GBP', 'EUR'] as const) {
    const f = fixture(false, undefined, currency);
    const result = await f.service.checkout(f.input, null);
    f.intent.status = 'succeeded';
    f.intent.amount_received = f.intent.amount;
    await f.event();
    f.plans[0].priceCents = 1;
    for (let attempt = 0; attempt < 5 && !f.emails.some((e) => e.id === result.orderId); attempt++)
      await f.service.notify();
    const text = f.emails.find((e) => e.id === result.orderId)?.text;
    const total = BigInt(result.quote.totalCents);
    assert.ok(
      text?.includes(
        `Total paid: ${currency} ${total / 100n}.${String(total % 100n).padStart(2, '0')}`,
      ),
    );
  }
});

const usageReading: UsageSnapshot = {
  kind: 'fixed',
  usedBytes: 1073741824,
  totalBytes: 5 * 1073741824,
  remainingBytes: 4 * 1073741824,
  profileStatus: 'IN_USE',
  expiresAt: null,
  checkedAt: new Date().toISOString(),
};
async function usageFixture(supplier: UsageSupplier, now = Date.now, testMode = false) {
  await db.doc('supplierLimits/esim-usage').delete();
  const f = fixture(testMode, undefined, 'USD', undefined, { supplier, now });
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  const units = await db.collection('orders').where('parentOrderId', '==', result.orderId).get();
  for (const unit of units.docs) {
    await unit.ref.update({ status: 'ready', supplierOrderNo: 'vendor-' + unit.id });
    await db.doc('fulfillmentJobs/' + unit.id).delete();
    await db.doc('orderActivations/' + unit.id).set({
      uid: unit.get('uid'),
      esimTranNo: 'profile-' + unit.id,
      ac: 'PRIVATE-ACTIVATION',
      iccid: 'PRIVATE-ICCID',
    });
  }
  return { ...f, result, units: units.docs };
}
test('usage is ownership protected, scoped per purchased unit, cached and absent from public Firestore', async () => {
  let calls = 0;
  const f = await usageFixture({
    usage: async (orderNo, esimTranNo) => {
      assert.ok(orderNo.startsWith('vendor-order_'));
      assert.ok(esimTranNo.startsWith('profile-order_'));
      calls++;
      return usageReading;
    },
  });
  const unit = f.units[0].id;
  for (const [user, token] of [
    [null, undefined],
    [null, 'wrong'],
    [{ uid: 'bob', email: 'other@example.com', verified: true, admin: false }, undefined],
    [{ uid: 'bob', email: 'other@example.com', verified: true, admin: true }, undefined],
  ] as const)
    await assert.rejects(f.service.usage(f.result.orderId, unit, user, token), /not found/);
  assert.equal(calls, 0);
  const first = await f.service.usage(f.result.orderId, unit, null, f.result.accessToken);
  assert.equal(first.snapshot?.remainingBytes, usageReading.remainingBytes);
  assert.ok(!JSON.stringify(first).includes('PRIVATE'));
  assert.ok(!JSON.stringify(first).includes('profile-'));
  await f.service.usage(f.result.orderId, unit, null, f.result.accessToken);
  assert.equal(calls, 1);
  await f.service.usage(f.result.orderId, f.units[1].id, null, f.result.accessToken);
  assert.equal(calls, 2);
  await assert.rejects(
    f.service.usage(f.result.orderId, 'order_' + 'f'.repeat(48), null, f.result.accessToken),
    /not available/,
  );
  const anonymous = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-alozuri/databases/(default)/documents/esimUsage/${unit}`,
  );
  assert.equal(anonymous.status, 403);
  const history = await f.service.history({
    uid: 'alice',
    email: f.input.email,
    verified: true,
    admin: false,
  });
  assert.equal(history.find((order) => order.id === f.result.orderId)?.allocations.length, 3);
  assert.ok(!JSON.stringify(history).includes('vendor-order_'));
  assert.equal(
    (
      await f.service.history({
        uid: 'bob',
        email: 'other@example.com',
        verified: true,
        admin: false,
      })
    ).length,
    0,
  );
});
test('usage failures retain a labelled stale reading, back off, and discard readings older than a day', async () => {
  let now = Date.now(),
    fail = false,
    calls = 0;
  const f = await usageFixture(
    {
      usage: async () => {
        calls++;
        if (fail) throw new Error('SECRET-provider-error');
        return usageReading;
      },
    },
    () => now,
  );
  const get = () => f.service.usage(f.result.orderId, f.units[0].id, null, f.result.accessToken);
  await get();
  fail = true;
  now += USAGE_CACHE_MS + 1;
  const stale = await get();
  assert.equal(stale.stale, true);
  assert.equal(stale.state, 'available');
  await get();
  assert.equal(calls, 2);
  now += 25 * 60 * 60 * 1000;
  const expired = await get();
  assert.equal(expired.state, 'unavailable');
  assert.equal(expired.snapshot, null);
  assert.ok(!JSON.stringify(expired).includes('SECRET'));
});
test('concurrent usage refreshes share a database lease and refunds during a lookup cannot expose the result', async () => {
  let release = () => {},
    started = () => {},
    calls = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const f = await usageFixture({
    usage: async () => {
      calls++;
      started();
      await gate;
      return usageReading;
    },
  });
  const get = () => f.service.usage(f.result.orderId, f.units[0].id, null, f.result.accessToken);
  const pending = get();
  await entered;
  const second = await get();
  assert.equal(second.state, 'pending');
  assert.equal(calls, 1);
  await f.units[0].ref.update({ status: 'refunded', paymentBlocked: true });
  release();
  const result = await pending;
  assert.equal(result.state, 'unavailable');
  assert.equal(result.snapshot, null);
  assert.equal((await db.doc('esimUsage/' + f.units[0].id).get()).get('snapshot'), undefined);
});
test('test purchases, undelivered eSIMs and mismatched activation owners never query the supplier', async () => {
  let calls = 0;
  const supplier = {
    usage: async () => {
      calls++;
      return usageReading;
    },
  };
  const sandbox = await usageFixture(supplier, Date.now, true);
  assert.equal(
    (
      await sandbox.service.usage(
        sandbox.result.orderId,
        sandbox.units[0].id,
        null,
        sandbox.result.accessToken,
      )
    ).state,
    'unavailable',
  );
  const f = await usageFixture(supplier);
  await f.units[0].ref.update({ status: 'fulfilling' });
  assert.equal(
    (await f.service.usage(f.result.orderId, f.units[0].id, null, f.result.accessToken)).state,
    'pending',
  );
  await f.units[0].ref.update({ status: 'ready' });
  await db.doc('orderActivations/' + f.units[0].id).update({ uid: 'someone-else' });
  assert.equal(
    (await f.service.usage(f.result.orderId, f.units[0].id, null, f.result.accessToken)).state,
    'pending',
  );
  assert.equal(calls, 0);
});
test('usage supplier reads have a shared burst limit across different purchased units', async () => {
  let calls = 0;
  const now = Date.now();
  const supplier = {
    usage: async () => {
      calls++;
      return usageReading;
    },
  };
  const first = await usageFixture(supplier, () => now),
    second = await usageFixture(supplier, () => now);
  await assert.rejects(
    first.service.usage(first.result.orderId, second.units[0].id, null, first.result.accessToken),
    /not available/,
  );
  const values = await Promise.all(
    [first, second].flatMap((f) =>
      f.units.map((unit) => f.service.usage(f.result.orderId, unit.id, null, f.result.accessToken)),
    ),
  );
  assert.equal(calls, 4);
  assert.equal(values.filter((value) => value.state === 'available').length, 4);
  assert.equal(values.filter((value) => value.state === 'pending').length, 2);
});
test('usage API validates identifiers and auth before supplier access, including guest private links', async () => {
  let calls = 0;
  const f = await usageFixture({
    usage: async () => {
      calls++;
      return usageReading;
    },
  });
  const api = await createApp({
    repository: { plans: async () => [], orders: async () => [], order: async () => null },
    payments: null,
    fulfillment: null,
    commerce: f.service,
    demo: false,
    verify: async (token) => ({
      uid: token,
      email: token === 'alice' ? f.input.email : 'other@example.com',
      verified: token !== 'unverified',
      admin: false,
    }),
  });
  try {
    const url = `/v2/orders/${f.result.orderId}/units/${f.units[0].id}/usage`;
    assert.equal((await api.inject({ method: 'GET', url })).statusCode, 404);
    assert.equal(
      (await api.inject({ method: 'GET', url, headers: { authorization: 'Bearer bob' } }))
        .statusCode,
      404,
    );
    assert.equal(
      (await api.inject({ method: 'GET', url, headers: { authorization: 'Bearer unverified' } }))
        .statusCode,
      401,
    );
    assert.equal(
      (
        await api.inject({
          method: 'GET',
          url: url + '?esimTranNo=other',
          headers: { 'x-order-access': f.result.accessToken },
        })
      ).statusCode,
      400,
    );
    assert.equal(calls, 0);
    const response = await api.inject({
      method: 'GET',
      url,
      headers: { 'x-order-access': f.result.accessToken },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.json().usage.snapshot.remainingBytes, usageReading.remainingBytes);
    assert.equal(
      (await api.inject({ method: 'GET', url, headers: { authorization: 'Bearer alice' } }))
        .statusCode,
      200,
    );
    assert.equal(calls, 1);
  } finally {
    await api.close();
  }
});
test('public Firestore clients cannot read supplier pricing or bypass the importer with direct writes', async () => {
  const f = fixture(true);
  await db.doc('packages/private-pricing-test').set(f.plans[0]);
  const base = 'http://127.0.0.1:8188/v1/projects/demo-alozuri/databases/(default)/documents';
  const now = Math.floor(Date.now() / 1000);
  const token = (admin: boolean) =>
    [
      { alg: 'none', typ: 'JWT' },
      {
        iss: 'https://securetoken.google.com/demo-alozuri',
        aud: 'demo-alozuri',
        sub: 'attacker',
        user_id: 'attacker',
        iat: now,
        exp: now + 3600,
        auth_time: now,
        admin,
        email_verified: true,
        firebase: { identities: {}, sign_in_provider: 'custom' },
      },
    ]
      .map((value) => Buffer.from(JSON.stringify(value)).toString('base64url'))
      .join('.') + '.';
  for (const collection of ['purchases', 'orders', 'carts', 'admins'])
    await db.doc(collection + '/security-probe').set({ uid: 'victim', private: 'must-not-leak' });
  for (const identity of ['anonymous', 'customer', 'admin'] as const) {
    const headers: Record<string, string> =
      identity !== 'anonymous' ? { Authorization: 'Bearer ' + token(identity === 'admin') } : {};
    for (const path of [
      'packages/private-pricing-test',
      'packages',
      'purchases/security-probe',
      'orders/security-probe',
      'carts/security-probe',
      'admins/security-probe',
    ]) {
      const response = await fetch(base + '/' + path, { headers });
      assert.equal(response.status, 403, `${identity} client must not read ${path}`);
      assert.ok(!(await response.text()).includes('must-not-leak'));
    }
    assert.equal(
      (
        await fetch(base + '/packages/private-pricing-test', {
          method: 'PATCH',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({
            fields: { priceCents: { integerValue: '1' }, pricingStatus: { stringValue: 'valid' } },
          }),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + '/admins/self-promotion', {
          method: 'PATCH',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ fields: { admin: { booleanValue: true } } }),
        })
      ).status,
      403,
      `${identity} client must not assign roles through Firestore`,
    );
  }
});

test('maintenance pause blocks new prices/payments while verified payment webhooks can still finish existing orders', async () => {
  const f = fixture(true),
    result = await f.service.checkout(f.input, null);
  const previous = process.env.CHECKOUT_PAUSED;
  process.env.CHECKOUT_PAUSED = 'true';
  try {
    assert.throws(() => f.service.quote(f.input.items), /paused/);
    await assert.rejects(
      f.service.checkout({ ...f.input, requestId: crypto.randomUUID() }, null),
      /paused/,
    );
    f.intent.status = 'succeeded';
    f.intent.amount_received = f.intent.amount;
    await f.event();
    assert.equal((await f.service.order(result.orderId, null, result.accessToken)).status, 'paid');
    assert.equal(f.getCreates(), 1);
  } finally {
    if (previous === undefined) delete process.env.CHECKOUT_PAUSED;
    else process.env.CHECKOUT_PAUSED = previous;
  }
});

test('checkout supplier revalidation skips unchanged writes, persists cost changes and blocks missing prices', async () => {
  const { currentCheckoutPlan } = await import('../src/lib/payments.ts');
  const { SupplierClient, adaptPackage } = await import('../src/lib/supplier.ts');
  const source = {
    packageCode: 'checkout-price-test',
    name: 'France pricing test',
    currencyCode: 'USD',
    price: 10000,
    volume: 1073741824,
    duration: 7,
    durationUnit: 'DAY',
    durationType: 1,
    dataType: 1,
    location: 'FR',
    activeType: 2,
  };
  class ReadOnlySupplier extends SupplierClient {
    row: unknown = source;
    async packages() {
      return [this.row];
    }
  }
  const supplier = new ReadOnlySupplier('', '');
  const initial = adaptPackage(source, new Date().toISOString())!;
  const ref = db.doc('packages/' + initial.id);
  await ref.set(initial);
  const before = await ref.get();
  assert.equal((await currentCheckoutPlan(initial.id, supplier)).priceCents, 249);
  assert.ok((await ref.get()).updateTime!.isEqual(before.updateTime!));
  supplier.row = { ...source, price: 20000 };
  await assert.rejects(currentCheckoutPlan(initial.id, supplier), /plan changed/);
  assert.equal((await ref.get()).get('sellingPriceUsdCents'), 449);
  assert.equal((await currentCheckoutPlan(initial.id, supplier)).priceCents, 449);
  supplier.row = { ...source, price: undefined };
  await assert.rejects(currentCheckoutPlan(initial.id, supplier), /unavailable/);
  assert.equal((await ref.get()).get('pricingStatus'), 'review_required');
  assert.equal((await ref.get()).get('active'), false);
});

test('new orders require consent, store immutable terms, and cannot fulfil before contract confirmation succeeds', async () => {
  let mailBlocked = true;
  const f = fixture(false, undefined, 'USD', () => mailBlocked);
  const withoutConsent = {
    ...f.input,
    legal: { ...CHECKOUT_LEGAL_ACCEPTANCE, noticeAcknowledged: false },
  };
  // API boundary rejects a missing or negative acknowledgement before a payment can be created.
  const api = await createApp({
    repository: { plans: async () => [], orders: async () => [], order: async () => null },
    commerce: f.service,
    payments: null,
    fulfillment: null,
  });
  try {
    const bad = await api.inject({ method: 'POST', url: '/v2/checkout', payload: withoutConsent });
    assert.equal(bad.statusCode, 400);
    assert.equal(f.getCreates(), 0);
    const { legal: omitted, ...missing } = f.input;
    assert.ok(omitted);
    assert.equal(
      (await api.inject({ method: 'POST', url: '/v2/checkout', payload: missing })).statusCode,
      400,
    );
    const started = await f.service.checkout(f.input, null);
    f.intent.status = 'succeeded';
    f.intent.amount_received = f.intent.amount;
    await f.event();
    const children = await db
      .collection('orders')
      .where('parentOrderId', '==', started.orderId)
      .get();
    const store = firestoreFulfillmentStore();
    assert.equal(await store.claim(children.docs[0].id), null);
    const original = (await db.doc('purchases/' + started.orderId).get()).get('legal');
    assert.ok(original.termsText.includes('Rewolo Technologies Ltd'));
    assert.equal(original.immediateSupplyRequested, false);
    assert.equal(original.cancellationAcknowledged, false);
    assert.ok(original.noticeText.includes('By placing your order'));
    assert.equal((await f.service.notify()).sent, 0);
    assert.equal(await store.claim(children.docs[0].id), null);
    mailBlocked = false;
    await db.doc('purchases/' + started.orderId).update({ confirmationDueAt: Date.now() });
    await f.service.notify();
    assert.ok(
      f.emails.some(
        (e) => e.id === started.orderId && e.text.includes('I wish to cancel my Alozuri order'),
      ),
    );
    assert.ok(await store.claim(children.docs[0].id));
    const owned = await f.service.order(started.orderId, null, started.accessToken);
    assert.equal(owned.legal?.termsText, original.termsText);
    await assert.rejects(f.service.order(started.orderId, null, 'wrong'), /not found/);
  } finally {
    await api.close();
  }
});

test('single-email checkout preserves validation, legacy compatibility and verified ownership', async () => {
  const f = fixture(true);
  const api = await createApp({
    repository: { plans: async () => [], orders: async () => [], order: async () => null },
    payments: null,
    fulfillment: null,
    commerce: f.service,
    demo: false,
    verify: async (token) => ({
      uid: token,
      email: f.input.email,
      verified: token !== 'unverified',
      admin: false,
    }),
  });
  try {
    const { emailConfirmation, ...singleEmail } = f.input;
    assert.equal(emailConfirmation, singleEmail.email);
    let caller = 0;
    const checkout = (payload: object, token?: string) =>
      api.inject({
        method: 'POST',
        url: '/v2/checkout',
        remoteAddress: '192.0.2.' + ++caller,
        payload,
        headers: token ? { authorization: 'Bearer ' + token } : {},
      });
    assert.equal((await checkout({ ...singleEmail, email: 'invalid' })).statusCode, 400);
    assert.equal(
      (await checkout({ ...singleEmail, emailConfirmation: 'wrong@example.test' })).statusCode,
      400,
    );
    assert.equal((await checkout(singleEmail, 'unverified')).statusCode, 401);
    assert.equal(f.getCreates(), 0);
    const guest = await checkout(singleEmail);
    assert.equal(guest.statusCode, 200);
    const guestId = guest.json().orderId;
    assert.equal((await db.doc('purchases/' + guestId).get()).get('uid'), null);
    assert.equal((await checkout(f.input)).json().orderId, guestId);
    assert.equal(f.getCreates(), 1);
    const signedIn = await checkout({ ...singleEmail, requestId: crypto.randomUUID() }, 'alice');
    assert.equal(signedIn.statusCode, 200);
    assert.equal((await db.doc('purchases/' + signedIn.json().orderId).get()).get('uid'), 'alice');
    await assert.rejects(
      f.service.history({ uid: 'unverified', email: f.input.email, verified: false, admin: false }),
      /verified/,
    );
    assert.ok(
      (
        await f.service.history({
          uid: 'new-account',
          email: f.input.email,
          verified: true,
          admin: false,
        })
      ).some((purchase) => purchase.id === guestId),
    );
    const denied = await api.inject({
      url: '/v2/orders/' + guestId,
      headers: { authorization: 'Bearer unverified' },
    });
    assert.equal(denied.statusCode, 401);
  } finally {
    await api.close();
  }
});

test('concurrent confirmation workers and webhook retries send one immutable complete email per purchase', async () => {
  const f = fixture();
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await Promise.all([f.event(), f.event()]);
  const ref = db.doc('purchases/' + result.orderId);
  const purchase = await ref.get();
  const accepted = purchase.get('legal');
  const previous = POLICIES.terms.sections[0].paragraphs[0];
  POLICIES.terms.sections[0].paragraphs[0] =
    'MUTABLE WEBSITE CONTENT MUST NOT ENTER AN OLD CONTRACT';
  try {
    await Promise.all([f.service.notify(), f.service.notify(), f.service.notify()]);
    const emails = f.emails.filter((email) => email.id === result.orderId);
    assert.equal(emails.length, 1);
    assert.ok(emails[0].text.includes(accepted.termsText));
    assert.ok(emails[0].text.includes(accepted.refundText));
    assert.ok(!emails[0].text.includes('MUTABLE WEBSITE CONTENT'));
    assert.ok(emails[0].text.includes(new Date(1794430800 * 1000).toISOString()));
    assert.equal((await ref.get()).get('paidAt'), new Date(1794430800 * 1000).toISOString());
    assert.equal((await ref.get()).get('confirmationStatus'), 'sent');
    assert.equal((await ref.get()).get('confirmationDeliveryStatus'), 'delivered');
    assert.deepEqual((await ref.get()).get('legal'), accepted);
    assert.equal('attachments' in emails[0], false);
    await f.event();
    await f.service.notify();
    assert.equal(f.emails.filter((email) => email.id === result.orderId).length, 1);
  } finally {
    POLICIES.terms.sections[0].paragraphs[0] = previous;
  }
});

test('confirmation provider failures retry with the same payload and never blindly resend past its safe window', async () => {
  let blocked = true;
  const f = fixture(false, undefined, 'USD', () => blocked);
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  const ref = db.doc('purchases/' + result.orderId);
  await f.service.notify();
  const first = await ref.get();
  assert.equal(first.get('confirmationStatus'), 'retry');
  assert.equal(first.get('confirmationError'), 'email_failed');
  blocked = false;
  await ref.update({ confirmationDueAt: Date.now() });
  await f.service.notify();
  const sent = await ref.get();
  assert.equal(sent.get('confirmationFirstSendAt'), first.get('confirmationFirstSendAt'));
  assert.equal(sent.get('confirmationPayloadHash'), first.get('confirmationPayloadHash'));
  assert.equal(f.emails.filter((email) => email.id === result.orderId).length, 1);

  blocked = true;
  f.intent.status = 'requires_payment_method';
  const late = await f.service.checkout({ ...f.input, requestId: crypto.randomUUID() }, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  await f.service.notify();
  const lateRef = db.doc('purchases/' + late.orderId);
  await lateRef.update({
    confirmationDueAt: Date.now(),
    confirmationFirstSendAt: Date.now() - SAFE_EMAIL_RETRY_MS - 1,
  });
  blocked = false;
  await f.service.notify();
  assert.equal((await lateRef.get()).get('confirmationStatus'), 'attention');
  assert.equal((await lateRef.get()).get('confirmationError'), 'send_reconciliation_required');
  assert.equal(f.emails.filter((email) => email.id === late.orderId).length, 0);
});

test('pending or bounced email delivery cannot begin supply, and delivery reconciliation sends no second email', async () => {
  let event = 'sent';
  const f = fixture(false, undefined, 'USD', undefined, undefined, () => event);
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  await f.service.notify();
  const ref = db.doc('purchases/' + result.orderId);
  const units = await db.collection('orders').where('parentOrderId', '==', result.orderId).get();
  const store = firestoreFulfillmentStore();
  assert.equal(await store.claim(units.docs[0].id), null);
  assert.equal((await ref.get()).get('confirmationDeliveryStatus'), 'pending');
  event = 'delivered';
  await ref.update({ confirmationDeliveryDueAt: Date.now() });
  await f.service.notify();
  assert.ok(await store.claim(units.docs[0].id));
  assert.equal(f.emails.filter((email) => email.id === result.orderId).length, 1);

  event = 'bounced';
  f.intent.status = 'requires_payment_method';
  const bounced = await f.service.checkout({ ...f.input, requestId: crypto.randomUUID() }, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  await f.service.notify();
  const failed = await db.doc('purchases/' + bounced.orderId).get();
  assert.equal(failed.get('confirmationDeliveryStatus'), 'failed');
  assert.equal(
    (await f.service.order(bounced.orderId, null, bounced.accessToken)).confirmationNeedsSupport,
    true,
  );
  await f.service.notify();
  assert.equal(f.emails.filter((email) => email.id === bounced.orderId).length, 1);
});

test('legacy already-confirmed or ambiguous orders cannot receive another routine email', async () => {
  for (const ambiguous of [false, true]) {
    const f = fixture();
    const result = await f.service.checkout(f.input, null);
    f.intent.status = 'succeeded';
    f.intent.amount_received = f.intent.amount;
    await f.event();
    const ref = db.doc('purchases/' + result.orderId);
    await ref.update({
      confirmationVersion: FieldValue.delete(),
      confirmationDueAt: FieldValue.delete(),
      contractEmailDueAt: Date.now(),
      emailDueAt: Date.now(),
      ...(ambiguous
        ? { contractEmailLeaseUntil: 0 }
        : { contractEmailSentAt: '2026-11-11T12:03:12.000Z' }),
    });
    await f.service.notify();
    assert.equal(f.emails.filter((email) => email.id === result.orderId).length, 0);
    const updated = await ref.get();
    if (ambiguous) assert.equal(updated.get('confirmationError'), 'legacy_send_review_required');
    assert.equal(updated.get('contractEmailDueAt'), undefined);
    assert.equal(updated.get('emailDueAt'), undefined);
  }
});
