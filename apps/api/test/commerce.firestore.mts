import { Promotions, discountUnit } from '../src/lib/promotions.ts';
import { contributionPreview } from '../src/lib/promotion-routes.ts';
import { OperationsEsims } from '../src/lib/operations-esims.ts';
import { orderReference } from '../src/lib/confirmation-order.ts';
import { UserProfiles, type ProfileDirectory } from '../src/lib/user-profiles.ts';
import { pendingOrderWork, prepareOrderWork } from '../src/lib/order-work-recovery.ts';
import { OrderWorker } from '../src/lib/order-worker.ts';
import {
  dispatchOrderWork,
  type OrderTaskQueue,
  type OrderWork,
} from '../src/lib/order-task-queue.ts';
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
import {
  confirmationEmail,
  confirmationPayloadHash,
  type ConfirmationEmail,
} from '../src/lib/order-email.ts';
import { confirmationOrderSchema } from '../src/lib/confirmation-order.ts';
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
  taskQueue: OrderTaskQueue | null = null,
  legacyConfirmation = true,
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
  const paymentRequests: { params: Stripe.PaymentIntentCreateParams; key: string }[] = [];
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
        paymentRequests.push({ params: structuredClone(params), key: options.idempotencyKey });
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
      cancel: async () => {
        intent.status = 'canceled';
        return intent;
      },
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
    taskQueue,
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
    const response = await service.webhook(
      Buffer.from(payload),
      signer.webhooks.generateTestHeaderString({ payload, secret: 'whsec_fixture' }),
    );
    // Existing regression scenarios model payments already committed by the old release.
    if (legacyConfirmation && intent.metadata.alozuriPurchaseId) {
      await db
        .doc('purchases/' + intent.metadata.alozuriPurchaseId)
        .update({ confirmationVersion: 'email-v1' });
    }
    return response;
  }
  return {
    plans,
    intent,
    stripe,
    service,
    input,
    event,
    emails,
    paymentRequests,
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
    profiles: new UserProfiles(db, profileDirectory('alice', f.input.email).directory),
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

test('contract PDF download checks ownership and verified payment, streams privately and never stores or emails a PDF', async () => {
  const f = fixture();
  const order = await f.service.checkout(f.input, null);
  const server = await createApp({
    repository: { plans: async () => [], orders: async () => [], order: async () => null },
    commerce: f.service,
    payments: null,
    fulfillment: null,
    verify: async (token) => ({
      uid: token,
      email: token === 'owner' ? f.input.email : 'other@example.test',
      verified: true,
      admin: token === 'admin',
    }),
  });
  const url = '/v2/orders/' + order.orderId + '/contract.pdf';
  try {
    const unpaid = await server.inject({
      method: 'GET',
      url,
      headers: { 'x-order-access': order.accessToken },
    });
    assert.equal(unpaid.statusCode, 409);
    f.intent.status = 'succeeded';
    f.intent.amount_received = f.intent.amount;
    await f.event();
    const before = (await db.doc('purchases/' + order.orderId).get()).data();
    for (const headers of [
      {},
      { 'x-order-access': 'wrong' },
      { authorization: 'Bearer other' },
      { authorization: 'Bearer admin' },
    ]) {
      assert.equal((await server.inject({ method: 'GET', url, headers })).statusCode, 404);
    }
    for (const headers of [
      { 'x-order-access': order.accessToken },
      { authorization: 'Bearer owner' },
    ]) {
      const response = await server.inject({ method: 'GET', url, headers });
      assert.equal(response.statusCode, 200);
      assert.match(String(response.headers['content-type']), /application\/pdf/);
      assert.match(
        String(response.headers['content-disposition']),
        /attachment; filename="Alozuri-Order-Confirmation.pdf"/,
      );
      assert.match(String(response.headers['cache-control']), /no-store/);
      assert.equal(response.rawPayload.subarray(0, 5).toString(), '%PDF-');
      assert.ok(response.rawPayload.length < 200000);
    }
    assert.deepEqual((await db.doc('purchases/' + order.orderId).get()).data(), before);
    assert.equal(f.emails.length, 0);
    assert.equal(
      (await f.service.order(order.orderId, null, order.accessToken)).contractDownloadAvailable,
      true,
    );
  } finally {
    await server.close();
  }
});

test('concurrent guest-cart merge retries add one item once and create a PaymentIntent for the exact single-item total', async () => {
  const f = fixture();
  const server = await createApp({
    repository: { plans: async () => f.plans, orders: async () => [], order: async () => null },
    commerce: f.service,
    payments: null,
    fulfillment: null,
    verify: async () => ({
      uid: 'cart-concurrency-buyer',
      email: f.input.email,
      verified: true,
      admin: false,
    }),
  });
  try {
    const headers = { authorization: 'Bearer controlled-buyer' },
      items = [{ planId: f.plans[0].id, quantity: 1 }],
      mergeId = crypto.randomUUID();
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        server.inject({
          method: 'POST',
          url: '/v2/cart/merge',
          headers,
          payload: { items, mergeId },
        }),
      ),
    );
    for (const response of responses) {
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().items[0].quantity, 1);
    }
    const saved = await db.doc('carts/cart-concurrency-buyer').get();
    assert.deepEqual(saved.get('items'), items);
    assert.equal(saved.get('version'), 1);
    const quoted = await server.inject({
      method: 'POST',
      url: '/v2/quote',
      payload: { items, currency: 'USD' },
    });
    const total = quoted.json().quote.totalCents;
    assert.equal(total, f.plans[0].priceCents);
    const result = await server.inject({
      method: 'POST',
      url: '/v2/checkout',
      headers,
      payload: { ...f.input, items, expectedTotalCents: total },
    });
    assert.equal(result.statusCode, 200);
    assert.equal(f.intent.amount, total);
    assert.equal(f.getCreates(), 1);
    assert.equal(result.json().quote.items[0].quantity, 1);
    const stored = await db.doc('purchases/' + result.json().orderId).get();
    assert.equal(stored.get('totalCents'), total);
    assert.equal(stored.get('items')[0].quantity, 1);
  } finally {
    await server.close();
  }
});

test('payment commits a durable dispatch intent; an identical Stripe replay repairs a failed enqueue without allocating twice', async () => {
  const tasks: OrderWork[] = [];
  let fail = true;
  const f = fixture(false, undefined, 'USD', undefined, undefined, undefined, {
    enqueue: async (work) => {
      if (fail) throw new Error('Queue unavailable');
      tasks.push(work);
    },
  });
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'processing';
  await f.event('payment_intent.processing');
  assert.equal((await db.doc('orderWork/' + result.orderId).get()).exists, false);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  const eventId = 'evt_queue_' + crypto.randomUUID().replaceAll('-', '');
  await assert.rejects(f.event('payment_intent.succeeded', eventId), /dispatch unavailable/);
  const pending = await db.doc('orderWork/' + result.orderId).get();
  assert.equal(pending.get('status'), 'pending');
  assert.ok((await db.doc('purchases/' + result.orderId).get()).get('paidAt'));
  fail = false;
  await f.event('payment_intent.succeeded', eventId);
  await f.event('payment_intent.succeeded', eventId);
  assert.deepEqual(tasks, [{ kind: 'purchase', id: result.orderId, generation: 1 }]);
  assert.equal(
    (await db.collection('orders').where('parentOrderId', '==', result.orderId).get()).size,
    3,
  );
  assert.equal((await db.doc('orderWork/' + result.orderId).get()).get('status'), 'queued');
  assert.equal(f.emails.length, 0); // Webhook only queues, never performs supplier/email work.
});

