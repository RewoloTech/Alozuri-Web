import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { eventHash, type EsimEvent, type EsimWebhookInbox } from '../src/lib/esim-webhook.js';
const token = 'a'.repeat(64);
const url = '/v1/webhooks/esim-access?token=' + token;
const event = (notifyType = 'ORDER_STATUS') => ({
  notifyType,
  notifyId: 'test-event-1',
  eventGenerateTime: '2026-11-10T00:00:00Z',
  content: {
    orderNo: 'test-order',
    orderStatus: 'GOT_RESOURCE',
    transactionId: 'test-transaction',
  },
});
function memoryInbox() {
  const records = new Map<string, EsimEvent>();
  const inbox: EsimWebhookInbox = {
    async save(event) {
      const previous = records.get(event.notifyId);
      if (previous) return eventHash(previous) === eventHash(event) ? 'duplicate' : 'conflict';
      records.set(event.notifyId, event);
      return 'stored';
    },
  };
  return { inbox, records };
}
test('webhook is disabled without a token and rejects unauthorized requests before parsing or writing', async () => {
  const { inbox, records } = memoryInbox();
  const disabled = await createApp({ esimWebhook: { token: '', inbox } });
  assert.equal((await disabled.inject({ method: 'POST', url, payload: event() })).statusCode, 503);
  await disabled.close();
  const app = await createApp({ esimWebhook: { token, inbox } });
  try {
    for (const path of [
      '/v1/webhooks/esim-access',
      '/v1/webhooks/esim-access?token=bad',
      url + '&extra=1',
      url + '&token=bad',
    ]) {
      assert.equal(
        (await app.inject({ method: 'POST', url: path, payload: event() })).statusCode,
        401,
      );
    }
    assert.equal(records.size, 0);
  } finally {
    await app.close();
  }
});
test('health check returns 200 without creating an order or inbox record', async () => {
  const { inbox, records } = memoryInbox();
  const app = await createApp({ esimWebhook: { token, inbox } });
  try {
    const result = await app.inject({
      method: 'POST',
      url,
      payload: {
        ...event('CHECK_HEALTH'),
        content: { orderNo: '1234567890', orderStatus: 'Test' },
      },
    });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.json(), { success: true });
    assert.equal(records.size, 0);
  } finally {
    await app.close();
  }
});
test('business notifications are validated, stripped to known fields, durably acknowledged and deduplicated', async () => {
  const { inbox, records } = memoryInbox();
  const app = await createApp({ esimWebhook: { token, inbox } });
  const post = (payload: unknown) =>
    app.inject({ method: 'POST', url, payload: payload as object });
  try {
    const first = {
      ...event(),
      uid: 'attacker',
      content: { ...event().content, ac: 'activation-secret', qrCodeUrl: 'private-qr', price: 1 },
    };
    assert.equal((await post(first)).statusCode, 200);
    assert.equal((await post(event())).statusCode, 200);
    assert.equal(records.size, 1);
    assert.ok(!JSON.stringify([...records.values()]).includes('activation-secret'));
    assert.ok(!JSON.stringify([...records.values()]).includes('attacker'));
    assert.equal(
      (await post({ ...event(), content: { ...event().content, orderNo: 'different' } }))
        .statusCode,
      409,
    );
    for (const invalid of [
      { ...event(), notifyId: '../order' },
      { ...event(), notifyType: 'PAYMENT_SUCCEEDED' },
      { ...event(), eventGenerateTime: 'yesterday' },
      { ...event(), content: {} },
      {
        ...event('DATA_USAGE'),
        content: { orderNo: 'test', totalVolume: 100, orderUsage: 20, remain: -1 },
      },
    ])
      assert.equal((await post(invalid)).statusCode, 400);
    assert.equal(records.size, 1);
  } finally {
    await app.close();
  }
});
test('webhook does not acknowledge failed persistence and enforces body size', async () => {
  const app = await createApp({
    esimWebhook: {
      token,
      inbox: {
        async save() {
          throw new Error('database credentials must not leak');
        },
      },
    },
  });
  try {
    const failed = await app.inject({ method: 'POST', url, payload: event() });
    assert.equal(failed.statusCode, 503);
    assert.ok(!failed.body.includes('credentials'));
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url,
          payload: { ...event(), padding: 'x'.repeat(40000) },
        })
      ).statusCode,
      413,
    );
  } finally {
    await app.close();
  }
});
