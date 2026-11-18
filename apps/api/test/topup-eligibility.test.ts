import test from 'node:test';
import assert from 'node:assert/strict';
import {
  topupEligibility,
  compatibleTopup,
  topupPackageSnapshot,
  type TopupPackage,
  type TopupProfile,
} from '../src/lib/topup-eligibility.ts';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
const original: TopupPackage = {
  packageCode: 'BASE',
  name: 'Fixed data',
  price: 10000,
  currencyCode: 'USD',
  volume: 1073741824,
  duration: 7,
  durationUnit: 'DAY',
  location: 'FR,CH',
  dataType: 1,
  supportTopUpType: 2,
  speed: '4G',
  fupPolicy: null,
};
const candidate = { ...original, packageCode: 'TOPUP', slug: 'verified-slug' };
const profile: TopupProfile = {
  esimTranNo: 'profile',
  orderNo: 'supplier-order',
  iccid: '89852245280001113019',
  esimStatus: 'IN_USE',
  smdpStatus: 'DISABLED',
  expiredTime: '2027-01-01T00:00:00Z',
  packageList: [{ packageCode: 'BASE' }],
};
const input = {
  profile,
  original,
  candidates: [candidate],
  esimTranNo: 'profile',
  orderNo: 'supplier-order',
  topUpCount: 0,
  days: 7,
  now: Date.parse('2026-11-18T00:00:00Z'),
};
test('purchase snapshots preserve supplier terms and never infer missing historical speed or FUP', () => {
  const plan = {
    ...demoPlans[0],
    active: true,
    supplierCode: original.packageCode,
    wholesaleUnits: original.price,
    supplierComparison: {
      key: 'verified',
      fup: '512kbps',
      fupKbps: 512,
      topupType: 2,
      attributes: {
        dataType: 1,
        duration: 15,
        durationUnit: 'DAY',
        location: 'FR,CH',
        speed: '4G',
      },
    },
  };
  const snapshot = topupPackageSnapshot(plan);
  assert.equal(snapshot?.speed, '4G');
  assert.equal(snapshot?.fupPolicy, '512kbps');
  assert.equal(snapshot?.volume, plan.dataGb * 1024 ** 3);
  assert.equal(snapshot?.packageCode, original.packageCode);
  assert.equal(topupPackageSnapshot({ ...plan, supplierComparison: undefined }), undefined);
  assert.equal(
    topupPackageSnapshot({
      ...plan,
      supplierComparison: {
        ...plan.supplierComparison,
        attributes: { ...plan.supplierComparison.attributes, speed: undefined },
      },
    }),
    undefined,
  );
});
test('fixed top-up selects a real supplier slug and ignores disabled operational status', () => {
  assert.deepEqual(topupEligibility(input), {
    eligible: true,
    expiresAt: '2027-01-01T00:00:00.000Z',
    packageCode: 'verified-slug',
    price: 10000,
  });
});
test('profile-specific refill with no further top-up capability matches the original package', () => {
  const refill = { ...candidate, supportTopUpType: 1 };
  assert.equal(compatibleTopup(original, refill), true);
  assert.deepEqual(topupEligibility({ ...input, candidates: [refill] }), {
    eligible: true,
    expiresAt: '2027-01-01T00:00:00.000Z',
    packageCode: 'verified-slug',
    price: 10000,
  });
  assert.equal(
    topupEligibility({
      ...input,
      original: { ...original, supportTopUpType: 1 },
      candidates: [refill],
    }).eligible,
    false,
  );
});
for (const status of ['GOT_RESOURCE', 'IN_USE', 'USED_UP'])
  test(status + ' can be eligible', () =>
    assert.equal(
      topupEligibility({ ...input, profile: { ...profile, esimStatus: status } }).eligible,
      true,
    ),
  );
for (const status of ['SUSPENDED', 'REVOKE', 'CANCEL', 'UNUSED_EXPIRED', 'USED_EXPIRED', 'UNKNOWN'])
  test(status + ' fails closed', () =>
    assert.equal(
      topupEligibility({ ...input, profile: { ...profile, esimStatus: status } }).eligible,
      false,
    ),
  );
for (const expiry of [null, '', '2020-01-01T00:00:00Z', '2027-01-01', 'bad'])
  test('invalid or expired date ' + expiry, () =>
    assert.equal(
      topupEligibility({ ...input, profile: { ...profile, expiredTime: expiry } }).eligible,
      false,
    ),
  );
for (const topUpCount of [null, 9, 10, -1, 0.5])
  test('unverified or exhausted history ' + topUpCount, () =>
    assert.equal(topupEligibility({ ...input, topUpCount }).eligible, false),
  );
test('foreign profile, unknown package, deleted profile and no top-up support are rejected', () => {
  for (const patch of [
    { esimTranNo: 'foreign' },
    { orderNo: 'foreign' },
    { smdpStatus: 'DELETED' },
    { packageList: [{ packageCode: 'foreign' }] },
  ])
    assert.equal(topupEligibility({ ...input, profile: { ...profile, ...patch } }).eligible, false);
  assert.equal(
    topupEligibility({ ...input, original: { ...original, supportTopUpType: 1 } }).eligible,
    false,
  );
});
test('coverage, allowance, duration, speed, FUP and data type must match exactly', () => {
  for (const patch of [
    { location: 'FR' },
    { volume: original.volume * 2 },
    { duration: 30 },
    { speed: '5G' },
    { fupPolicy: '128kbps' },
    { dataType: 2 },
  ])
    assert.equal(compatibleTopup(original, { ...candidate, ...patch }), false);
  assert.equal(compatibleTopup(original, { ...candidate, location: 'CH,FR' }), true);
  assert.equal(topupEligibility({ ...input, candidates: [] }).eligible, false);
  assert.equal(
    topupEligibility({
      ...input,
      candidates: [candidate, { ...candidate, packageCode: 'ANOTHER' }],
    }).eligible,
    false,
  );
});
test('daily plan extends days using the exact original SKU and per-day cost', () => {
  assert.deepEqual(
    topupEligibility({
      ...input,
      original: { ...original, dataType: 2, supportTopUpType: 3, duration: 1 },
    }),
    {
      eligible: true,
      expiresAt: '2027-01-01T00:00:00.000Z',
      packageCode: 'BASE',
      periodNum: 7,
      price: 70000,
    },
  );
  for (const days of [0, 366, 1.5])
    assert.equal(
      topupEligibility({
        ...input,
        days,
        original: { ...original, dataType: 2, supportTopUpType: 3 },
      }).eligible,
      false,
    );
});
