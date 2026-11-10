// Real Stripe sandbox card payment + local Firestore. Never loads live keys or calls the supplier.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { CommerceService } from '../apps/api/src/lib/commerce.ts';
import { createApp } from '../apps/api/src/app.ts';
import type { StoredPlan } from '../packages/shared/src/index.ts';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8188')
  throw new Error('Run through npm run test:stripe with the local Firestore emulator.');
function envFile(file: string) {
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => {
        const i = l.indexOf('=');
        return [
          l.slice(0, i),
          l
            .slice(i + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ''),
        ];
      }),
  );
}
const serverEnv = envFile('apps/api/.env'),
  webEnv = envFile('apps/web/.env.local');
const secret = serverEnv.STRIPE_SECRET_KEY,
  publishable = serverEnv.STRIPE_TEST_PUBLISHABLE_KEY || webEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
if (!secret?.startsWith('sk_test_') || !publishable?.startsWith('pk_test_'))
  throw new Error('Matching local Stripe TEST keys are required.');
const firebase = initializeApp({ projectId: 'demo-alozuri' }),
  db = getFirestore(firebase),
  stripe = new Stripe(secret, { maxNetworkRetries: 1, timeout: 15000 });
const plan: StoredPlan = {
  id: 'esim-stripe-integration',
  name: 'Alozuri sandbox verification',
  countries: ['FR'],
  dataGb: 1,
  days: 7,
  priceCents: 100,
  currency: 'USD',
  dataType: 'fixed',
  activation: 'Sandbox fixture. No eSIM is issued.',
  networks: [],
  fairUse: 'Test only.',
  syncedAt: new Date().toISOString(),
  demo: false,
  active: true,
  supplierCode: 'no-supplier-call',
  wholesaleUnits: 1000,
};
const webhookSecret = 'whsec_local_stripe_e2e_transport',
  service = new CommerceService(
    stripe,
    'test',
    webhookSecret,
    'test-only-order-access-signing-key-48-characters',
    'http://localhost:3100',
    async () => plan,
    db,
  );
const api = await createApp({
  repository: { plans: async () => [plan], orders: async () => [], order: async () => null },
  payments: null,
  commerce: service,
  fulfillment: null,
  demo: false,
  origins: ['http://localhost:3100'],
  verify: async () => {
    throw new Error('Guest checkout test');
  },
});
await api.listen({ host: '127.0.0.1', port: 8189 });
let polling = false;
// Simulate delivery of signed webhook transport after observing a real Stripe test payment.
// Production never polls here; it receives Stripe's signed HTTP webhook.
const timer = setInterval(async () => {
  if (polling) return;
  polling = true;
  try {
    const docs = await db
      .collection('purchases')
      .where('status', 'in', ['pending_payment', 'payment_processing'])
      .limit(10)
      .get();
    for (const doc of docs.docs) {
      const id = doc.get('paymentIntentId');
      if (!id) continue;
      const intent = await stripe.paymentIntents.retrieve(id);
      if (intent.status !== 'succeeded') continue;
      const payload = JSON.stringify({
        id: 'evt_e2e_' + id,
        object: 'event',
        livemode: false,
        type: 'payment_intent.succeeded',
        data: { object: intent },
      });
      const response = await api.inject({
        method: 'POST',
        url: '/v1/webhooks/stripe',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': stripe.webhooks.generateTestHeaderString({
            payload,
            secret: webhookSecret,
          }),
        },
        payload,
      });
      if (response.statusCode !== 200)
        console.error('Local signed webhook was rejected: ' + response.statusCode);
    }
  } catch {
    console.error('Sandbox webhook transport check failed.');
  } finally {
    polling = false;
  }
}, 1500);
const child = spawn(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', 'test', 'tests/e2e/stripe-sdk.spec.ts'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      STRIPE_INTEGRATION: '1',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: publishable,
    },
  },
);
const exitCode = await new Promise<number>((resolve) =>
  child.on('exit', (code) => resolve(code ?? 1)),
);
clearInterval(timer);
while (polling) await new Promise((r) => setTimeout(r, 50));
const purchases = await db.collection('purchases').get();
for (const doc of purchases.docs) {
  const id = doc.get('paymentIntentId');
  if (id) {
    const intent = await stripe.paymentIntents.retrieve(id);
    if (
      ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(
        intent.status,
      )
    )
      await stripe.paymentIntents.cancel(id);
  }
}
await api.close();
await db.terminate();
await deleteApp(firebase);
process.exitCode = exitCode;
