import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Plan } from '../../packages/shared/src/index';
import { pricePackage } from '../../apps/api/src/lib/package-pricing';
import { CommerceService } from '../../apps/api/src/lib/commerce';
import { createApp } from '../../apps/api/src/app';
import { FulfillmentService, firestoreFulfillmentStore } from '../../apps/api/src/lib/fulfillment';
import { OrderWorker } from '../../apps/api/src/lib/order-worker';
import type { OrderWork } from '../../apps/api/src/lib/order-task-queue';
import type { ConfirmationEmail } from '../../apps/api/src/lib/order-email';

/** Real application services and signed webhook processing, isolated databases and
 * controlled Stripe/supplier transports. Never accepts a production Firebase host. */
export async function buyAgainCommerce(
  plan: Plan,
  uid: string,
  sourceId = 'order_' + 'a'.repeat(48),
) {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8188');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  const firebase = initializeApp({ projectId: 'demo-alozuri' });
  const db = getFirestore(firebase);
  const oldEnv = Object.fromEntries(
    ['BUY_AGAIN_ENABLED', 'ESIM_ACCESS_CODE', 'ESIM_SECRET_KEY'].map((k) => [k, process.env[k]]),
  );
  process.env.BUY_AGAIN_ENABLED = 'true';
  process.env.ESIM_ACCESS_CODE = 'synthetic-access';
  process.env.ESIM_SECRET_KEY = 'synthetic-secret';
  const originalFetch = globalThis.fetch;
  const product = pricePackage(
    {
      ...plan,
      supplierCode: plan.id,
      wholesaleUnits: 1000,
      active: true,
      demo: false,
      syncedAt: new Date().toISOString(),
    },
    { priceOverrideUsdCents: plan.priceCents },
  );
  const activation = {
    ac: 'LPA:1$rsp.example.test$BROWSER-SYNTHETIC-ONLY',
    iccid: '8900000000000000019',
    esimTranNo: 'synthetic-browser-' + uid,
  };
  const supplierPackage = {
    packageCode: product.supplierCode,
    name: plan.name,
    price: 1000,
    currencyCode: 'USD',
    volume: plan.dataGb * 1024 ** 3,
    duration: plan.days,
    durationUnit: 'DAY',
    location: plan.countries.join(','),
    dataType: 1,
    supportTopUpType: 2,
    speed: '4G',
    fupPolicy: '',
  };
  let supplierCalls = 0,
    creates = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.ok(
      url.startsWith('https://api.esimaccess.com/api/v1/open/'),
      'unexpected external request',
    );
    const body = JSON.parse(String(init?.body));
    let obj: unknown;
    if (url.endsWith('/package/list'))
      obj = {
        packageList:
          body.type === 'TOPUP'
            ? [
                {
                  ...supplierPackage,
                  packageCode: 'TOPUP-browser',
                  slug: 'verified-browser-refill',
                  supportTopUpType: 1,
                },
              ]
            : [supplierPackage],
      };
    else if (url.endsWith('/esim/query'))
      obj = {
        esimList: [
          {
            ...activation,
            orderNo: 'synthetic-original-order',
            esimStatus: 'IN_USE',
            smdpStatus: 'ENABLED',
            expiredTime: '2030-01-01T00:00:00Z',
            packageList: [{ packageCode: product.supplierCode }],
          },
        ],
      };
    else if (url.endsWith('/esim/topup')) {
      supplierCalls++;
      assert.equal(body.esimTranNo, activation.esimTranNo);
      assert.equal(body.packageCode, 'verified-browser-refill');
      obj = {
        transactionId: body.transactionId,
        iccid: activation.iccid,
        expiredTime: '2030-02-01T00:00:00Z',
        topUpEsimTranNo: 'confirmed-browser-topup',
      };
    } else throw Error('Unexpected supplier mutation');
    return Response.json({ success: true, errorCode: null, obj });
  };
  const intent = {
    id: 'pi_browser_' + crypto.randomUUID().replaceAll('-', ''),
    object: 'payment_intent',
    livemode: true,
    status: 'requires_payment_method',
    amount: 0,
    amount_received: 0,
    currency: 'usd',
    client_secret: 'pi_browser_integration_secret_controlled',
    metadata: {} as Record<string, string>,
    latest_charge: {
      id: 'ch_browser',
      refunded: false,
      amount_refunded: 0,
      disputed: false,
      payment_method_details: { type: 'card', card: { wallet: null } },
    },
  };
  const stripe = new Stripe('sk_test_controlled_transport', {
    maxNetworkRetries: 0,
    httpClient: Stripe.createFetchHttpClient(async (input, init) => {
      const url = String(input);
      assert.ok(url.startsWith('https://api.stripe.com/'), 'unexpected payment host');
      if (new URL(url).pathname.endsWith('/v1/payment_intents') && init?.method === 'POST') {
        creates++;
        const fields = new URLSearchParams(String(init.body));
        intent.amount = Number(fields.get('amount'));
        intent.currency = fields.get('currency') ?? 'usd';
        intent.metadata = Object.fromEntries(
          [...fields.entries()]
            .filter(([key]) => /^metadata\[.+\]$/.test(key))
            .map(([key, value]) => [key.slice(9, -1), value]),
        );
        return Response.json(intent);
      }
      if (new URL(url).pathname.endsWith('/v1/payment_intents/' + intent.id))
        return Response.json(intent);
      if (new URL(url).pathname.endsWith('/v1/charges/ch_browser'))
        return Response.json({ ...intent.latest_charge, payment_intent: intent.id });
      throw Error('Unexpected payment request: ' + new URL(url).pathname);
    }),
  });
  const tasks: OrderWork[] = [],
    emails: ConfirmationEmail[] = [];
  const queue = {
    enqueue: async (work: OrderWork) => {
      tasks.push(work);
    },
  };
  const commerce = new CommerceService(
    stripe,
    'live',
    'whsec_browser_fixture',
    's'.repeat(48),
    'https://alozuri.com',
    async (id) => {
      assert.equal(id, product.id);
      return { ...product, syncedAt: new Date().toISOString() };
    },
    db,
    {
      send: async (email) => {
        emails.push(email);
        return { providerMessageId: 'browser-confirmation' };
      },
      deliveryStatus: async () => 'delivered',
    },
    null,
    undefined,
    undefined,
    queue,
  );
  const delivery = new FulfillmentService(stripe, firestoreFulfillmentStore(), {
    order: async () => {
      throw Error('Top-up must not create another eSIM');
    },
    profile: async () => {
      throw Error('Top-up must reuse its existing activation');
    },
  });
  const worker = new OrderWorker(db, commerce, delivery, queue);
  await db.doc('orders/' + sourceId).set({
    uid,
    test: false,
    status: 'ready',
    plan: product,
    supplierCode: product.supplierCode,
    wholesaleUnits: 1000,
    supplierOrderNo: 'synthetic-original-order',
    originalSupplierPackage: supplierPackage,
    createdAt: '2026-11-01T00:00:00Z',
  });
  await db
    .doc('orderActivations/' + sourceId)
    .set({ uid, ...activation, topUpCount: 0, topUpHistoryKnown: true });
  const api = await createApp({
    repository: { plans: async () => [product], orders: async () => [], order: async () => null },
    commerce,
    payments: null,
    fulfillment: delivery,
    profiles: null,
    financial: null,
    operations: null,
    operationsEsims: null,
    pricingHistory: null,
    orderWorker: worker,
    verify: async (token) => {
      const user = await getAuth(firebase).verifyIdToken(token);
      assert.equal(user.uid, uid);
      return {
        uid: user.uid,
        email: user.email,
        verified: user.email_verified === true,
        admin: false,
      };
    },
  });
  return {
    api,
    emails,
    intent,
    supplierCalls: () => supplierCalls,
    creates: () => creates,
    async pay() {
      intent.status = 'succeeded';
      intent.amount_received = intent.amount;
      const payload = JSON.stringify({
        id: 'evt_browser_' + crypto.randomUUID().replaceAll('-', ''),
        created: Math.floor(Date.now() / 1000),
        object: 'event',
        livemode: true,
        type: 'payment_intent.succeeded',
        data: { object: intent },
      });
      for (let i = 0; i < 2; i++) {
        const result = await api.inject({
          method: 'POST',
          url: '/v1/webhooks/stripe',
          payload,
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': stripe.webhooks.generateTestHeaderString({
              payload,
              secret: 'whsec_browser_fixture',
            }),
          },
        });
        assert.equal(result.statusCode, 200, result.body);
      }
      assert.equal(tasks.length, 1);
      await Promise.all([worker.run(tasks[0]), worker.run(tasks[0])]);
      assert.equal(creates, 1, 'one payment intent');
      const units = await db.collection('orders').where('parentOrderId', '==', tasks[0].id).get();
      const states = units.docs.map((d) => ({
        status: d.get('status'),
        deliveryError: d.get('deliveryError'),
        topupState: d.get('topupState'),
      }));
      assert.equal(supplierCalls, 1, 'one top-up: ' + JSON.stringify(states));
      assert.equal(emails.length, 1, 'one receipt: ' + JSON.stringify(states));
      assert.equal(emails[0].attachments?.length ?? 0, 0);
      assert.ok(emails[0].text.includes('Top-up successful'));
      assert.ok(!emails[0].text.includes(activation.ac));
      assert.equal((await db.doc('orderActivations/' + sourceId).get()).get('topUpCount'), 1);
    },
    async close() {
      await api.close();
      globalThis.fetch = originalFetch;
      for (const [key, value] of Object.entries(oldEnv))
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      await deleteApp(firebase);
    },
  };
}
