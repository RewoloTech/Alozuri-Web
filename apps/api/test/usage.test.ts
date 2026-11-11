import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSupplierUsage } from '../src/lib/usage-data.ts';
import { SupplierClient } from '../src/lib/supplier.ts';
const reference = {
  orderNo: 'supplier-order',
  esimTranNo: 'supplier-profile',
  packageCode: 'FR_5_30',
};
const gb = 1073741824;
const profile = {
  ...reference,
  packageList: [{ packageCode: reference.packageCode }],
  dataType: 1,
  totalVolume: 5 * gb,
  orderUsage: 2 * gb,
  esimStatus: 'IN_USE',
  expiredTime: '2026-12-01T12:00:00+0000',
  ac: 'PRIVATE-ACTIVATION',
  iccid: 'PRIVATE-ICCID',
  qrCodeUrl: 'PRIVATE-QR',
};
test('fixed-data usage uses supplier bytes and strips credentials and supplier identifiers', () => {
  const value = parseSupplierUsage({ esimList: [profile] }, reference, 'fixed');
  assert.equal(value?.remainingBytes, 3 * gb);
  assert.equal(value?.usedBytes, 2 * gb);
  assert.equal(value?.expiresAt, '2026-12-01T12:00:00.000Z');
  assert.ok(!JSON.stringify(value).includes('PRIVATE'));
  assert.ok(!JSON.stringify(value).includes('supplier-profile'));
});
test('usage absence stays unknown, explicit zero stays zero and overages cannot produce negative remaining data', () => {
  const absent = parseSupplierUsage(
    { esimList: [{ ...profile, orderUsage: null, totalVolume: null, expiredTime: null }] },
    reference,
    'fixed',
  );
  assert.equal(absent?.usedBytes, null);
  assert.equal(absent?.remainingBytes, null);
  assert.equal(
    parseSupplierUsage({ esimList: [{ ...profile, orderUsage: 0 }] }, reference, 'fixed')
      ?.remainingBytes,
    5 * gb,
  );
  assert.equal(
    parseSupplierUsage({ esimList: [{ ...profile, orderUsage: 6 * gb }] }, reference, 'fixed')
      ?.remainingBytes,
    0,
  );
  assert.equal(parseSupplierUsage({ esimList: [] }, reference, 'fixed'), null);
});
test('daily and unlimited profiles never invent a remaining high-speed balance', () => {
  for (const [dataType, kind] of [
    [2, 'daily'],
    [3, 'daily'],
    [4, 'unlimited'],
    [1, 'unlimited'],
  ] as const) {
    const value = parseSupplierUsage({ esimList: [{ ...profile, dataType }] }, reference, kind);
    assert.equal(value?.usedBytes, 2 * gb);
    assert.equal(value?.totalBytes, null);
    assert.equal(value?.remainingBytes, null);
  }
});
test('mismatched identities, multiple profiles, malformed counters, dates and plan types are rejected', () => {
  for (const patch of [
    { orderNo: 'other' },
    { esimTranNo: 'other' },
    { packageList: [{ packageCode: 'other' }] },
    { orderUsage: -1 },
    { orderUsage: 1.5 },
    { totalVolume: Number.MAX_SAFE_INTEGER + 1 },
    { expiredTime: 'yesterday' },
    { dataType: 4 },
  ])
    assert.throws(() =>
      parseSupplierUsage({ esimList: [{ ...profile, ...patch }] }, reference, 'fixed'),
    );
  assert.throws(() => parseSupplierUsage({ esimList: [profile, profile] }, reference, 'fixed'));
});
test('supplier usage requests only the documented read endpoint and verifies the exact profile', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://api.esimaccess.com/api/v1/open/esim/query');
    assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), {
      orderNo: reference.orderNo,
      esimTranNo: reference.esimTranNo,
      pager: { pageNum: 1, pageSize: 5 },
    });
    return Response.json({ success: true, obj: { esimList: [profile] } });
  };
  try {
    const result = await new SupplierClient('test-access', 'test-secret').usage(
      reference.orderNo,
      reference.esimTranNo,
      reference.packageCode,
      'fixed',
    );
    assert.equal(result?.remainingBytes, 3 * gb);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previous;
  }
});
