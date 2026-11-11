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
  assert.equal(p.priceCents, 199);
  assert.equal(p.dataGb, 1);
  assert.ok(p.activation.includes('first connection'));
  for (const patch of [
    { location: 'Europe' },
    { dataType: 9 },
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
function fixture(mode: 'test' | 'live' = 'test') {
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
  const adjustments: Array<{ failed: boolean; pending: boolean | undefined }> = [];
  const refund = { status: 'pending' };
  const session = {
    id: 'cs_test_1',
    livemode: mode === 'live',
    status: 'open',
    mode: 'payment',
    ui_mode: 'hosted_page',
    client_secret: 'cs_test_1_secret_test',
    url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    payment_status: 'unpaid',
    amount_total: plan.priceCents,
    currency: 'usd',
    client_reference_id: 'order_' + 'a'.repeat(48),
    metadata: { voyaspanOrderId: 'order_' + 'a'.repeat(48), voyaspanUid: 'alice' },
  } as unknown as Stripe.Checkout.Session;
  const store: PaymentStore = {
    async adjust(_id, _charge, failed, pending) {
      adjustments.push({ failed, pending });
    },
    async find(uid, id) {
      return order?.uid === uid && order.id === id ? order : null;
    },
    async reserve(uid, _request, p) {
      order ??= {
        id: session.client_reference_id!,
        uid,
        plan: p,
        amountCents: p.priceCents,
        currency: 'USD',
        status: 'created',
        test: mode === 'test',
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
      order!.status = state === 'expired' && order!.status === 'paid' ? 'paid' : state;
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
          session.ui_mode = params.ui_mode ?? 'hosted_page';
          if (params.ui_mode === 'embedded_page') {
            assert.equal(params.redirect_on_completion, 'if_required');
            assert.ok(
              params.return_url?.startsWith('https://example.com/dashboard/orders?id=order_'),
            );
            assert.equal(params.success_url, undefined);
            assert.equal(params.cancel_url, undefined);
          }
          assert.deepEqual(params.allowed_payment_method_types, ['card']);
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
    charges: {
      retrieve: async () => ({
        id: 'ch_fixture',
        livemode: mode === 'live',
        amount_refunded: plan.priceCents,
        refunded: true,
      }),
    },
    refunds: { retrieve: async () => refund, list: async () => ({ data: [refund] }) },
  } as unknown as Stripe;
  const service = new PaymentService(
    stripe,
    store,
    async () => plan,
    'whsec_test',
    'https://example.com',
    mode,
  );
  return {
    service,
    session,
    plan,
    refund,
    adjustments,
    getOrder: () => order,
    getCreates: () => creates,
  };
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
      410,
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

test('embedded checkout returns only the client secret and reuses its session', async () => {
  const f = fixture();
  const user = { uid: 'alice', verified: true, admin: false };
  const first = await f.service.checkout(user, f.plan.id, 'request', 'embedded');
  assert.equal(first.clientSecret, f.session.client_secret);
  assert.equal(first.url, undefined);
  assert.equal(first.paymentMode, 'test');
  assert.deepEqual(await f.service.checkout(user, f.plan.id, 'request', 'embedded'), first);
  assert.equal(f.getCreates(), 1);
  await assert.rejects(f.service.checkout(user, f.plan.id, 'request', 'hosted'), /changed/);
  f.session.status = 'complete';
  await assert.rejects(f.service.checkout(user, f.plan.id, 'request', 'embedded'), /closed/);
});
test('payment status reconciles a completed payment without waiting for the webhook', async () => {
  const f = fixture();
  const user = { uid: 'alice', verified: true, admin: false };
  const result = await f.service.checkout(user, f.plan.id, 'request', 'embedded');
  assert.equal((await f.service.status(user, result.orderId)).status, 'created');
  f.session.status = 'complete';
  // Completion is not proof of payment until Stripe reports paid.
  assert.equal((await f.service.status(user, result.orderId)).status, 'created');
  f.session.payment_status = 'paid';
  assert.equal((await f.service.status(user, result.orderId)).status, 'paid');
  assert.equal((await f.service.status(user, result.orderId)).status, 'paid');
  await assert.rejects(f.service.status({ ...user, uid: 'bob' }, result.orderId), /not found/);
  await assert.rejects(f.service.status({ ...user, verified: false }, result.orderId), /Verify/);
});
test('payment reconciliation rejects mismatched Stripe ownership, prices, currency and mode', async () => {
  const user = { uid: 'alice', verified: true, admin: false };
  for (const patch of [
    { amount_total: 1 },
    { currency: 'eur' },
    { livemode: true },
    { client_reference_id: 'other' },
    { id: 'cs_other' },
    { mode: 'subscription' },
    { metadata: { voyaspanOrderId: 'order_' + 'a'.repeat(48), voyaspanUid: 'bob' } },
  ]) {
    const f = fixture();
    const result = await f.service.checkout(user, f.plan.id, 'request', 'embedded');
    Object.assign(f.session, patch, { payment_status: 'paid', status: 'complete' });
    await assert.rejects(f.service.status(user, result.orderId), /does not match/);
    assert.equal(f.getOrder()!.status, 'created');
  }
});
test('expired sessions cannot undo a paid order and delayed payment can recover an expired order', async () => {
  const f = fixture();
  const user = { uid: 'alice', verified: true, admin: false };
  const result = await f.service.checkout(user, f.plan.id, 'request', 'embedded');
  f.session.status = 'expired';
  assert.equal((await f.service.status(user, result.orderId)).status, 'expired');
  f.session.status = 'complete';
  f.session.payment_status = 'paid';
  assert.equal((await f.service.status(user, result.orderId)).status, 'paid');
  f.session.status = 'expired';
  f.session.payment_status = 'unpaid';
  assert.equal((await f.service.status(user, result.orderId)).status, 'paid');
});
test('payment status endpoint requires authentication and rejects client payment claims', async () => {
  const f = fixture();
  const app = await createApp({
    payments: f.service,
    verify: async (token) => ({ uid: token, verified: token !== 'unverified', admin: false }),
  });
  try {
    const result = await f.service.checkout(
      { uid: 'alice', verified: true, admin: false },
      f.plan.id,
      'request',
      'embedded',
    );
    const url = '/v1/orders/' + result.orderId + '/payment-status';
    const resumeUrl = '/v1/orders/' + result.orderId + '/resume-checkout';
    assert.equal((await app.inject({ method: 'POST', url: resumeUrl })).statusCode, 401);
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: resumeUrl,
          headers: { authorization: 'Bearer bob' },
        })
      ).statusCode,
      400,
    );
    const resumed = await app.inject({
      method: 'POST',
      url: resumeUrl,
      headers: { authorization: 'Bearer alice' },
    });
    assert.equal(resumed.statusCode, 200);
    assert.equal(resumed.json().clientSecret, f.session.client_secret);
    assert.equal(resumed.json().url, undefined);

    assert.equal((await app.inject({ method: 'POST', url })).statusCode, 401);
    assert.equal(
      (await app.inject({ method: 'POST', url, headers: { authorization: 'Bearer unverified' } }))
        .statusCode,
      403,
    );
    assert.equal(
      (await app.inject({ method: 'POST', url, headers: { authorization: 'Bearer bob' } }))
        .statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url,
          headers: { authorization: 'Bearer alice' },
          payload: { status: 'paid' },
        })
      ).statusCode,
      400,
    );
    f.session.status = 'complete';
    f.session.payment_status = 'paid';
    const response = await app.inject({
      method: 'POST',
      url,
      headers: { authorization: 'Bearer alice' },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      orderId: result.orderId,
      status: 'paid',
      canResume: false,
    });
  } finally {
    await app.close();
  }
});

