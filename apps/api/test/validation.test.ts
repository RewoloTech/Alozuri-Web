import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { cataloguePlan, ownedOrder } from '../src/lib/repository.js';
import { demoPlans } from '../../../packages/shared/src/demo.ts';

const now = Date.parse('2026-11-09T12:00:00.000Z');
const plan = { ...demoPlans[0], active: true, syncedAt: new Date(now).toISOString() };
test('catalogue rejects corrupt, stale, inactive and future records and strips private fields', () => {
  const publicPlan = cataloguePlan({ ...plan, wholesaleUnits: 123, supplierCode: 'secret' }, now);
  assert.ok(publicPlan);
  assert.equal('wholesaleUnits' in publicPlan, false);
  assert.equal('active' in publicPlan, false);
  for (const patch of [
    { priceCents: -1 },
    { priceCents: '100' },
    { priceCents: 1.5 },
    { countries: ['<script>'] },
    { days: 0 },
    { active: false },
    { syncedAt: 'invalid' },
    { syncedAt: new Date(now + 1).toISOString() },
    { syncedAt: new Date(now - 12 * 60 * 60 * 1000).toISOString() },
  ])
    assert.equal(cataloguePlan({ ...plan, ...patch }, now), null);
});
test('order validates stored fields only after ownership and never exposes nested secrets', () => {
  const order = {
    uid: 'alice',
    plan: { ...plan, secret: 'private' },
    status: 'paid',
    createdAt: new Date(now).toISOString(),
    amountCents: 899,
    currency: 'USD',
  };
  assert.equal(ownedOrder('order1', { uid: 'bob' }, 'alice'), null);
  assert.ok(!JSON.stringify(ownedOrder('order1', order, 'alice')).includes('private'));
  for (const patch of [
    { amountCents: -1 },
    { status: 'made-up' },
    { createdAt: 'bad' },
    { plan: {} },
  ])
    assert.throws(
      () => ownedOrder('order1', { ...order, ...patch }, 'alice'),
      /Invalid stored order/,
    );
});
test('API rejects extra filters, malformed IDs and invalid bodies without calling Firestore', async () => {
  let calls = 0;
  const app = await createApp({
    repository: {
      plans: async () => {
        calls++;
        return [];
      },
      orders: async () => {
        calls++;
        return [];
      },
      order: async () => {
        calls++;
        return null;
      },
    },
    verify: async () => ({ uid: 'alice', verified: true, admin: false }),
  });
  try {
    for (const url of [
      '/v1/packages?uid=bob',
      '/v1/packages?country[$ne]=FR',
      '/v1/packages/match?countries=FR&extra=1',
      '/v1/orders?uid=bob',
      '/v1/orders/bad.id',
      '/v1/packages/bad.id',
    ])
      assert.equal(
        (await app.inject({ url, headers: { authorization: 'Bearer test' } })).statusCode,
        400,
      );
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/checkout',
          headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
          payload: '{invalid',
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/checkout',
          headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
          payload: JSON.stringify({ planId: 'x'.repeat(70000) }),
        })
      ).statusCode,
      413,
    );
    assert.equal(calls, 0);
  } finally {
    await app.close();
  }
});