test('targeted queue worker sends one email and provisions only that purchase under duplicate concurrent deliveries', async () => {
  const tasks: OrderWork[] = [];
  const queue = {
    enqueue: async (work: OrderWork) => {
      tasks.push(work);
    },
  };
  const f = fixture(false, undefined, 'USD', undefined, undefined, undefined, queue);
  const other = fixture(false, undefined, 'USD', undefined, undefined, undefined, queue);
  const result = await f.service.checkout(f.input, null),
    otherResult = await other.service.checkout(other.input, null);
  for (const candidate of [f, other]) {
    candidate.intent.status = 'succeeded';
    candidate.intent.amount_received = candidate.intent.amount;
    await candidate.event();
  }
  const work = tasks.find((task) => task.id === result.orderId)!;
  const calls: string[] = [];
  let allocation = 0;
  const delivery = new FulfillmentService(f.stripe, firestoreFulfillmentStore(), {
    order: async (tx) => {
      calls.push(tx);
      return 'supplier-' + tx;
    },
    profile: async () => ({
      ac: 'LPA:1$example.com$queued-' + ++allocation,
      iccid: '89852245280001113' + String(allocation).padStart(2, '0'),
      esimTranNo: 'queued-' + allocation,
    }),
  });
  const worker = new OrderWorker(db, f.service, delivery, queue);
  const responses = await Promise.all([worker.run(work), worker.run(work)]);
  assert.ok(responses.some((response) => response.state === 'complete'));
  assert.equal((await worker.run(work)).state, 'ignored');
  assert.equal(calls.length, 3);
  assert.equal(new Set(calls).size, 3);
  assert.equal(f.emails.length, 1);
  assert.equal(other.emails.length, 0);
  assert.ok(
    (await f.service.order(result.orderId, null, result.accessToken)).allocations.every(
      (unit) => unit.status === 'ready',
    ),
  );
  assert.ok(
    (
      await other.service.order(otherResult.orderId, null, otherResult.accessToken)
    ).allocations.every((unit) => unit.status === 'paid'),
  );
  assert.equal((await db.doc('orderWork/' + result.orderId).get()).get('status'), 'done');
});

test('queued email failures retain work, respect retry dates and block supply until confirmation delivery', async () => {
  let fail = true;
  let event = 'sent';
  const tasks: OrderWork[] = [];
  const queue = {
    enqueue: async (work: OrderWork) => {
      tasks.push(work);
    },
  };
  const f = fixture(
    false,
    undefined,
    'USD',
    () => fail,
    undefined,
    () => event,
    queue,
  );
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  let supplied = 0;
  const delivery = new FulfillmentService(f.stripe, firestoreFulfillmentStore(), {
    order: async () => {
      supplied++;
      return 'queued-supplier';
    },
    profile: async () => null,
  });
  const worker = new OrderWorker(db, f.service, delivery, queue),
    ref = db.doc('purchases/' + result.orderId);
  async function consume() {
    await db.doc('orderWork/' + result.orderId).update({ runAfterAt: Date.now() - 1 });
    return worker.run(tasks[tasks.length - 1]);
  }
  assert.equal((await consume()).state, 'scheduled');
  assert.equal(supplied, 0);
  assert.equal(f.emails.length, 0);
  const attempts = (await ref.get()).get('confirmationAttempts');
  fail = false;
  assert.equal((await consume()).state, 'scheduled');
  assert.equal((await ref.get()).get('confirmationAttempts'), attempts);
  await ref.update({ confirmationDueAt: Date.now() - 1 });
  await consume();
  assert.equal(f.emails.length, 1);
  assert.equal(supplied, 0);
  event = 'delivered';
  await ref.update({ confirmationDeliveryDueAt: Date.now() - 1 });
  assert.equal((await consume()).state, 'scheduled'); // Supplier allocation is still pending.
  assert.equal(supplied, 3);
  assert.equal(f.emails.length, 1);
  assert.equal((await db.doc('orderWork/' + result.orderId).get()).get('status'), 'queued');
});

test('queue work is bounded, ignores stale generations, and never processes test or unpaid orders', async () => {
  const work: OrderWork = { kind: 'purchase', id: 'purchase_' + 'f'.repeat(48), generation: 1 };
  const ref = db.doc('orderWork/' + work.id);
  let calls = 0;
  const worker = new OrderWorker(
    db,
    {
      notify: async () => {
        calls++;
        return { sent: 0, failed: 0, attention: 0 };
      },
    },
    {
      run: async () => {
        calls++;
        return { processed: 0, failed: 0 };
      },
    },
    {
      enqueue: async () => {
        throw new Error('Unexpected dispatch');
      },
    },
  );
  assert.equal((await worker.run(work)).state, 'ignored');
  await ref.set({ ...work, status: 'queued', deadlineAt: Date.now() + 60000 });
  assert.equal((await worker.run({ ...work, generation: 2 })).state, 'ignored');
  assert.equal((await worker.run(work)).state, 'attention'); // No paid purchase.
  assert.equal(calls, 0);
  await ref.update({ status: 'queued', deadlineAt: Date.now() - 1 });
  assert.equal((await worker.run(work)).state, 'attention');
  assert.equal((await ref.get()).get('reason'), 'processing_deadline_exceeded');
  const tasks: OrderWork[] = [];
  const f = fixture(true, undefined, 'USD', undefined, undefined, undefined, {
    enqueue: async (task) => {
      tasks.push(task);
    },
  });
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  assert.deepEqual(tasks, []);
  assert.equal((await db.doc('orderWork/' + result.orderId).get()).exists, false);
});

test('a failed delayed-task submission is repaired by replaying the previous task without resending email', async () => {
  const tasks: OrderWork[] = [];
  let fail = false;
  const queue = {
    enqueue: async (work: OrderWork) => {
      if (fail) throw new Error('Queue unavailable');
      tasks.push(work);
    },
  };
  const f = fixture(false, undefined, 'USD', undefined, undefined, () => 'sent', queue);
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  const original = tasks[0];
  let supplied = 0;
  const delivery = new FulfillmentService(f.stripe, firestoreFulfillmentStore(), {
    order: async () => {
      supplied++;
      return 'unexpected';
    },
    profile: async () => null,
  });
  const worker = new OrderWorker(db, f.service, delivery, queue);
  fail = true;
  await assert.rejects(worker.run(original), /dispatch unavailable/);
  const pending = await db.doc('orderWork/' + result.orderId).get();
  assert.equal(pending.get('status'), 'pending');
  assert.equal(pending.get('generation'), 2);
  assert.equal(f.emails.length, 1);
  assert.equal(supplied, 0);
  fail = false;
  assert.equal((await worker.run(original)).state, 'scheduled');
  assert.equal(tasks[1].generation, 2);
  assert.equal((await worker.run(original)).state, 'ignored');
  assert.equal((await worker.run(tasks[1])).state, 'pending'); // Too early: no send or supply.
  assert.equal(f.emails.length, 1);
  assert.equal(supplied, 0);
});

test('migration inventories existing work, seeds it once and redrives attention work without clearing provider state', async () => {
  const f = fixture();
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  const candidates = await pendingOrderWork(db);
  assert.equal(candidates.filter((work) => work.id === result.orderId).length, 1);
  const prepared = await prepareOrderWork(db, { kind: 'purchase', id: result.orderId });
  assert.deepEqual(prepared, { kind: 'purchase', id: result.orderId, generation: 1 });
  assert.deepEqual(await prepareOrderWork(db, { kind: 'purchase', id: result.orderId }), prepared);
  const before = (await db.doc('purchases/' + result.orderId).get()).data();
  await assert.rejects(
    prepareOrderWork(db, { kind: 'purchase', id: result.orderId }, true),
    /Active work/,
  );
  await db.doc('orderWork/' + result.orderId).update({ status: 'attention', leaseUntil: 0 });
  const redriven = await prepareOrderWork(db, { kind: 'purchase', id: result.orderId }, true);
  assert.equal(redriven?.generation, 2);
  assert.deepEqual((await db.doc('purchases/' + result.orderId).get()).data(), before);
  const queued: OrderWork[] = [];
  await dispatchOrderWork(
    db,
    {
      enqueue: async (work) => {
        queued.push(work);
      },
    },
    result.orderId,
  );
  assert.deepEqual(queued, [redriven]);
});