test('customers can resume an unpaid embedded session but not another customer’s or a completed session', async () => {
  const f = fixture();
  const user = { uid: 'alice', verified: true, admin: false };
  const checkout = await f.service.checkout(user, f.plan.id, 'request', 'embedded');
  assert.equal((await f.service.status(user, checkout.orderId)).canResume, true);
  assert.deepEqual(await f.service.resume(user, checkout.orderId), checkout);
  assert.equal(f.getCreates(), 1);
  await assert.rejects(f.service.resume({ ...user, uid: 'bob' }, checkout.orderId), /not found/);
  await assert.rejects(f.service.resume({ ...user, verified: false }, checkout.orderId), /Verify/);
  f.session.payment_status = 'paid';
  f.session.status = 'complete';
  await f.service.status(user, checkout.orderId);
  await assert.rejects(f.service.resume(user, checkout.orderId), /closed/);
});

test('live checkout reports live mode, accepts live payment confirmation and rejects test events', async () => {
  const f = fixture('live'),
    user = { uid: 'alice', verified: true, admin: false };
  const result = await f.service.checkout(user, f.plan.id, 'request', 'embedded');
  assert.equal(result.paymentMode, 'live');
  assert.equal(f.getOrder()!.test, false);
  f.session.status = 'complete';
  f.session.payment_status = 'paid';
  assert.equal((await f.service.status(user, result.orderId)).status, 'paid');
  const stripe = new Stripe('sk_test_unit');
  const payload = JSON.stringify({
    id: 'evt_wrong_mode',
    object: 'event',
    livemode: false,
    type: 'checkout.session.completed',
    data: { object: f.session },
  });
  await assert.rejects(
    f.service.webhook(
      Buffer.from(payload),
      stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' }),
    ),
    /environment mismatch/,
  );
  const app = await createApp({ payments: f.service, fulfillment: null });
  try {
    assert.equal((await app.inject({ url: '/v1/config' })).json().paymentMode, 'live');
  } finally {
    await app.close();
  }
});

test('refund webhooks reconcile current Stripe status rather than trusting stale event status', async () => {
  const f = fixture('live'),
    signer = new Stripe('sk_test_fixture');
  async function send(type: string, status: string) {
    const payload = JSON.stringify({
      id: 'evt_refund_fixture_' + status,
      object: 'event',
      livemode: true,
      type,
      data: { object: { id: 're_fixture', charge: 'ch_fixture', status } },
    });
    await f.service.webhook(
      Buffer.from(payload),
      signer.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' }),
    );
  }
  await send('refund.updated', 'pending');
  assert.deepEqual(f.adjustments[0], { failed: false, pending: true });
  f.refund.status = 'succeeded';
  await send('refund.failed', 'failed');
  assert.deepEqual(f.adjustments[1], { failed: false, pending: false });
  f.refund.status = 'failed';
  await send('refund.updated', 'pending');
  assert.deepEqual(f.adjustments[2], { failed: true, pending: false });
});
