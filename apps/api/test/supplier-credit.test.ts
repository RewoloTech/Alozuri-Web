import test from 'node:test';
import assert from 'node:assert/strict';
import { creditUnits, supplierCreditInput } from '../src/lib/supplier-credit.ts';
test('supplier credits preserve four decimal USD units without floating point rounding', () => {
  assert.equal(creditUnits('0.5400'), 5400);
  assert.equal(creditUnits('0.0001'), 1);
  assert.equal(creditUnits('12.34'), 123400);
  assert.equal(creditUnits('0'), 0);
  for (const amount of ['-1', '1e3', '1.12345', 'NaN', 'Infinity', ''])
    assert.throws(() => creditUnits(amount));
});
test('supplier credit input requires evidence, concurrency version and idempotency', () => {
  const input = {
    amountUsd: '0.54',
    reference: 'supplier-statement-1',
    expectedVersion: 0,
    requestId: crypto.randomUUID(),
  };
  assert.ok(supplierCreditInput.safeParse(input).success);
  for (const extra of [
    { reference: '' },
    { expectedVersion: -1 },
    { currency: 'GBP' },
    { amountUnits: 999 },
  ])
    assert.equal(supplierCreditInput.safeParse({ ...input, ...extra }).success, false);
});
