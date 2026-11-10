import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {
  FulfillmentService,
  type FulfillmentStore,
  type DeliveryOrder,
  type DeliverySupplier,
} from '../src/lib/fulfillment.js';
import { SupplierError, SupplierClient, type Activation } from '../src/lib/supplier.js';
import { configuredPayments } from '../src/lib/payments.js';
import { createApp } from '../src/app.js';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
const activation: Activation = {
  ac: 'LPA:1$example.com$PRIVATE-TEST-CODE',
  iccid: '89852245280001113019',
  esimTranNo: 'profile1',
};
function fixture() {
  const order: DeliveryOrder = {
    id: 'order_' + 'a'.repeat(48),
    uid: 'alice',
    test: false,
    plan: { ...demoPlans[0], demo: false },
    amountCents: demoPlans[0].priceCents,
    currency: 'USD',
    status: 'paid',
    supplierCode: 'sku',
    wholesaleUnits: 1000,
    sessionId: 'cs_live_fixture',
    paymentIntentId: 'pi_fixture',
    lease: 'lease1',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  let done = false,
    saved: Activation | undefined,
    refunds = 0,
    profiles = 0;
  const submitted: string[] = [];
  const session = {
    id: order.sessionId,
    mode: 'payment',
    livemode: true,
    status: 'complete',
    payment_status: 'paid',
    payment_intent: order.paymentIntentId,
    currency: 'usd',
    amount_total: order.amountCents,
    client_reference_id: order.id,
    metadata: { voyaspanUid: order.uid, voyaspanOrderId: order.id },
  };
  const charge = { refunded: false, amount_refunded: 0, disputed: false };
  const intent = {
    id: order.paymentIntentId,
    livemode: true,
    status: 'succeeded',
    currency: 'usd',
    amount_received: order.amountCents,
    latest_charge: charge,
  };
  const refund = {
    id: 're_test',
    payment_intent: order.paymentIntentId,
    amount: order.amountCents,
    currency: 'usd',
    status: 'succeeded',
  };
  const stripe = {
    checkout: { sessions: { retrieve: async () => session } },
    paymentIntents: { retrieve: async () => intent },
    refunds: {
      list: async () => ({ data: [] }),
      create: async () => {
        refunds++;
        return refund;
      },
      retrieve: async () => refund,
    },
  } as unknown as Stripe;
  const store: FulfillmentStore = {
    due: async () => (done ? [] : [order.id]),
    claim: async () => {
      order.attempts++;
      return { ...order };
    },
    update: async (o, fields) => {
      Object.assign(order, fields);
      Object.assign(o, fields);
    },
    retry: async () => {},
    finish: async (_o, fields, a) => {
      Object.assign(order, fields);
      saved = a;
      done = true;
    },
    activation: async (uid, id) =>
      uid === order.uid && id === order.id && order.status === 'ready' ? (saved ?? null) : null,
  };
  const supplier: DeliverySupplier = {
    order: async (tx) => {
      submitted.push(tx);
      return 'vendor-order';
    },
    profile: async () => {
      profiles++;
      return activation;
    },
  };
  const service = new FulfillmentService(stripe, store, supplier);
  return {
    order,
    session,
    intent,
    charge,
    refund,
    supplier,
    store,
    stripe,
    service,
    submitted,
    getSaved: () => saved,
    getRefunds: () => refunds,
    getProfiles: () => profiles,
  };
}
test('paid live orders deliver exactly once and expose activation only to the owner', async () => {
  const f = fixture();
  assert.deepEqual(await f.service.run(), { processed: 1, failed: 0 });
  assert.equal(f.order.status, 'ready');
  assert.deepEqual(f.getSaved(), activation);
  assert.equal(f.submitted.length, 1);
  assert.ok(f.submitted[0].length <= 50);
  await f.service.run();
  assert.equal(f.submitted.length, 1);
  assert.deepEqual(await f.service.activation('alice', f.order.id), activation);
  assert.equal(await f.service.activation('bob', f.order.id), null);
});
test('ambiguous supplier timeouts retry the same transaction without refunding or duplicate orders', async () => {
  const f = fixture();
  let attempts = 0;
  f.supplier.order = async (tx) => {
    f.submitted.push(tx);
    if (++attempts === 1) throw new Error('timeout after supplier accepted');
    return 'vendor-order';
  };
  assert.equal((await f.service.run()).failed, 1);
  assert.equal(f.order.status, 'fulfilling');
  assert.equal(f.getRefunds(), 0);
  await f.service.run();
  assert.equal(f.order.status, 'ready');
  assert.equal(f.submitted[0], f.submitted[1]);
});
test('profile allocation is retried without ordering another eSIM', async () => {
  const f = fixture();
  let attempts = 0;
  f.supplier.profile = async () => (++attempts === 1 ? null : activation);
  await f.service.run();
  assert.equal(f.order.status, 'provision_wait');
  assert.equal(f.getSaved(), undefined);
  await f.service.run();
  assert.equal(f.order.status, 'ready');
  assert.equal(f.submitted.length, 1);
});
test('definite supplier rejection refunds the original payment and does not expose an activation', async () => {
  const f = fixture();
  f.supplier.order = async () => {
    throw new SupplierError('200011', true);
  };
  await f.service.run();
  assert.equal(f.order.status, 'refunded');
  assert.equal(f.getRefunds(), 1);
  assert.equal(f.getSaved(), undefined);
  await f.service.run();
  assert.equal(f.getRefunds(), 1);
});
test('pending refunds are checked later without creating another refund', async () => {
  const f = fixture();
  f.refund.status = 'pending';
  f.supplier.order = async () => {
    throw new SupplierError('200007', true);
  };
  await f.service.run();
  assert.equal(f.order.status, 'refund_pending');
  assert.equal(f.getRefunds(), 1);
  f.refund.status = 'succeeded';
  await f.service.run();
  assert.equal(f.order.status, 'refunded');
  assert.equal(f.getRefunds(), 1);
});
test('test, unpaid, mismatched and refunded payments cannot issue eSIMs', async () => {
  for (const patch of [
    () => {
      const f = fixture();
      f.order.test = true;
      return f;
    },
    () => {
      const f = fixture();
      f.session.payment_status = 'unpaid';
      return f;
    },
    () => {
      const f = fixture();
      f.session.amount_total = 1;
      return f;
    },
    () => {
      const f = fixture();
      f.charge.refunded = true;
      f.charge.amount_refunded = f.order.amountCents;
      return f;
    },
    () => {
      const f = fixture();
      f.charge.disputed = true;
      return f;
    },
  ]) {
    const f = patch();
    await f.service.run();
    assert.equal(f.submitted.length, 0);
    assert.equal(f.getSaved(), undefined);
  }
});
test('activation and worker routes enforce verified ownership and worker identity', async () => {
  const f = fixture();
  await f.service.run();
  const app = await createApp({
    payments: null,
    fulfillment: f.service,
    verify: async (token) => ({ uid: token, verified: token !== 'unverified', admin: false }),
  });
  try {
    const url = '/v1/orders/' + f.order.id + '/activation';
    assert.equal((await app.inject({ url })).statusCode, 401);
    assert.equal(
      (await app.inject({ url, headers: { authorization: 'Bearer unverified' } })).statusCode,
      403,
    );
    assert.equal(
      (await app.inject({ url, headers: { authorization: 'Bearer bob' } })).statusCode,
      404,
    );
    const response = await app.inject({ url, headers: { authorization: 'Bearer alice' } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(response.json(), { activation });
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/internal/fulfillment/run',
          headers: { authorization: 'Bearer alice' },
          payload: {},
        })
      ).statusCode,
      401,
    );
  } finally {
    await app.close();
  }
});
test('live payments require matching live keys and a configured delivery worker', () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, {
      PAYMENTS_MODE: 'live',
      STRIPE_SECRET_KEY: 'sk_test_fixture',
      STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
      SITE_URL: 'https://alozuri.com',
      DEMO_MODE: 'false',
      FULFILLMENT_ENABLED: 'true',
      ESIM_ACCESS_CODE: 'fixture',
      ESIM_SECRET_KEY: 'fixture',
      FULFILLMENT_WORKER_AUDIENCE: 'https://api.example.com/internal/fulfillment/run',
      FULFILLMENT_WORKER_SERVICE_ACCOUNT: 'worker@example.com',
    });
    assert.equal(configuredPayments(), null);
    process.env.STRIPE_SECRET_KEY = 'sk_live_fixture';
    assert.equal(configuredPayments()?.mode, 'live');
    process.env.FULFILLMENT_ENABLED = 'false';
    assert.equal(configuredPayments(), null);
    process.env.FULFILLMENT_ENABLED = 'true';
    delete process.env.FULFILLMENT_WORKER_AUDIENCE;
    assert.equal(configuredPayments(), null);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
