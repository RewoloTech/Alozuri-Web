import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
import { ownedOrder, type Principal, type Repository } from '../src/lib/repository.js';
const record = {
  uid: 'alice',
  plan: { ...demoPlans[0], wholesaleUnits: 58600, supplierCode: 'secret' },
  status: 'paid',
  createdAt: '2026-11-09T00:00:00.000Z',
  amountCents: 899,
  currency: 'USD',
  ac: 'activation-secret',
  qrCodeUrl: 'private-qr',
};
const repository: Repository = {
  plans: async () => demoPlans,
  orders: async (uid) => (uid === 'alice' ? [ownedOrder('order1', record, uid)!] : []),
  order: async (uid, id) => (id === 'order1' ? ownedOrder(id, record, uid) : null),
};
const verify = async (token: string): Promise<Principal> => {
  if (token === 'bad') throw new Error('bad');
  return { uid: token, verified: token !== 'unverified', admin: token === 'admin' };
};
test('API matches full itinerary and rejects invalid search inputs', async () => {
  const app = await createApp({ repository, verify });
  try {
    const result = await app.inject('/v1/packages/match?countries=FR,CH,IT&minGb=10');
    assert.equal(result.statusCode, 200);
    assert.ok(result.json().plans.length > 0);
    assert.ok(
      result
        .json()
        .plans.every((p: { countries: string[] }) =>
          ['FR', 'CH', 'IT'].every((c) => p.countries.includes(c)),
        ),
    );
    for (const query of [
      'countries=XX',
      'countries=FR&minGb=-1',
      'countries=FR&minGb=oops',
      'countries=',
    ])
      assert.equal((await app.inject('/v1/packages/match?' + query)).statusCode, 400);
    assert.deepEqual((await app.inject('/v1/packages/match?countries=FR,MD')).json().plans, []);
  } finally {
    await app.close();
  }
});
test('orders require a valid token, enforce ownership, and omit wholesale and activation secrets', async () => {
  const app = await createApp({ repository, verify });
  try {
    assert.equal((await app.inject('/v1/orders')).statusCode, 401);
    assert.equal(
      (await app.inject({ url: '/v1/orders', headers: { authorization: 'Bearer bad' } }))
        .statusCode,
      401,
    );
    assert.equal(
      (await app.inject({ url: '/v1/orders/order1', headers: { authorization: 'Bearer bob' } }))
        .statusCode,
      404,
    );
    const result = await app.inject({
      url: '/v1/orders/order1',
      headers: { authorization: 'Bearer alice' },
    });
    assert.equal(result.statusCode, 200);
    for (const secret of ['wholesaleUnits', 'supplierCode', 'activation-secret', 'private-qr'])
      assert.ok(!result.body.includes(secret));
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(ownedOrder('order1', record, 'bob'), null);
  } finally {
    await app.close();
  }
});
test('checkout blocks unverified customers, rejects client pricing, and cannot collect payments in draft', async () => {
  const app = await createApp({ repository, verify });
  try {
    const post = (token: string, payload: object) =>
      app.inject({
        method: 'POST',
        url: '/v1/checkout',
        headers: { authorization: 'Bearer ' + token },
        payload,
      });
    assert.equal((await post('unverified', { planId: 'demo-europe-5' })).statusCode, 403);
    assert.equal((await post('alice', { planId: 'demo-europe-5', priceCents: 1 })).statusCode, 400);
    assert.equal((await post('alice', { planId: 'demo-europe-5' })).statusCode, 503);
  } finally {
    await app.close();
  }
});
test('admin status checks server claims and CORS rejects unknown origins', async () => {
  const app = await createApp({ repository, verify });
  try {
    assert.equal(
      (await app.inject({ url: '/v1/admin/status', headers: { authorization: 'Bearer alice' } }))
        .statusCode,
      403,
    );
    assert.equal(
      (await app.inject({ url: '/v1/admin/status', headers: { authorization: 'Bearer admin' } }))
        .statusCode,
      200,
    );
    const unknown = await app.inject({
      url: '/health',
      headers: { origin: 'https://unknown.example' },
    });
    assert.equal(unknown.headers['access-control-allow-origin'], undefined);
    const allowed = await app.inject({
      url: '/health',
      headers: { origin: 'http://localhost:3000' },
    });
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:3000');
  } finally {
    await app.close();
  }
});