test('queued supplier allocation retries keep the same supplier order without buying again', async () => {
  const tasks: OrderWork[] = [];
  const queue = {
    enqueue: async (work: OrderWork) => {
      tasks.push(work);
    },
  };
  const f = fixture(false, undefined, 'USD', undefined, undefined, undefined, queue);
  const singleInput = {
    ...f.input,
    items: [{ planId: f.plans[0].id, quantity: 1 }],
    expectedTotalCents: f.plans[0].priceCents,
  };
  const result = await f.service.checkout(singleInput, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  let purchases = 0,
    ready = false;
  const delivery = new FulfillmentService(f.stripe, firestoreFulfillmentStore(), {
    order: async () => {
      purchases++;
      return 'supplier-queued-existing';
    },
    profile: async (orderNo) => {
      assert.equal(orderNo, 'supplier-queued-existing');
      return ready
        ? {
            ac: 'LPA:1$example.com$queued-retry',
            iccid: '89852245280001113019',
            esimTranNo: 'queued-retry',
          }
        : null;
    },
  });
  const worker = new OrderWorker(db, f.service, delivery, queue);
  assert.equal((await worker.run(tasks[0])).state, 'scheduled');
  assert.equal(purchases, 1);
  const units = await db.collection('orders').where('parentOrderId', '==', result.orderId).get();
  await db.doc('fulfillmentJobs/' + units.docs[0].id).update({ nextAttemptAt: Date.now() - 1 });
  await db.doc('orderWork/' + result.orderId).update({ runAfterAt: Date.now() - 1 });
  ready = true;
  assert.equal((await worker.run(tasks[1])).state, 'complete');
  assert.equal(purchases, 1);
  assert.equal(f.emails.length, 1);
});

test('ten eSIMs drain in bounded batches without starving later units or sending extra emails', async () => {
  const tasks: OrderWork[] = [];
  const queue = {
    enqueue: async (work: OrderWork) => {
      tasks.push(work);
    },
  };
  const f = fixture(false, undefined, 'USD', undefined, undefined, undefined, queue);
  const input = {
    ...f.input,
    items: f.plans.map((plan) => ({ planId: plan.id, quantity: 5 })),
    expectedTotalCents: f.plans.reduce((total, plan) => total + plan.priceCents * 5, 0),
  };
  const result = await f.service.checkout(input, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  const transactions = new Set<string>();
  const delivery = new FulfillmentService(f.stripe, firestoreFulfillmentStore(), {
    order: async (tx) => {
      assert.equal(transactions.has(tx), false);
      transactions.add(tx);
      return 'supplier-' + tx;
    },
    profile: async (orderNo) => ({
      ac: 'LPA:1$example.com$' + orderNo,
      iccid: '89852245280001113019',
      esimTranNo: orderNo,
    }),
  });
  const worker = new OrderWorker(db, f.service, delivery, queue);
  for (let batch = 0; batch < 4; batch++) {
    await db.doc('orderWork/' + result.orderId).update({ runAfterAt: Date.now() - 1 });
    const response = await worker.run(tasks[tasks.length - 1]);
    assert.equal(response.state, batch < 3 ? 'scheduled' : 'complete');
    assert.equal(transactions.size, Math.min(10, (batch + 1) * 3));
  }
  assert.equal(f.emails.length, 1);
  assert.ok(
    (await f.service.order(result.orderId, null, result.accessToken)).allocations.every(
      (unit) => unit.status === 'ready',
    ),
  );
});

test('a paid eSIM with a missing fulfilment record is marked for support, never silently completed', async () => {
  const tasks: OrderWork[] = [];
  const queue = {
    enqueue: async (work: OrderWork) => {
      tasks.push(work);
    },
  };
  const f = fixture(false, undefined, 'USD', undefined, undefined, undefined, queue);
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  const units = await db.collection('orders').where('parentOrderId', '==', result.orderId).get();
  for (const unit of units.docs) await db.doc('fulfillmentJobs/' + unit.id).delete();
  const worker = new OrderWorker(
    db,
    f.service,
    { run: async () => ({ processed: 0, failed: 0 }) },
    queue,
  );
  assert.equal((await worker.run(tasks[0])).state, 'attention');
  assert.equal(
    (await db.doc('orderWork/' + result.orderId).get()).get('reason'),
    'missing_fulfillment_work',
  );
  assert.ok(
    (await f.service.order(result.orderId, null, result.accessToken)).allocations.every(
      (unit) => unit.status === 'paid',
    ),
  );
});

test('HTTP queue flow verifies payment, acknowledges scheduled waiting, and completes one purchase without a polling scan', async () => {
  const tasks: OrderWork[] = [];
  const queue = {
    enqueue: async (work: OrderWork) => {
      tasks.push(work);
    },
  };
  const f = fixture(false, undefined, 'USD', undefined, undefined, undefined, queue);
  let supplied = 0,
    ready = false;
  const delivery = new FulfillmentService(f.stripe, firestoreFulfillmentStore(), {
    order: async (tx) => {
      supplied++;
      return 'http-supplier-' + tx;
    },
    profile: async (orderNo) =>
      ready
        ? { ac: 'LPA:1$example.com$' + orderNo, iccid: '89852245280001113019', esimTranNo: orderNo }
        : null,
  });
  const server = await createApp({
    payments: null,
    commerce: f.service,
    fulfillment: delivery,
    repository: { plans: async () => f.plans, orders: async () => [], order: async () => null },
    orderWorker: new OrderWorker(db, f.service, delivery, queue),
    verifyOrderTask: async (header) => header === 'Bearer controlled-service-identity',
  });
  try {
    const checkout = await server.inject({ method: 'POST', url: '/v2/checkout', payload: f.input });
    assert.equal(checkout.statusCode, 200);
    const result = checkout.json();
    f.intent.status = 'succeeded';
    f.intent.amount_received = f.intent.amount;
    const payload = JSON.stringify({
      id: 'evt_http_queue_' + crypto.randomUUID().replaceAll('-', ''),
      object: 'event',
      created: 1794430800,
      livemode: true,
      type: 'payment_intent.succeeded',
      data: { object: f.intent },
    });
    assert.equal(
      (
        await server.inject({
          method: 'POST',
          url: '/v1/webhooks/stripe',
          headers: { 'content-type': 'application/json', 'stripe-signature': 'invalid' },
          payload,
        })
      ).statusCode,
      400,
    );
    assert.equal(tasks.length, 0);
    const payment = await server.inject({
      method: 'POST',
      url: '/v1/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signer.webhooks.generateTestHeaderString({
          payload,
          secret: 'whsec_fixture',
        }),
      },
      payload,
    });
    assert.equal(payment.statusCode, 200);
    assert.equal(tasks.length, 1);
    assert.equal(f.emails.length, 0);
    assert.equal(supplied, 0);
    const firstTask = tasks[0],
      taskHeaders = { authorization: 'Bearer controlled-service-identity' };
    const first = await server.inject({
      method: 'POST',
      url: '/internal/orders/process',
      headers: taskHeaders,
      payload: firstTask,
    });
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().state, 'scheduled');
    assert.equal(f.emails.length, 0);
    assert.equal(supplied, 3);
    assert.equal(tasks.length, 2);
    const replay = await server.inject({
      method: 'POST',
      url: '/internal/orders/process',
      headers: taskHeaders,
      payload: firstTask,
    });
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.json().state, 'ignored');
    assert.equal(supplied, 3);
    assert.equal(f.emails.length, 0);
    const units = await db.collection('orders').where('parentOrderId', '==', result.orderId).get();
    for (const unit of units.docs)
      await db.doc('fulfillmentJobs/' + unit.id).update({ nextAttemptAt: Date.now() - 1 });
    await db.doc('orderWork/' + result.orderId).update({ runAfterAt: Date.now() - 1 });
    ready = true;
    const last = await server.inject({
      method: 'POST',
      url: '/internal/orders/process',
      headers: taskHeaders,
      payload: tasks[1],
    });
    assert.equal(last.statusCode, 200);
    assert.equal(last.json().state, 'complete');
    const receipt = await server.inject({
      method: 'GET',
      url: '/v2/orders/' + result.orderId,
      headers: { 'x-order-access': result.accessToken },
    });
    assert.equal(receipt.statusCode, 200);
    assert.ok(
      receipt.json().allocations.every((unit: { status: string }) => unit.status === 'ready'),
    );
    assert.equal(supplied, 3);
    assert.equal(f.emails.length, 1);
  } finally {
    await server.close();
  }
});

