import test from 'node:test';
import assert from 'node:assert/strict';
import { SupplierClient } from '../src/lib/supplier.ts';

test('top-up signs the documented endpoint, sends exact SKU and days, and never retries a timeout', async () => {
  const previous = globalThis.fetch;
  const flag = process.env.BUY_AGAIN_ENABLED;
  delete process.env.BUY_AGAIN_ENABLED;
  const requests: { url: string; input: Record<string, unknown> }[] = [];
  globalThis.fetch = async (url, init) => {
    const input = JSON.parse(String(init?.body));
    requests.push({ url: String(url), input });
    assert.ok(new Headers(init?.headers).get('RT-Signature'));
    return Response.json({
      success: true,
      obj: {
        transactionId: input.transactionId,
        iccid: '89852245280001113019',
        expiredTime: '2030-01-01T00:00:00Z',
        topUpEsimTranNo: 'topup-reference',
      },
    });
  };
  try {
    const client = new SupplierClient('synthetic-access', 'synthetic-secret');
    await client.topup({
      esimTranNo: 'profile',
      packageCode: 'ORIGINAL_DAILY_SKU',
      transactionId: 'internal-order',
      amount: 10000,
      periodNum: 7,
    });
    assert.equal(requests[0].url, 'https://api.esimaccess.com/api/v1/open/esim/topup');
    assert.deepEqual(requests[0].input, {
      esimTranNo: 'profile',
      packageCode: 'ORIGINAL_DAILY_SKU',
      transactionId: 'internal-order',
      amount: '10000',
      periodNum: '7',
    });
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error('Synthetic timeout');
    };
    await assert.rejects(
      client.topup({
        esimTranNo: 'profile',
        packageCode: 'REAL_SKU',
        transactionId: 'internal-order-2',
        amount: 10000,
      }),
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previous;
    if (flag === undefined) delete process.env.BUY_AGAIN_ENABLED;
    else process.env.BUY_AGAIN_ENABLED = flag;
  }
});
