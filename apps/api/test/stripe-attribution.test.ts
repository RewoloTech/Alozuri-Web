import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { BUSINESS } from '../../../packages/shared/src/legal.ts';
import { orderReference } from '../src/lib/confirmation-order.ts';
import {
  STRIPE_APP_INFO,
  newStripeAttribution,
  stripePaymentReference,
  stripeRefundMetadata,
} from '../src/lib/stripe-attribution.ts';
const id = 'purchase_' + 'a'.repeat(48);
const child = 'order_' + 'b'.repeat(48);
test('new Stripe requests explicitly identify the brand, app, company and customer order reference', () => {
  const frozen = newStripeAttribution(id);
  const result = stripePaymentReference(id, frozen);
  assert.deepEqual(result.metadata, {
    alozuriPurchaseId: id,
    app: 'alozuri',
    brand: 'Alozuri',
    company: BUSINESS.company,
    website: BUSINESS.site,
    order_reference: orderReference(id),
  });
  assert.equal(result.description, 'Alozuri eSIM order ' + orderReference(id));
  assert.deepEqual(stripePaymentReference(id, structuredClone(frozen)), result);
  assert(!('statement_descriptor' in result));
  assert(!('statement_descriptor_suffix' in result));
});
test('legacy reference payloads remain unchanged', () => {
  assert.deepEqual(stripePaymentReference(id), {
    description: 'Alozuri eSIM order ' + id,
    metadata: { alozuriPurchaseId: id },
  });
  assert.deepEqual(stripeRefundMetadata(child), { alozuriOrderId: child });
});
test('refund attribution keeps the original brand and parent reference without mixing purchases', () => {
  const frozen = newStripeAttribution(id);
  assert.deepEqual(stripeRefundMetadata(child, id, frozen), {
    ...frozen.metadata,
    alozuriOrderId: child,
  });
  assert.throws(() => stripePaymentReference('purchase_' + 'c'.repeat(48), frozen));
  assert.throws(() => stripeRefundMetadata(child, undefined, frozen));
  assert.throws(() => stripeRefundMetadata(child, 'purchase_' + 'c'.repeat(48), frozen));
  assert.throws(() => newStripeAttribution('invalid'));
  assert.throws(() =>
    stripePaymentReference(id, {
      ...frozen,
      metadata: { ...frozen.metadata, order_reference: 'AZ-FFFF-FFFF-FFFF-FFFF' },
    }),
  );
});
test('Stripe SDK requests identify the Alozuri integration without making a live API call', async () => {
  let requests = 0;
  const stripe = new Stripe('sk_test_synthetic', {
    appInfo: STRIPE_APP_INFO,
    httpClient: Stripe.createFetchHttpClient(async (input, init) => {
      requests++;
      assert.equal(String(input), 'https://api.stripe.com/v1/payment_intents/pi_synthetic');
      const header = new Headers(init?.headers).get('X-Stripe-Client-User-Agent');
      const agent = JSON.parse(header ?? '{}');
      assert.deepEqual(agent.application, STRIPE_APP_INFO);
      return Response.json({ id: 'pi_synthetic', object: 'payment_intent' });
    }),
  });
  await stripe.paymentIntents.retrieve('pi_synthetic');
  assert.equal(requests, 1);
});