function profileDirectory(uid: string, email: string, verified = true) {
  const current = {
    uid,
    email,
    emailVerified: verified,
    disabled: false,
    displayName: 'Mary Jane Smith',
    metadata: {
      creationTime: '2026-01-01T10:00:00.000Z',
      lastSignInTime: '2026-11-12T10:00:00.000Z',
    },
    providerData: [{ providerId: 'password' }],
  };
  const updates = 0;
  const directory: ProfileDirectory = {
    getUser: async (requested) => {
      assert.equal(requested, uid);
      return current;
    },
  };
  return { current, directory, updates: () => updates };
}
test('user profile sync creates private validated records and only accepts names from the authenticated customer', async () => {
  const source = profileDirectory('profile-owner', 'Profile.Owner@example.test');
  const profiles = new UserProfiles(db, source.directory);
  const principal = {
    uid: source.current.uid,
    email: source.current.email,
    verified: true,
    admin: false,
  };
  const server = await createApp({
    payments: null,
    commerce: null,
    fulfillment: null,
    profiles,
    verify: async (token) => {
      if (token !== 'owner') throw new Error('Invalid');
      return principal;
    },
  });
  try {
    const url = '/v2/profile',
      headers = { authorization: 'Bearer owner' };
    assert.equal((await server.inject({ method: 'GET', url })).statusCode, 401);
    assert.equal(
      (
        await server.inject({
          method: 'POST',
          url,
          headers,
          payload: { uid: 'victim', admin: true },
        })
      ).statusCode,
      400,
    );
    assert.equal((await db.doc('users/victim').get()).exists, false);
    const synced = await server.inject({ method: 'POST', url, headers, payload: {} });
    assert.equal(synced.statusCode, 200);
    const profile = synced.json().profile;
    assert.equal(profile.uid, principal.uid);
    assert.equal(profile.email, 'profile.owner@example.test');
    assert.equal(profile.createdAt, source.current.metadata.creationTime);
    assert.equal(profile.lastSignInAt, source.current.metadata.lastSignInTime);
    const writeTime = (await db.doc('users/' + principal.uid).get()).updateTime;
    await profiles.sync(principal);
    assert.deepEqual((await db.doc('users/' + principal.uid).get()).updateTime, writeTime);
    for (const payload of [
      { firstName: 'Mary', lastName: 'Smith', admin: true },
      { firstName: 'Mary', lastName: 'Smith', email: 'victim@example.test' },
      { firstName: '<script>', lastName: 'Smith' },
    ])
      assert.equal(
        (await server.inject({ method: 'PATCH', url, headers, payload })).statusCode,
        400,
      );
    assert.equal(source.updates(), 0);
    const updated = await server.inject({
      method: 'PATCH',
      url,
      headers,
      payload: { firstName: 'Mary Jane', lastName: 'Smith' },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().profile.firstName, 'Mary Jane');
    assert.equal((await profiles.sync(principal)).firstName, 'Mary Jane');
    assert.equal(source.current.displayName, 'Mary Jane Smith');
    assert.ok(!JSON.stringify(updated.json()).includes('admin'));
    assert.equal(
      (
        await server.inject({
          method: 'PATCH',
          url,
          headers,
          payload: { firstName: 'Mary', lastName: 'Smith' },
        })
      ).statusCode,
      200,
    );
    source.current.disabled = true;
    assert.equal((await server.inject({ method: 'GET', url, headers })).statusCode, 401);
    const anonymous = await fetch(
      `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-alozuri/databases/(default)/documents/users/${principal.uid}`,
    );
    assert.equal(anonymous.status, 403);
  } finally {
    await server.close();
  }
});

test('verified guest claim atomically links purchase, eSIMs and activation records; email alone never opens another UID-owned account', async () => {
  let calls = 0;
  const f = await usageFixture({
    usage: async () => {
      calls++;
      return usageReading;
    },
  });
  const email = 'claim-' + crypto.randomUUID() + '@example.test';
  await db.doc('purchases/' + f.result.orderId).update({ email });
  const source = profileDirectory('claim-owner-' + crypto.randomUUID(), email, false);
  const profiles = new UserProfiles(db, source.directory);
  const principal = { uid: source.current.uid, email, verified: true, admin: false };
  await profiles.sync(principal); // Even a stale verified token cannot override current Firebase state.
  assert.equal((await db.doc('purchases/' + f.result.orderId).get()).get('uid'), null);
  source.current.emailVerified = true;
  await profiles.sync(principal);
  const parent = await db.doc('purchases/' + f.result.orderId).get();
  assert.equal(parent.get('uid'), principal.uid);
  for (const unit of f.units) {
    assert.equal((await unit.ref.get()).get('uid'), principal.uid);
    assert.equal((await db.doc('orderActivations/' + unit.id).get()).get('uid'), principal.uid);
  }
  assert.equal(
    (await f.service.usage(f.result.orderId, f.units[0].id, principal, undefined)).state,
    'available',
  );
  const stranger = { uid: 'another-uid', email, verified: true, admin: true };
  await assert.rejects(f.service.order(f.result.orderId, stranger, undefined), /not found/);
  await assert.rejects(
    f.service.usage(f.result.orderId, f.units[0].id, stranger, undefined),
    /not found/,
  );
  await assert.rejects(
    f.service.activation(f.result.orderId, f.units[0].id, stranger, undefined),
    /not found/,
  );
  await assert.rejects(f.service.contractPdf(f.result.orderId, stranger, undefined), /not found/);
  assert.ok(!(await f.service.history(stranger)).some((order) => order.id === f.result.orderId));
  assert.equal(calls, 1);
  source.current.email = 'new-address@example.test';
  const updated = { ...principal, email: source.current.email };
  await profiles.sync(updated);
  assert.ok((await f.service.history(updated)).some((order) => order.id === f.result.orderId));
  assert.equal(
    (await f.service.order(f.result.orderId, null, f.result.accessToken)).id,
    f.result.orderId,
  );
});

test('usage rechecks current account ownership after a slow supplier request and withholds flagged payments', async () => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    started = new Promise<void>((resolve) => {
      entered = resolve;
    });
  const f = await usageFixture({
    usage: async () => {
      entered();
      await gate;
      return usageReading;
    },
  });
  const principal = {
    uid: 'old-email-session',
    email: f.input.email,
    verified: true,
    admin: false,
  };
  const lookup = f.service.usage(f.result.orderId, f.units[0].id, principal, undefined);
  await started;
  await db.doc('purchases/' + f.result.orderId).update({ uid: 'new-owner' });
  for (const unit of f.units) {
    await unit.ref.update({ uid: 'new-owner' });
    await db.doc('orderActivations/' + unit.id).update({ uid: 'new-owner' });
  }
  release();
  await assert.rejects(lookup, /not found/);
  await db.doc('purchases/' + f.result.orderId).update({ status: 'attention' });
  const result = await f.service.usage(f.result.orderId, f.units[0].id, null, f.result.accessToken);
  assert.equal(result.state, 'unavailable');
  assert.equal(result.snapshot, null);
});

test('profile UID corruption and invalid activation payloads fail closed', async () => {
  const source = profileDirectory('profile-corruption-check', 'corruption-check@example.test');
  const profiles = new UserProfiles(db, source.directory);
  const principal = {
    uid: source.current.uid,
    email: source.current.email,
    verified: true,
    admin: false,
  };
  await profiles.sync(principal);
  await db.doc('users/' + principal.uid).update({ uid: 'other-person' });
  await assert.rejects(profiles.read(principal), /ownership requires review/);
  await assert.rejects(profiles.sync(principal), /ownership requires review/);
  const f = await usageFixture({ usage: async () => usageReading });
  await assert.rejects(
    f.service.activation(f.result.orderId, f.units[0].id, null, f.result.accessToken),
    /not ready/,
  );
  await db.doc('purchases/' + f.result.orderId).update({ status: 'attention' });
  await assert.rejects(
    f.service.activation(f.result.orderId, f.units[0].id, null, f.result.accessToken),
    /not ready/,
  );
});

