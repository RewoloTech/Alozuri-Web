import test from 'node:test';
import assert from 'node:assert/strict';
import { matchPlans, dataLabel, allowanceFilter, type Plan } from '../src/index.ts';
import { demoPlans } from '../src/demo.ts';
const base = { ...demoPlans[0], countries: ['FR', 'CH', 'IT'], demo: false };
const plans: Plan[] = [
  { ...base, id: '20', dataGb: 20, dataType: 'fixed' },
  { ...base, id: '50', dataGb: 50, dataType: 'fixed' },
  { ...base, id: '100', dataGb: 100, dataType: 'fixed' },
  { ...base, id: 'daily', dataGb: 2, dataType: 'daily', dailyPolicy: 'reduced' },
  { ...base, id: 'cutoff', dataGb: 3, dataType: 'daily', dailyPolicy: 'cutoff' },
  { ...base, id: 'unlimited', dataGb: 999, dataType: 'unlimited' },
  { ...base, id: 'partial', countries: ['FR', 'IT'], dataType: 'unlimited' },
];
test('50 GB filter includes larger fixed packages without treating daily or unlimited limits as total GB', () => {
  const f = allowanceFilter('50');
  assert.deepEqual(
    new Set(matchPlans(plans, ['FR', 'CH', 'IT'], f.minGb, f.dataType).map((p) => p.id)),
    new Set(['50', '100']),
  );
});
test('unlimited filter includes speed-reduced daily plans, excludes cutoff plans and checks every country', () => {
  assert.deepEqual(
    new Set(matchPlans(plans, ['FR', 'CH', 'IT'], 0, 'unlimited').map((p) => p.id)),
    new Set(['daily', 'unlimited']),
  );
  assert.equal(matchPlans(plans, ['FR', 'CH', 'IT'], 0, 'daily').length, 2);
  assert.equal(matchPlans(plans, ['FR', 'CH', 'IT']).length, 6);
  assert.equal(matchPlans(plans, ['ZZ'], 0, 'unlimited').length, 0);
});
test('allowance labels distinguish total GB, per-day high-speed limits and unlimited data', () => {
  assert.equal(dataLabel(plans[1]), '50 GB');
  assert.equal(dataLabel({ ...plans[0], dataGb: 500 / 1024 }), '500 MB');
  assert.equal(dataLabel(plans[3]), 'Unlimited · 2 GB/day high-speed');
  assert.equal(dataLabel(plans[4]), '3 GB/day');
  assert.equal(dataLabel(plans[5]), 'Unlimited');
});
