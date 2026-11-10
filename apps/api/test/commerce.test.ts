import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { PaymentService, type PaymentStore, type PaymentOrder } from '../src/lib/payments.js';
import { adaptPackage } from '../src/lib/supplier.js';
import { createApp } from '../src/app.js';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
import {
  suggestedPlans,
  isCountryCode,
  type StoredPlan,
} from '../../../packages/shared/src/index.ts';
const source = {
  packageCode: 'FR_1_7',
  name: 'France 1GB 7Days',
  price: 7000,
  currencyCode: 'USD',
  volume: 1073741824,
  duration: 7,
  durationUnit: 'DAY',
  durationType: 1,
  dataType: 1,
  location: 'FR',
  activeType: 2,
  locationNetworkList: [{ operatorList: [{ operatorName: 'Orange', networkType: '5G' }] }],
};
test('supplier adapter uses explicit coverage, unit conversion, retail margin and activation rule', () => {
  const p = adaptPackage(source, new Date().toISOString())!;
  assert.ok(p);
  assert.deepEqual(p.countries, ['FR']);
  assert.equal(p.priceCents, 126);
  assert.equal(p.dataGb, 1);
  assert.ok(p.activation.includes('first connection'));
  for (const patch of [
    { location: 'Europe' },
    { currencyCode: 'EUR' },
    { dataType: 2 },
    { price: -1 },
    { durationUnit: 'HOUR' },
    { volume: 'bad' },
  ])
    assert.equal(adaptPackage({ ...source, ...patch }, new Date().toISOString()), null);
  assert.deepEqual(
    adaptPackage({ ...source, location: 'FR,IT,FR' }, new Date().toISOString())!.countries,
    ['FR', 'IT'],
  );
  assert.ok(isCountryCode('NZ'));
  assert.ok(!isCountryCode('XX'));
  assert.ok(!isCountryCode('ZZ'));
});
test('recommendations offer distinct data sizes rather than four duplicate packages', () => {
  const plans = [
    ...demoPlans,
    ...demoPlans.map((p) => ({ ...p, id: p.id + 'copy', priceCents: p.priceCents + 100 })),
  ];
  const result = suggestedPlans(plans);
  assert.equal(new Set(result.map((p) => p.dataGb)).size, result.length);
  assert.ok(result.length <= 4);
});
function fixture() {
  const plan: StoredPlan = {
    ...demoPlans[0],
    demo: false,
    supplierCode: 'test-sku',
    wholesaleUnits: 1000,
    active: true,
  };
  let order: PaymentOrder | undefined;
  let creates = 0;
  const processed = new Set<string>();
  const session = {
    id: 'cs_test_1',
    livemode: false,
    status: 'open',
    url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    payment_status: 'unpaid',
    amount_total: plan.priceCents,
    currency: 'usd',
    client_reference_id: 'order_' + 'a'.repeat(48),
    metadata: { voyaspanOrderId: 'order_' + 'a'.repeat(48), voyaspanUid: 'alice' },
  } as unknown as Stripe.Checkout.Session;
  const store: PaymentStore = {
    async reserve(uid, _request, p) {
      order ??= {
        id: session.client_reference_id!,
        uid,
        plan: p,
        amountCents: p.priceCents,
        currency: 'USD',
        status: 'created',
        test: true,
      };
      return order;
    },
    async bind(_id, sid) {
      order!.sessionId = sid;
    },
    async apply(id, s, state) {
      if (processed.has(id)) return;
      if (s.amount_total !== order!.amountCents) throw new Error('mismatch');
      processed.add(id);
      order!.status = state;
    },
  };
  const real = new Stripe('sk_test_unit_test');
  const stripe = {
    checkout: {
      sessions: {
        async create(
          params: Stripe.Checkout.SessionCreateParams,
          options: { idempotencyKey: string },
        ) {
          creates++;
          assert.equal(params.line_items?.[0].price_data?.unit_amount, plan.priceCents);
          assert.ok(options.idempotencyKey);
          return session;
        },
        async retrieve() {
          return session;
        },
      },
    },
    webhooks: real.webhooks,
  } as unknown as Stripe;
  const service = new PaymentService(
    stripe,
    store,
    async () => plan,
    'whsec_test',
    'https://example.com',
  );
  return { service, session, plan, getOrder: () => order, getCreates: () => creates };
}
test('test checkout uses server prices and a repeat request reuses the existing session', async () => {
  const f = fixture(),
    user = { uid: 'alice', verified: true, admin: false };
  const first = await f.service.checkout(user, f.plan.id, 'request');
  const second = await f.service.checkout(user, f.plan.id, 'request');
  assert.equal(first.url, second.url);
  assert.equal(f.getCreates(), 1);
  assert.equal(f.getOrder()!.test, true);
  await assert.rejects(
    f.service.checkout({ ...user, verified: false }, f.plan.id, 'other'),
    /Verify/,
  );
});
test('Stripe webhooks require raw signed payloads and reject live mode; replay has no extra effect', async () => {
  const f = fixture();
  await f.service.checkout({ uid: 'alice', verified: true, admin: false }, f.plan.id, 'request');
  const stripe = new Stripe('sk_test_test');
  f.session.payment_status = 'paid';
  const body = JSON.stringify({
    id: 'evt_test',
    object: 'event',
    livemode: false,
    type: 'checkout.session.completed',
    data: { object: f.session },
  });
  const sign = (payload: string) =>
    stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' });
  await assert.rejects(f.service.webhook(Buffer.from(body), 'bad'), /signature/);
  await f.service.webhook(Buffer.from(body), sign(body));
  await f.service.webhook(Buffer.from(body), sign(body));
  assert.equal(f.getOrder()!.status, 'paid');
  const live = body.replace('"livemode":false', '"livemode":true');
  await assert.rejects(f.service.webhook(Buffer.from(live), sign(live)), /Live/);
});
test('private API refuses unverified accounts, checkout refuses client price and compatibility bypass', async () => {
  const f = fixture();
  const app = await createApp({
    payments: f.service,
    verify: async (token) => ({ uid: 'alice', verified: token !== 'unverified', admin: false }),
  });
  try {
    for (const url of ['/v1/orders', '/v1/orders/test', '/v1/admin/status'])
      assert.equal(
        (await app.inject({ url, headers: { authorization: 'Bearer unverified' } })).statusCode,
        403,
      );
    const post = (payload: object) =>
      app.inject({
        method: 'POST',
        url: '/v1/checkout',
        headers: { authorization: 'Bearer verified' },
        payload,
      });
    assert.equal(
      (
        await post({
          planId: f.plan.id,
          requestId: crypto.randomUUID(),
          compatible: true,
          price: 1,
        })
      ).statusCode,
      400,
    );
    assert.equal((await post({ planId: f.plan.id })).statusCode, 400);
    assert.equal(
      (await post({ planId: f.plan.id, requestId: crypto.randomUUID(), compatible: true }))
        .statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/webhooks/stripe',
          headers: { 'content-type': 'application/json', 'stripe-signature': 'bad' },
          payload: '{}',
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (await app.inject({ method: 'POST', url: '/internal/catalogue/sync', payload: {} }))
        .statusCode,
      401,
    );
  } finally {
    await app.close();
  }
});