test('authenticated checkout ensures a linked user profile before payment and rejects stale verified claims', async () => {
  const f = fixture();
  const source = profileDirectory(
    'checkout-profile-' + crypto.randomUUID(),
    'checkout-profile@example.test',
    false,
  );
  const principal = {
    uid: source.current.uid,
    email: source.current.email,
    verified: true,
    admin: false,
  };
  const server = await createApp({
    payments: null,
    commerce: f.service,
    fulfillment: null,
    profiles: new UserProfiles(db, source.directory),
    repository: { plans: async () => f.plans, orders: async () => [], order: async () => null },
    verify: async () => principal,
  });
  try {
    const request = {
      method: 'POST' as const,
      url: '/v2/checkout',
      headers: { authorization: 'Bearer fixture-owner' },
      payload: f.input,
    };
    assert.equal((await server.inject(request)).statusCode, 401);
    assert.equal(f.getCreates(), 0);
    source.current.emailVerified = true;
    const purchased = await server.inject(request);
    assert.equal(purchased.statusCode, 200);
    assert.equal((await db.doc('users/' + principal.uid).get()).get('uid'), principal.uid);
    assert.equal(
      (await db.doc('purchases/' + purchased.json().orderId).get()).get('uid'),
      principal.uid,
    );
    assert.equal(f.getCreates(), 1);
  } finally {
    await server.close();
  }
});

