import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransition,
  matchPlans,
  normalizeCountries,
  priceRetail,
  retailPlan,
  type StoredPlan,
} from '../src/index.ts';
import { demoPlans } from '../src/demo.ts';

test('itinerary matching requires every country, including Switzerland', () => {
  const plans = matchPlans(demoPlans, ['FR', 'CH', 'IT']);
  assert.ok(plans.length > 0);
  assert.ok(plans.every((p) => ['FR', 'CH', 'IT'].every((c) => p.countries.includes(c))));
  assert.ok(!plans.some((p) => p.id === 'demo-IT'));
});
test('unsupported itinerary returns no partial matches', () => {
  assert.deepEqual(matchPlans(demoPlans, ['FR', 'MD']), []);
});
test('normalizes and deduplicates country codes', () => {
  assert.deepEqual(normalizeCountries(['fr', ' FR ', 'it', '']), ['FR', 'IT']);
  assert.ok(matchPlans(demoPlans, ['fr', 'it']).length > 0);
});
test('empty and invalid itineraries do not return all plans', () => {
  assert.deepEqual(matchPlans(demoPlans, []), []);
  assert.deepEqual(matchPlans(demoPlans, ['EUROPE']), []);
});
test('data filter and value sorting apply to all matching plans', () => {
  const plans = matchPlans(demoPlans, ['FR', 'IT'], 10);
  assert.ok(plans.every((p) => p.dataGb >= 10));
  assert.ok(
    plans.every(
      (p, i) => i === 0 || plans[i - 1].priceCents / plans[i - 1].dataGb <= p.priceCents / p.dataGb,
    ),
  );
});
test('supplier units convert to cents and respect minimum margin', () => {
  assert.equal(priceRetail(58600, 1.8), 1055);
  assert.equal(priceRetail(58600, 1, 0.5), 1172);
  assert.throws(() => priceRetail(-1));
  assert.throws(() => priceRetail(58600, 1, 1));
});
test('public products exclude wholesale and supplier fields', () => {
  const stored: StoredPlan = {
    ...demoPlans[0],
    supplierCode: 'private-sku',
    wholesaleUnits: 58600,
    active: true,
  };
  const publicPlan = retailPlan(stored);
  assert.equal('wholesaleUnits' in publicPlan, false);
  assert.equal('supplierCode' in publicPlan, false);
  assert.equal('active' in publicPlan, false);
});
test('order transition rules prevent direct checkout-to-ready and refunded issuance', () => {
  assert.equal(canTransition('checkout_pending', 'ready'), false);
  assert.equal(canTransition('checkout_pending', 'paid'), true);
  assert.equal(canTransition('provision_wait', 'ready'), true);
  assert.equal(canTransition('refunded', 'fulfilling'), false);
});

test('account names accept international and compound names and reject invalid input', async () => {
  const { accountName, nameFields } = await import('../src/index.ts');
  assert.equal(accountName('  María José ', 'O’Neill-Smith '), 'María José O’Neill-Smith');
  assert.equal(accountName('李', '王'), '李 王');
  for (const value of ['', '   ', null, '<script>', 'a\u0000b', 'a'.repeat(51)])
    assert.throws(() => accountName(value, 'Smith'));
  assert.deepEqual(nameFields(null), { firstName: '', lastName: '' });
  assert.deepEqual(nameFields('Alex van der Meer'), {
    firstName: 'Alex',
    lastName: 'van der Meer',
  });
});