test('supplier adapter binds delivery profile to the original order and package', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const client = new SupplierClient('fixture', 'fixture');
    let captured: Record<string, unknown> = {};
    globalThis.fetch = async (_url, init) => {
      captured = JSON.parse(init!.body as string);
      return new Response(JSON.stringify({ success: true, obj: { orderNo: 'supplier-1' } }), {
        status: 200,
      });
    };
    assert.equal(await client.order('stable-tx', 'sku', 1000), 'supplier-1');
    assert.deepEqual(captured, {
      transactionId: 'stable-tx',
      amount: 1000,
      packageInfoList: [{ packageCode: 'sku', count: 1, price: 1000 }],
    });
    await client.order('stable-daily-tx', 'daily-sku', 1000, 1);
    assert.deepEqual(captured.packageInfoList, [
      { packageCode: 'daily-sku', count: 1, price: 1000, periodNum: 1 },
    ]);
    const profile = {
      ...activation,
      orderNo: 'supplier-1',
      transactionId: 'stable-tx',
      smdpStatus: 'RELEASED',
      packageList: [{ packageCode: 'sku' }],
    };
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: true, obj: { esimList: [profile] } }), {
        status: 200,
      });
    assert.deepEqual(await client.profile('supplier-1', 'stable-tx', 'sku'), activation);
    await assert.rejects(client.profile('supplier-other', 'stable-tx', 'sku'), /does not match/);
    await assert.rejects(client.profile('supplier-1', 'stable-tx', 'wrong-sku'), /does not match/);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: false, errorCode: '200010', obj: null }), {
        status: 200,
      });
    assert.equal(await client.profile('supplier-1', 'stable-tx', 'sku'), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