test('guest claim during in-flight fulfilment preserves the current owner when activation is saved', async () => {
  const f = fixture();
  const email = 'in-flight-claim-' + crypto.randomUUID() + '@example.test';
  const result = await f.service.checkout({ ...f.input, email, emailConfirmation: email }, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  await f.service.notify();
  const units = await db.collection('orders').where('parentOrderId', '==', result.orderId).get();
  const store = firestoreFulfillmentStore();
  const inFlight = await store.claim(units.docs[0].id);
  assert.ok(inFlight);
  assert.match(inFlight.uid, /^guest_/);
  const source = profileDirectory('in-flight-owner-' + crypto.randomUUID(), email);
  const principal = { uid: source.current.uid, email, verified: true, admin: false };
  await new UserProfiles(db, source.directory).sync(principal);
  await store.finish(
    inFlight,
    { status: 'ready' },
    {
      ac: 'LPA:1$example.com$claimed-in-flight',
      iccid: '89852245280001113019',
      esimTranNo: 'claimed-in-flight',
    },
  );
  assert.equal((await db.doc('orderActivations/' + inFlight.id).get()).get('uid'), principal.uid);
  assert.equal(
    (await f.service.activation(result.orderId, inFlight.id, principal, undefined)).esimTranNo,
    'claimed-in-flight',
  );
});

test('ready-only queue waits for all saved QR profiles, then sends once without repurchasing on retries', async () => {
  const tasks: OrderWork[] = [];
  const queue = {
    enqueue: async (work: OrderWork) => {
      tasks.push(work);
    },
  };
  let failEmail = true;
  const f = fixture(false, undefined, 'USD', () => failEmail, undefined, undefined, queue, false);
  const result = await f.service.checkout(f.input, null);
  const ref = db.doc('purchases/' + result.orderId);
  assert.equal((await ref.get()).get('confirmationVersion'), 'email-v2-ready');
  await ref.update({ confirmationVersion: 'email-v1' }); // Checkout opened before cutover.
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  assert.equal((await ref.get()).get('confirmationVersion'), 'email-v2-ready');
  let profilesReady = false;
  const supplierCalls: string[] = [];
  const delivery = new FulfillmentService(f.stripe, firestoreFulfillmentStore(), {
    order: async (tx) => {
      supplierCalls.push(tx);
      return 'ready-' + tx;
    },
    profile: async (_supplier, tx) =>
      profilesReady
        ? {
            ac: 'LPA:1$example.com$' + tx,
            iccid: '8985224528000111301',
            esimTranNo: tx,
          }
        : null,
  });
  const worker = new OrderWorker(db, f.service, delivery, queue);
  assert.equal((await worker.run(tasks[0])).state, 'scheduled');
  assert.equal(supplierCalls.length, 3);
  assert.equal(f.emails.length, 0);
  assert.equal((await ref.get()).get('confirmationAttempts'), undefined);
  const units = await db.collection('orders').where('parentOrderId', '==', result.orderId).get();
  profilesReady = true;
  for (const unit of units.docs)
    await db.doc('fulfillmentJobs/' + unit.id).update({ nextAttemptAt: Date.now() - 1 });
  await db.doc('orderWork/' + result.orderId).update({ runAfterAt: Date.now() - 1 });
  assert.equal((await worker.run(tasks[tasks.length - 1])).state, 'scheduled');
  assert.equal(f.emails.length, 0); // Provider failure keeps email retryable after preparation.
  assert.equal((await ref.get()).get('confirmationStatus'), 'retry');
  assert.equal((await ref.get()).get('confirmationIncludesInstallation'), true);
  const firstInlineHash = (await ref.get()).get('confirmationPayloadHash');
  for (const unit of units.docs) {
    assert.equal((await unit.ref.get()).get('status'), 'ready');
    assert((await db.doc('orderActivations/' + unit.id).get()).exists);
  }
  failEmail = false;
  await ref.update({ confirmationDueAt: Date.now() - 1 });
  await db.doc('orderWork/' + result.orderId).update({ runAfterAt: Date.now() - 1 });
  const last = tasks[tasks.length - 1];
  const responses = await Promise.all([worker.run(last), worker.run(last)]);
  assert(responses.some((r) => r.state === 'complete'));
  assert.equal(f.emails.length, 1);
  assert.equal(f.emails[0].version, 'email-v2-ready');
  assert.equal(f.emails[0].attachments?.length, 3);
  assert.equal(confirmationPayloadHash(f.emails[0]), firstInlineHash);
  assert(f.emails[0].text.includes('Your eSIM is ready.'));
  assert(!f.emails[0].text.includes('Your order is processing.'));
  assert.equal(supplierCalls.length, 3);
  assert.equal(new Set(supplierCalls).size, 3);
  await worker.run(last);
  assert.equal(f.emails.length, 1);
});

test('ready-only confirmation rejects partial units, missing credentials and blocked orders', async () => {
  const f = fixture(false, undefined, 'USD', undefined, undefined, undefined, null, false);
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  await f.service.notify(result.orderId);
  assert.equal(f.emails.length, 0);
  const units = await db.collection('orders').where('parentOrderId', '==', result.orderId).get();
  for (const unit of units.docs) await unit.ref.update({ status: 'ready' });
  await f.service.notify(result.orderId);
  assert.equal(f.emails.length, 0);
  for (const unit of units.docs)
    await db.doc('orderActivations/' + unit.id).set({
      uid: unit.get('uid'),
      ac: 'LPA:1$example.com$ready',
      iccid: '8985224528000111301',
      esimTranNo: unit.id,
    });
  await units.docs[0].ref.update({ paymentBlocked: true });
  await f.service.notify(result.orderId);
  assert.equal(f.emails.length, 0);
  await units.docs[0].ref.update({ paymentBlocked: false });
  const activationRef = db.doc('orderActivations/' + units.docs[0].id);
  await activationRef.update({ uid: 'another-customer' });
  await f.service.notify(result.orderId);
  assert.equal(f.emails.length, 0);
  await units.docs[0].ref.update({ uid: 'another-customer' });
  await f.service.notify(result.orderId); // Matching foreign credentials still cannot enter this purchase.
  assert.equal(f.emails.length, 0);
  await units.docs[0].ref.update({ uid: units.docs[0].get('uid') });
  await activationRef.update({ uid: units.docs[0].get('uid') });
  const saved = units.docs[0].data();
  await units.docs[0].ref.delete();
  await f.service.notify(result.orderId);
  assert.equal(f.emails.length, 0);
  await units.docs[0].ref.set({ ...saved, status: 'ready', paymentBlocked: false });
  await Promise.all([f.service.notify(result.orderId), f.service.notify(result.orderId)]);
  assert.equal(f.emails.length, 1);
});

async function readyEmailPurchase(f: ReturnType<typeof fixture>) {
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  const units = await db.collection('orders').where('parentOrderId', '==', result.orderId).get();
  for (const unit of units.docs) {
    await unit.ref.update({ status: 'ready' });
    await db.doc('orderActivations/' + unit.id).set({
      uid: unit.get('uid'),
      ac: 'LPA:1$rsp.example.test$SYNTHETIC-' + unit.id,
      iccid: '8900000000000000001',
      esimTranNo: 'private-fixture-reference',
    });
  }
  return { result, units, ref: db.doc('purchases/' + result.orderId) };
}

test('an older ready-email retry keeps its original payload and cannot gain new installation credentials', async () => {
  const f = fixture(false, undefined, 'USD', undefined, undefined, undefined, null, false);
  const { result, ref } = await readyEmailPurchase(f);
  const snapshot = await ref.get();
  const prior = confirmationEmail(
    confirmationOrderSchema.parse({ ...snapshot.data(), id: snapshot.id }),
    `https://alozuri.com/checkout/success?order=${result.orderId}#access=${result.accessToken}`,
    'email-v2-ready',
  );
  await ref.update({
    confirmationFirstSendAt: Date.now() - 1000,
    confirmationPayloadHash: confirmationPayloadHash(prior),
  });
  await f.service.notify(result.orderId);
  assert.equal(f.emails.length, 1);
  assert.equal(f.emails[0].attachments, undefined);
  assert.equal(confirmationPayloadHash(f.emails[0]), confirmationPayloadHash(prior));
  assert.equal((await ref.get()).get('confirmationIncludesInstallation'), undefined);
  await f.service.notify(result.orderId);
  assert.equal(f.emails.length, 1);
});

test('changed private installation data after an attempted send requires review rather than a different retry', async () => {
  let fail = true;
  const f = fixture(false, undefined, 'USD', () => fail, undefined, undefined, null, false);
  const { result, units, ref } = await readyEmailPurchase(f);
  await f.service.notify(result.orderId);
  assert.equal((await ref.get()).get('confirmationIncludesInstallation'), true);
  const firstHash = (await ref.get()).get('confirmationPayloadHash');
  assert.equal(typeof firstHash, 'string');
  await db
    .doc('orderActivations/' + units.docs[0].id)
    .update({ ac: 'LPA:1$rsp.example.test$CHANGED-SYNTHETIC' });
  await ref.update({ confirmationDueAt: Date.now() - 1 });
  fail = false;
  await f.service.notify(result.orderId);
  assert.equal(f.emails.length, 0);
  assert.equal((await ref.get()).get('confirmationStatus'), 'attention');
  assert.equal((await ref.get()).get('confirmationError'), 'send_reconciliation_required');
  assert.equal((await ref.get()).get('confirmationPayloadHash'), firstHash);
});

test('new payment requests identify Alozuri and retain frozen attribution for retries and per-eSIM refunds', async () => {
  const f = fixture(false, undefined, 'GBP');
  const result = await f.service.checkout(f.input, null);
  const ref = db.doc('purchases/' + result.orderId);
  const frozen = (await ref.get()).get('stripeAttribution');
  const request = f.paymentRequests[0];
  assert.equal(request.params.metadata?.brand, 'Alozuri');
  assert.equal(request.params.metadata?.app, 'alozuri');
  assert.equal(request.params.metadata?.company, 'Rewolo Technologies Ltd');
  assert.equal(request.params.metadata?.website, 'https://alozuri.com');
  assert.equal(request.params.metadata?.alozuriPurchaseId, result.orderId);
  assert.equal(request.params.metadata?.order_reference, (await ref.get()).get('orderReference'));
  assert.equal(
    request.params.description,
    'Alozuri eSIM order ' + (await ref.get()).get('orderReference'),
  );
  assert.equal(request.params.amount, f.input.expectedTotalCents);
  assert.equal(request.params.currency, 'gbp');
  assert.equal(request.key, `${result.orderId}:payment:v1`);
  assert.equal(request.params.statement_descriptor, undefined);
  assert.equal(request.params.statement_descriptor_suffix, undefined);
  // Simulate Stripe accepting creation before the Firestore binding was acknowledged.
  await ref.update({ paymentIntentId: FieldValue.delete() });
  await f.service.checkout(f.input, null);
  assert.deepEqual(f.paymentRequests[1], request);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await Promise.all([f.event(), f.event()]);
  const children = await db.collection('orders').where('parentOrderId', '==', result.orderId).get();
  assert.equal(children.size, 3);
  for (const child of children.docs) assert.deepEqual(child.get('stripeAttribution'), frozen);
});

test('a pre-attribution unbound payment retry preserves the old Stripe body and idempotency key', async () => {
  const f = fixture();
  const result = await f.service.checkout(f.input, null);
  await db
    .doc('purchases/' + result.orderId)
    .update({ stripeAttribution: FieldValue.delete(), paymentIntentId: FieldValue.delete() });
  await f.service.checkout(f.input, null);
  const request = f.paymentRequests[1];
  assert.deepEqual(request.params.metadata, { alozuriPurchaseId: result.orderId });
  assert.equal(request.params.description, 'Alozuri eSIM order ' + result.orderId);
  assert.equal(request.key, result.orderId + ':payment:v1');
  assert.equal(request.params.amount, f.input.expectedTotalCents);
});

test('other brands sharing the Stripe account cannot authorise Alozuri fulfilment through brand metadata', async () => {
  const tasks: OrderWork[] = [];
  const f = fixture(false, undefined, 'USD', undefined, undefined, undefined, {
    enqueue: async (work) => {
      tasks.push(work);
    },
  });
  const result = await f.service.checkout(f.input, null);
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  f.intent.metadata = {
    brand: 'Other brand',
    app: 'another-app',
    order_reference: 'another-order',
  };
  await f.event();
  assert.equal((await db.doc('purchases/' + result.orderId).get()).get('paidAt'), undefined);
  assert.equal(
    (await db.collection('orders').where('parentOrderId', '==', result.orderId).get()).size,
    0,
  );
  assert.equal(tasks.length, 0);
  assert.equal(f.emails.length, 0);
});

test('private financial snapshots never appear in customer order responses', async () => {
  const f = fixture(true);
  const checkout = await f.service.checkout(f.input, null);
  const stored = await db.collection('purchases').doc(checkout.orderId).get();
  assert.ok(stored.get('financial'));
  assert.equal(typeof stored.get('financial.supplier.quotedUnits'), 'number');
  await f.event();
  const visible = await f.service.order(checkout.orderId, null, checkout.accessToken);
  assert.equal(Object.hasOwn(visible, 'financial'), false);
  assert.equal(JSON.stringify(visible).includes('quotedUnits'), false);
  assert.equal(JSON.stringify(visible).includes('financialReconciliationPending'), false);
});

test('Operations links exact transaction numbers and historical order references to private installation and usage details', async () => {
  let calls = 0;
  const supplier: UsageSupplier = {
    usage: async (_order, transaction) => {
      calls++;
      return { ...usageReading, esimTranNo: transaction, smdpStatus: 'DISABLED' };
    },
  };
  const f = await usageFixture(supplier);
  const unit = f.units[0];
  await db.doc('orderActivations/' + unit.id).update({ esimTranNo: '26111300000001' });
  const usage = new EsimUsageService(db, supplier);
  const reports = new OperationsEsims(db, usage);
  const found = await reports.lookup('26111300000001');
  assert.equal(found.purchaseId, f.result.orderId);
  assert.equal(found.units[0].esimTranNo, '26111300000001');
  assert.equal(found.units[0].usage.snapshot?.smdpStatus, 'DISABLED');
  assert.equal(found.units[0].usage.snapshot?.remainingBytes, usageReading.remainingBytes);
  assert.ok(!JSON.stringify(found).includes('PRIVATE'));
  const before = calls;
  await reports.lookup(orderReference(f.result.orderId));
  await reports.lookup(f.result.orderId);
  await reports.lookup(unit.id);
  assert.equal(calls, before);
  await assert.rejects(reports.lookup('26111399999999'), /not found/);
  await assert.rejects(reports.lookup('a@b.example'));
  await unit.ref.update({ status: 'refunded', paymentBlocked: true });
  await db.doc('purchases/' + f.result.orderId).update({ status: 'refunded' });
  const support = await reports.lookup('26111300000001');
  assert.equal(support.units[0].usage.snapshot?.smdpStatus, 'DISABLED');
  const customer = await f.service.usage(f.result.orderId, unit.id, null, f.result.accessToken);
  assert.equal(customer.snapshot, null);
  await db.doc('orderActivations/' + unit.id).update({ uid: 'different-owner' });
  await assert.rejects(reports.lookup('26111300000001'), /ownership/);
});

test('older usage caches refresh installation fields but preserve useful readings during a supplier outage', async () => {
  let available = true,
    calls = 0;
  const f = await usageFixture({
    usage: async () => {
      calls++;
      if (!available) throw new Error('Supplier temporarily unavailable');
      return usageReading;
    },
  });
  const unit = f.units[0].id;
  await f.service.usage(f.result.orderId, unit, null, f.result.accessToken);
  const cache = db.doc('esimUsage/' + unit);
  assert.equal((await cache.get()).get('schemaVersion'), 2);
  await cache.update({ schemaVersion: FieldValue.delete() });
  available = false;
  const result = await f.service.usage(f.result.orderId, unit, null, f.result.accessToken);
  assert.equal(calls, 2);
  assert.equal(result.snapshot?.usedBytes, usageReading.usedBytes);
  assert.equal(result.snapshot?.remainingBytes, usageReading.remainingBytes);
  await f.service.usage(f.result.orderId, unit, null, f.result.accessToken);
  assert.equal(calls, 2);
});

async function promotionFixture(maxUses: number | null = null, percent = 10) {
  const code = 'SAVE_' + crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase();
  const input = {
    code,
    discountPercent: percent,
    active: true,
    startsAt: new Date(Date.now() - 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    maxUses,
  };
  const promotions = new Promotions(db);
  await promotions.save(input, true);
  return { code, promotions, input, ref: db.doc('promotions/' + code) };
}
for (const currency of ['GBP', 'EUR', 'USD'] as const)
  for (const percent of [5, 10, 15, 20, 30, 40, 50])
    test(`${currency} ${percent}% guest and account checkout freezes exact unit discounts; paid replay allocates once`, async () => {
      const f = fixture(false, undefined, currency),
        promo = await promotionFixture(1, percent);
      const quote = await f.service.quote(f.input.items, currency, promo.code);
      const original = f.input.expectedTotalCents;
      assert.equal(quote.originalRetailCents, original);
      assert.equal(quote.discountCents, original - quote.totalCents);
      const input = { ...f.input, promotionCode: promo.code, expectedTotalCents: quote.totalCents };
      const user = percent === 10 ? { uid: 'promo-account', verified: true, admin: false } : null;
      const result = await f.service.checkout(input, user);
      const retry = await f.service.checkout(input, user);
      assert.equal(retry.orderId, result.orderId);
      assert.equal(f.getCreates(), 1);
      assert.equal(f.intent.amount, quote.totalCents);
      assert.equal((await promo.promotions.get(promo.code)).redemptionCount, 0);
      f.intent.status = 'requires_payment_method';
      await f.event('payment_intent.payment_failed');
      assert.equal(
        (await db.collection('orders').where('parentOrderId', '==', result.orderId).get()).size,
        0,
      );
      f.intent.status = 'succeeded';
      f.intent.amount_received = f.intent.amount;
      const eventId = 'evt_promo_' + crypto.randomUUID();
      await f.event('payment_intent.succeeded', eventId);
      await f.event('payment_intent.succeeded', eventId);
      await f.event(); // A different duplicate event also cannot count twice.
      const saved = await db.doc('purchases/' + result.orderId).get();
      assert.equal(saved.get('financial.selling.discountMinor'), quote.discountCents);
      assert.equal(saved.get('financial.promotion.code'), promo.code);
      assert.equal(
        saved.get('items')[0].originalPriceCents - saved.get('items')[0].plan.priceCents,
        discountUnit(saved.get('items')[0].originalPriceCents, percent),
      );
      const units = await db
        .collection('orders')
        .where('parentOrderId', '==', result.orderId)
        .get();
      assert.equal(units.size, 3);
      assert.equal(
        units.docs.reduce((sum, d) => sum + d.get('amountCents'), 0),
        quote.totalCents,
      );
      assert.ok(units.docs.every((d) => d.get('wholesaleUnits') === 1000));
      const completed = await promo.promotions.get(promo.code);
      assert.equal(completed.redemptionCount, 1);
      assert.deepEqual(completed.totals[currency], {
        revenueMinor: quote.totalCents,
        discountMinor: quote.discountCents,
      });
      assert.equal(Object.keys(completed.holds).length, 0);
      await assert.rejects(f.service.quote(f.input.items, currency, promo.code), /limit/);
      f.plans[0].priceCents = 1;
      assert.equal(
        (await f.service.order(result.orderId, user, result.accessToken)).totalCents,
        quote.totalCents,
      );
      const contract = confirmationOrderSchema.parse({ ...saved.data(), id: saved.id });
      const email = confirmationEmail(
        contract,
        'https://alozuri.com/order/private-token',
        'email-v1',
      );
      assert.match(email.text, new RegExp('Promotion ' + promo.code));
    });
test('concurrent one-use promotion admits one purchase and leaves unsuccessful checkouts uncharged', async () => {
  const promo = await promotionFixture(1),
    a = fixture(),
    b = fixture();
  const q = await a.service.quote(a.input.items, 'USD', promo.code);
  const attempts = await Promise.allSettled(
    [a, b].map((f) =>
      f.service.checkout(
        { ...f.input, promotionCode: promo.code, expectedTotalCents: q.totalCents },
        null,
      ),
    ),
  );
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(a.getCreates() + b.getCreates(), 1);
  assert.equal((await promo.promotions.get(promo.code)).redemptionCount, 0);
});
test('abandonment cancels an unpaid intent before releasing a slot; processing and succeeded are retained', async () => {
  for (const status of ['requires_payment_method', 'processing', 'succeeded']) {
    const promo = await promotionFixture(1),
      f = fixture();
    const quote = await f.service.quote(f.input.items, 'USD', promo.code);
    const result = await f.service.checkout(
      { ...f.input, promotionCode: promo.code, expectedTotalCents: quote.totalCents },
      null,
    );
    const saved = await promo.promotions.get(promo.code);
    await promo.ref.update({
      holds: {
        [result.orderId]: { ...saved.holds[result.orderId], at: Date.now() - 31 * 60 * 1000 },
      },
    });
    f.intent.status = status;
    await promo.promotions.releaseExpired(promo.code, f.stripe);
    const p = await promo.promotions.get(promo.code);
    assert.equal(Object.keys(p.holds).length, status === 'requires_payment_method' ? 0 : 1);
    if (status === 'requires_payment_method') {
      assert.equal(f.intent.status, 'canceled');
      await f.event('payment_intent.canceled');
      assert.equal((await db.doc('purchases/' + result.orderId).get()).get('status'), 'cancelled');
      await assert.rejects(
        promo.promotions.bind(promo.code, result.orderId, f.intent.id),
        /expired/,
      );
    }
  }
});
test('canceled checkout releases reservation without redemption; forged totals cannot reserve a use', async () => {
  const promo = await promotionFixture(1),
    f = fixture();
  await assert.rejects(
    f.service.checkout({ ...f.input, promotionCode: promo.code, expectedTotalCents: 1 }, null),
    /price changed/,
  );
  assert.equal(Object.keys((await promo.promotions.get(promo.code)).holds).length, 0);
  const q = await f.service.quote(f.input.items, 'USD', promo.code);
  const r = await f.service.checkout(
    { ...f.input, promotionCode: promo.code, expectedTotalCents: q.totalCents },
    null,
  );
  f.intent.status = 'canceled';
  await f.event('payment_intent.canceled');
  assert.equal((await promo.promotions.get(promo.code)).redemptionCount, 0);
  assert.equal(Object.keys((await promo.promotions.get(promo.code)).holds).length, 0);
  assert.equal(
    (await db.collection('orders').where('parentOrderId', '==', r.orderId).get()).size,
    0,
  );
});
test('backend promotion management rejects excessive discounts and preserves usage on edits; no margin veto', async () => {
  const promo = await promotionFixture();
  await assert.rejects(promo.promotions.save({ ...promo.input, discountPercent: 51 }, false));
  assert.equal(contributionPreview(1000, 100000, 30).warning, 'critical');
  await promo.promotions.save({ ...promo.input, discountPercent: 50 }, false);
  assert.equal((await promo.promotions.get(promo.code)).discountPercent, 50);
  await promo.promotions.save({ ...promo.input, active: false }, false);
  const f = fixture();
  await assert.rejects(f.service.quote(f.input.items, 'USD', promo.code), /inactive/);
  await assert.rejects(f.service.quote(f.input.items, 'USD', 'MISSING_CODE'), /Invalid/);
  await promo.promotions.save(
    { ...promo.input, startsAt: '2020-01-01T00:00:00Z', expiresAt: '2020-02-01T00:00:00Z' },
    false,
  );
  await assert.rejects(f.service.quote(f.input.items, 'USD', promo.code), /expired/);
});

test('a discounted paid purchase uses existing supplier fulfilment exactly once with the frozen wholesale cost', async () => {
  const f = fixture(false, undefined, 'USD', undefined, undefined, undefined, null, false),
    promo = await promotionFixture(null, 50);
  const q = await f.service.quote(f.input.items, 'USD', promo.code);
  const purchase = await f.service.checkout(
    { ...f.input, promotionCode: promo.code, expectedTotalCents: q.totalCents },
    null,
  );
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  const units = await db.collection('orders').where('parentOrderId', '==', purchase.orderId).get();
  const calls: { units: number; code: string }[] = [];
  const delivery = new FulfillmentService(f.stripe, firestoreFulfillmentStore(), {
    order: async (_tx, code, units) => {
      calls.push({ units, code });
      return 'supplier-promoted-' + calls.length;
    },
    profile: async () => ({
      ac: 'LPA:1$example.com$promoted',
      iccid: '8985224528000111301',
      esimTranNo: 'promoted-profile',
    }),
  });
  for (const unit of units.docs) {
    await delivery.run([unit.id]);
    await delivery.run([unit.id]);
  }
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => c.units === 1000));
  assert.ok(
    (await f.service.order(purchase.orderId, null, purchase.accessToken)).allocations.every(
      (a) => a.status === 'ready',
    ),
  );
});

