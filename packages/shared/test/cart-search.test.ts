import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCartItems, readSearch, matchPlans } from '../src/index.ts';
import { demoPlans } from '../src/demo.ts';
import {
  makeStore,
  setCountries,
  switchSearch,
  chooseCountry,
  removeCountry,
  addToCart,
  quantityChanged,
  removeFromCart,
} from '../../../apps/web/src/lib/store.ts';
test('single and multi-country states preserve the itinerary and require an explicit single choice', () => {
  const s = makeStore();
  s.dispatch(chooseCountry('FR'));
  assert.equal(s.getState().itinerary.mode, 'country');
  s.dispatch(switchSearch('trip'));
  s.dispatch(chooseCountry('CH'));
  s.dispatch(chooseCountry('IT'));
  assert.deepEqual(s.getState().itinerary.countries, ['FR', 'CH', 'IT']);
  s.dispatch(switchSearch('country'));
  assert.equal(s.getState().itinerary.chooseSingle, true);
  assert.equal(s.getState().itinerary.mode, 'trip');
  s.dispatch(chooseCountry('FR'));
  assert.deepEqual(s.getState().itinerary.countries, ['FR']);
  s.dispatch(switchSearch('trip'));
  assert.deepEqual(s.getState().itinerary.countries, ['FR', 'CH', 'IT']);
  s.dispatch(removeCountry('CH'));
  assert.deepEqual(s.getState().itinerary.countries, ['FR', 'IT']);
  s.dispatch(setCountries(['FR', 'CH', 'IT']));
  assert.equal(s.getState().itinerary.mode, 'trip');
  const restored = readSearch(
    new URLSearchParams('mode=country&countries=FR,CH,IT&single=FR&trip=FR,CH,IT'),
  )!;
  assert.equal(restored.mode, 'trip');
  assert.deepEqual(restored.countries, ['FR', 'CH', 'IT']);
  assert.ok(
    matchPlans(demoPlans, ['FR', 'CH', 'IT']).every((p) =>
      ['FR', 'CH', 'IT'].every((c) => p.countries.includes(c)),
    ),
  );
});
test('cart aggregates products and enforces quantity and demonstration-product limits', () => {
  const s = makeStore(),
    p = { ...demoPlans[0], demo: false };
  s.dispatch(addToCart(demoPlans[0]));
  assert.equal(s.getState().cart.items.length, 0);
  s.dispatch(addToCart(p));
  s.dispatch(addToCart(p));
  assert.equal(s.getState().cart.items[0].quantity, 2);
  s.dispatch(quantityChanged({ id: p.id, quantity: 6 }));
  assert.equal(s.getState().cart.items[0].quantity, 2);
  s.dispatch(removeFromCart(p.id));
  assert.equal(s.getState().cart.items.length, 0);
  assert.deepEqual(mergeCartItems([{ planId: 'a', quantity: 1 }], [{ planId: 'a', quantity: 2 }]), [
    { planId: 'a', quantity: 3 },
  ]);
  assert.throws(() =>
    mergeCartItems([{ planId: 'a', quantity: 5 }], [{ planId: 'a', quantity: 1 }]),
  );
  assert.throws(() =>
    mergeCartItems(
      [],
      [
        { planId: 'a', quantity: 5 },
        { planId: 'b', quantity: 5 },
        { planId: 'c', quantity: 1 },
      ],
    ),
  );
});
