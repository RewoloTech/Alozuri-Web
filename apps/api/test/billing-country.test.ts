import test from 'node:test';
import assert from 'node:assert/strict';
import { billingCountryCode } from '../src/lib/billing-country.ts';
test('billing country accepts country codes only and never guesses from currency or destination', () => {
  assert.equal(billingCountryCode(' gb '), 'GB');
  assert.equal(billingCountryCode('US'), 'US');
  for (const value of [null, undefined, '', 'GBP', 'United Kingdom', 'ZZ', 'XX', { country: 'GB' }])
    assert.equal(billingCountryCode(value), null);
});