test('abandoned checkout cleanup never releases a slot when Stripe cancellation fails', async () => {
  const f = fixture(),
    promo = await promotionFixture(1);
  const q = await f.service.quote(f.input.items, 'USD', promo.code);
  const r = await f.service.checkout(
    { ...f.input, promotionCode: promo.code, expectedTotalCents: q.totalCents },
    null,
  );
  await promo.ref.update({
    holds: { [r.orderId]: { at: Date.now() - 31 * 60 * 1000, intent: f.intent.id } },
  });
  const original = f.stripe.paymentIntents.cancel;
  f.stripe.paymentIntents.cancel = async () => {
    throw new Error('Outcome unknown');
  };
  await assert.rejects(promo.promotions.releaseExpired(promo.code, f.stripe), /Outcome unknown/);
  assert.equal(Object.keys((await promo.promotions.get(promo.code)).holds).length, 1);
  f.stripe.paymentIntents.cancel = original;
});

test('promotion API validates admin changes, price-preview catalogue provenance and paginated filters', async () => {
  const f = fixture();
  const api = await createApp({
    repository: { plans: async () => f.plans, orders: async () => [], order: async () => null },
    commerce: f.service,
    payments: null,
    fulfillment: null,
    verify: async (token) => ({ uid: token, verified: true, admin: token === 'admin' }),
  });
  const headers = { authorization: 'Bearer admin' };
  try {
    const promo = await promotionFixture();
    for (const extra of [
      { discountPercent: 30 },
      { promotionCode: [promo.code, 'SECOND'] },
      { discountCents: 9999 },
    ]) {
      const invalid = await api.inject({
        method: 'POST',
        url: '/v2/quote',
        payload: {
          items: f.input.items,
          currency: 'USD',
          promotionCode: promo.code,
          ...extra,
        },
      });
      assert.equal(invalid.statusCode, 400);
    }
    assert.equal(
      (
        await api.inject({
          method: 'PUT',
          url: '/v1/operations/promotions',
          headers,
          payload: { ...promo.input, discountPercent: 51 },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await api.inject({
          method: 'PUT',
          url: '/v1/operations/promotions',
          headers,
          payload: { ...promo.input, discountPercent: 20 },
        })
      ).statusCode,
      200,
    );
    const result = await api.inject({
      url: '/v1/operations/promotions?q=' + promo.code + '&active=true',
      headers,
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.json().rows[0].discountPercent, 20);
    assert.equal(result.json().rows[0].holds, undefined);
    const plan = f.plans[0];
    await db.doc('packages/' + plan.id).set(plan);
    const response = await api.inject({
      method: 'POST',
      url: '/v1/operations/promotions/preview',
      headers,
      payload: { packageId: plan.id, discountPercent: 50 },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().supplierUnits, 1000);
    await db.doc('packages/' + plan.id).update({ wholesaleUnits: 1 });
    assert.equal(
      (
        await api.inject({
          method: 'POST',
          url: '/v1/operations/promotions/preview',
          headers,
          payload: { packageId: plan.id, discountPercent: 50 },
        })
      ).statusCode,
      400,
    );
    for (let i = 0; i < 22; i++)
      await promo.promotions.save(
        { ...promo.input, code: 'PAGE_' + String(i).padStart(3, '0') },
        true,
      );
    const page = await promo.promotions.list(undefined, 'PAGE_', true);
    assert.equal(page.rows.length, 20);
    assert.ok(page.nextCursor);
    const last = await promo.promotions.list(page.nextCursor ?? undefined, 'PAGE_', true);
    assert.equal(last.rows.length, 2);
    assert.ok(!page.rows.some((p) => last.rows.some((q) => p.code === q.code)));
  } finally {
    await api.close();
  }
});

test('refunding a promoted purchase keeps the historical paid redemption and original discount', async () => {
  const f = fixture(),
    promo = await promotionFixture(1);
  const q = await f.service.quote(f.input.items, 'USD', promo.code);
  const r = await f.service.checkout(
    { ...f.input, promotionCode: promo.code, expectedTotalCents: q.totalCents },
    null,
  );
  f.intent.status = 'succeeded';
  f.intent.amount_received = f.intent.amount;
  await f.event();
  f.intent.latest_charge.refunded = true;
  f.intent.latest_charge.amount_refunded = q.totalCents;
  const payload = JSON.stringify({
    id: 'evt_promo_refund_' + crypto.randomUUID(),
    object: 'event',
    created: 1794430800,
    livemode: true,
    type: 'charge.refunded',
    data: { object: f.intent.latest_charge },
  });
  const signature = signer.webhooks.generateTestHeaderString({ payload, secret: 'whsec_fixture' });
  await f.service.webhook(Buffer.from(payload), signature);
  await f.service.webhook(Buffer.from(payload), signature);
  const p = await promo.promotions.get(promo.code);
  assert.equal(p.redemptionCount, 1);
  assert.equal(p.totals.USD.discountMinor, q.discountCents);
  assert.equal((await db.doc('purchases/' + r.orderId).get()).get('status'), 'refunded');
});
