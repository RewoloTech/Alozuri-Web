import test from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmedMetaPurchase,
  metaMoney,
  metaEventId,
  metaSafeUrl,
} from '../../apps/web/src/lib/meta-events.ts';
import { sendMetaPurchase } from '../../apps/web/src/lib/meta-conversions.ts';
import {
  CONSENT_COOKIE,
  privacyChoice,
  readPrivacyChoice,
} from '../../packages/shared/src/privacy.ts';
const order = {
  id: 'purchase_' + 'a'.repeat(48),
  totalCents: 113,
  currency: 'GBP',
  status: 'paid',
  test: false,
  paidAt: new Date().toISOString(),
};
test('marketing is separate, explicit, versioned and opt-out by default', () => {
  assert.equal(privacyChoice(true).marketing, false);
  assert.equal(
    readPrivacyChoice(
      encodeURIComponent(JSON.stringify({ ...privacyChoice(true), version: '2026-11-11.1' })),
    ),
    null,
  );
  assert.equal(
    readPrivacyChoice(encodeURIComponent(JSON.stringify(privacyChoice(false, Date.now(), true))))
      ?.marketing,
    true,
  );
});
test('actual minor units and supported currencies only; no pending, test, refunded or historical sales', () => {
  assert.deepEqual(confirmedMetaPurchase(order), { value: 1.13, currency: 'GBP' });
  assert.deepEqual(confirmedMetaPurchase({ ...order, status: 'attention' }), {
    value: 1.13,
    currency: 'GBP',
  });
  assert.equal(confirmedMetaPurchase({ ...order, status: 'attention', paidAt: undefined }), null);
  assert.deepEqual(metaMoney(1250, 'EUR'), { value: 12.5, currency: 'EUR' });
  for (const change of [
    { paidAt: undefined },
    { status: 'pending_payment' },
    { status: 'refunded' },
    { test: true },
    { totalCents: NaN },
    { totalCents: -1 },
    { totalCents: 1.2 },
    { currency: 'JPY' },
    { paidAt: '2026-01-01' },
    { paidAt: new Date(Date.now() + 60000).toISOString() },
  ])
    assert.equal(confirmedMetaPurchase({ ...order, ...change }), null);
});
test('event IDs are stable for retries, namespaced and do not disclose the order identifier', async () => {
  const id = await metaEventId('Purchase', order.id);
  assert.equal(id, await metaEventId('Purchase', order.id));
  assert.notEqual(id, await metaEventId('InitiateCheckout', order.id));
  assert.match(id, /^alozuri_[a-f0-9]{64}$/);
});
test('private pages and credentials never initialise or emit pixel events', () => {
  for (const path of [
    '/operations',
    '/login',
    '/account/orders',
    '/reset-password',
    '/checkout?email=a@example.com',
    '/checkout/success?order=x&payment_intent_client_secret=secret',
    '/checkout/success?order=x#access=secret',
    '/?unknown=token',
  ])
    assert.equal(metaSafeUrl('https://alozuri.com' + path), false, path);
  for (const path of [
    '/',
    '/plans/gb-plan',
    '/cart',
    '/checkout?buy=gb-plan',
    '/checkout/success?order=' + order.id,
  ])
    assert.equal(metaSafeUrl('https://alozuri.com' + path), true, path);
});
test('CAPI verifies consent and order authority, sends actual amounts and the same ID without credentials', async () => {
  const keys = ['META_CONVERSIONS_API_TOKEN', 'META_GRAPH_API_VERSION', 'NEXT_PUBLIC_API_URL'];
  const before = keys.map((k) => process.env[k]);
  Object.assign(process.env, {
    META_CONVERSIONS_API_TOKEN: 'private-token',
    META_GRAPH_API_VERSION: 'v99.0',
    NEXT_PUBLIC_API_URL: 'https://api.example.com',
  });
  const calls: { url: string; init?: RequestInit }[] = [];
  let current = order;
  const send: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(
      String(url).includes('graph.facebook.com') ? { events_received: 1 } : current,
    );
  };
  const request = (marketing = true, origin = 'https://alozuri.com', auth = true) =>
    new Request('https://alozuri.com/api/marketing/purchase', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(privacyChoice(false, Date.now(), marketing)))}; _fbp=fb.1.1794614400000.123456`,
        ...(auth ? { 'X-Order-Access': 'private-access' } : {}),
      },
      body: JSON.stringify({ orderId: order.id }),
    });
  try {
    assert.equal((await sendMetaPurchase(request(false), send)).status, 200);
    assert.equal((await sendMetaPurchase(request(true, 'https://evil.example'), send)).status, 403);
    assert.equal(
      (await sendMetaPurchase(request(true, 'https://alozuri.com', false), send)).status,
      403,
    );
    assert.equal(calls.length, 0);
    current = { ...order, status: 'pending_payment' };
    await sendMetaPurchase(request(), send);
    assert.equal(calls.length, 1);
    current = order;
    await sendMetaPurchase(request(), send);
    await sendMetaPurchase(request(), send);
    const events = calls.filter((c) => c.url.includes('graph.facebook.com'));
    assert.equal(events.length, 2);
    const payload = JSON.parse(String(events[0].init?.body));
    const again = JSON.parse(String(events[1].init?.body));
    assert.equal(payload.data[0].event_id, await metaEventId('Purchase', order.id));
    assert.equal(payload.data[0].event_id, again.data[0].event_id);
    assert.deepEqual(payload.data[0].custom_data, { value: 1.13, currency: 'GBP' });
    assert.equal(payload.access_token, 'private-token');
    assert.doesNotMatch(
      JSON.stringify(payload.data),
      /private-access|purchase_|email|client_secret/,
    );
    assert.equal(
      new Headers(calls.find((c) => c.url.includes('api.example.com'))?.init?.headers).get(
        'x-order-access',
      ),
      'private-access',
    );
  } finally {
    keys.forEach((k, index) => {
      if (before[index] === undefined) delete process.env[k];
      else process.env[k] = before[index];
    });
  }
});
