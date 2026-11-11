import { CHECKOUT_LEGAL_ACCEPTANCE } from '../../../packages/shared/src/legal.ts';
import { convertPrice, priceExchange, type FxRates } from '../src/lib/exchange-rates.ts';
import type { Currency } from '../../../packages/shared/src/index.ts';
import { pricePackage } from '../src/lib/package-pricing.ts';
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
  currency: Currency = 'USD',
  emailFailure?: () => boolean,
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
  const emails: {
    id: string;
    email: string;
    url: string;
    kind?: 'contract' | 'delivery';
    text?: string;
  }[] = [];
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
      },
    },
    capacity,
    { current: async () => rates },
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
  assert.equal(f.emails.filter((e) => e.id === first.orderId).length, 2);
  assert.equal(f.emails[0].kind, 'contract');
  assert.ok(f.emails[0].text?.includes('Rewolo Technologies Ltd'));
  assert.ok(f.emails[1].url.includes('#access='));
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

test('public Firestore clients cannot read supplier pricing or bypass the importer with direct writes', async () => {
  const f = fixture(true);
  await db.doc('packages/private-pricing-test').set(f.plans[0]);
  const base = 'http://127.0.0.1:8188/v1/projects/demo-alozuri/databases/(default)/documents';
  const now = Math.floor(Date.now() / 1000);
  const token =
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
        firebase: { identities: {}, sign_in_provider: 'custom' },
      },
    ]
      .map((value) => Buffer.from(JSON.stringify(value)).toString('base64url'))
      .join('.') + '.';
  for (const collection of ['purchases', 'orders', 'carts'])
    await db.doc(collection + '/security-probe').set({ uid: 'victim', private: 'must-not-leak' });
  for (const authenticated of [false, true]) {
    const headers: Record<string, string> = authenticated
      ? { Authorization: 'Bearer ' + token }
      : {};
    for (const path of [
      'packages/private-pricing-test',
      'packages',
      'purchases/security-probe',
      'orders/security-probe',
      'carts/security-probe',
    ]) {
      const response = await fetch(base + '/' + path, { headers });
      assert.equal(
        response.status,
        403,
        `${authenticated ? 'Signed-in' : 'Anonymous'} client must not read ${path}`,
      );
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
    legal: { ...CHECKOUT_LEGAL_ACCEPTANCE, cancellationAcknowledged: false },
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
    assert.ok(original.acknowledgementText.includes('not waived'));
    assert.equal((await f.service.notify()).sent, 0);
    assert.equal(await store.claim(children.docs[0].id), null);
    mailBlocked = false;
    await db.doc('purchases/' + started.orderId).update({ contractEmailDueAt: Date.now() });
    await f.service.notify();
    assert.ok(
      f.emails.some((e) => e.kind === 'contract' && e.text?.includes('Model cancellation notice')),
    );
    assert.ok(await store.claim(children.docs[0].id));
    const owned = await f.service.order(started.orderId, null, started.accessToken);
    assert.equal(owned.legal?.termsText, original.termsText);
    await assert.rejects(f.service.order(started.orderId, null, 'wrong'), /not found/);
  } finally {
    await api.close();
  }
});
