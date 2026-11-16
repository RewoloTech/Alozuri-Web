import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import {
  freezeNotification,
  readNotification,
  installationSnapshotHash,
} from '../src/lib/notification-snapshot.js';
import { confirmationPayloadHash } from '../src/lib/order-email.js';

test('draft language preview requires a verified administrator and returns no customer records', async () => {
  const app = await createApp({
    repository: { plans: async () => [], orders: async () => [], order: async () => null },
    payments: null,
    fulfillment: null,
    commerce: null,
    verify: async (token) => ({
      uid: token,
      verified: token !== 'unverified',
      admin: token === 'admin' || token === 'unverified',
    }),
  });
  try {
    const url = '/v1/operations/localization/preview?locale=ar';
    assert.equal((await app.inject(url)).statusCode, 401);
    for (const token of ['customer', 'unverified'])
      assert.equal(
        (await app.inject({ url, headers: { authorization: 'Bearer ' + token } })).statusCode,
        403,
      );
    const result = await app.inject({ url, headers: { authorization: 'Bearer admin' } });
    assert.equal(result.statusCode, 200);
    assert.equal(result.json().published, false);
    assert.equal(result.json().legal.status, 'missing');
    assert.match(result.json().email.html, /dir="rtl"/);
    assert.match(result.headers['cache-control'] ?? '', /no-store/);
    const invalid = await app.inject({
      url: '/v1/operations/localization/preview?locale=xx',
      headers: { authorization: 'Bearer admin', 'x-alozuri-error-format': '2' },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error.code, 'VALIDATION_FAILED');
    assert.equal(invalid.json().error.field, 'locale');
  } finally {
    await app.close();
  }
});

test('API exposes stable structured errors with a legacy compatibility envelope', async () => {
  const app = await createApp({
    repository: { plans: async () => [], orders: async () => [], order: async () => null },
  });
  try {
    const canonical = await app.inject({
      url: '/v1/orders',
      headers: { 'x-alozuri-error-format': '2' },
    });
    assert.equal(canonical.statusCode, 401);
    assert.equal(canonical.json().error.code, 'AUTHENTICATION_REQUIRED');
    assert.equal(typeof canonical.json().error.requestId, 'string');
    assert.deepEqual(canonical.json().error.params, {});
    const legacy = await app.inject('/v1/orders');
    assert.equal(typeof legacy.json().error, 'string');
    assert.equal(legacy.json().errorDetails.code, 'AUTHENTICATION_REQUIRED');
  } finally {
    await app.close();
  }
});

test('durable notification snapshot freezes subject, content, sender and provider identity', () => {
  const rendered = freezeNotification({
    id: 'purchase_sample',
    email: 'preview@example.invalid',
    url: 'https://alozuri.com/checkout/success',
    html: '<p>Original</p>',
    text: 'Original',
  });
  const saved = {
    event: 'order-confirmation',
    orderId: rendered.id,
    locale: 'en',
    templateVersion: rendered.version,
    payloadHash: confirmationPayloadHash(rendered),
    installationHash: null,
    rendered,
  };
  assert.deepEqual(readNotification(saved, rendered.id, 'en', null), rendered);
  assert.equal(rendered.subject, 'Your Alozuri eSIM order confirmation');
  assert.throws(() => readNotification(saved, rendered.id, 'de', null));
  assert.throws(() => readNotification(saved, 'another-order', 'en', null));
  assert.throws(() =>
    readNotification(
      { ...saved, rendered: { ...rendered, html: '<p>Changed</p>' } },
      rendered.id,
      'en',
      null,
    ),
  );
  assert.throws(() =>
    readNotification(
      saved,
      rendered.id,
      'en',
      installationSnapshotHash([{ ac: 'changed-private-data' }]),
    ),
  );
  assert.throws(() => freezeNotification({ ...rendered, text: 'x'.repeat(900_001) }));
});
