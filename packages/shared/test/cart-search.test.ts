import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCartItems, readSearch, matchPlans, previewCartPrices } from '../src/index.ts';
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

test('search restoration normalizes countries while preserving an explicitly selected trip filter', () => {
  const restored = readSearch(new URLSearchParams('mode=trip&countries=FR,FR&trip=FR,FR'))!;
  assert.equal(restored.mode, 'trip');
  assert.equal(restored.chooseTrip, true);
  assert.deepEqual(restored.countries, ['FR']);
  assert.equal(readSearch(new URLSearchParams('utm_source=campaign')), null);
  const invalid = readSearch(new URLSearchParams('mode=trip&countries=France,xx&single=invalid'))!;
  assert.equal(invalid.mode, 'trip');
  assert.equal(invalid.chooseTrip, true);
  assert.deepEqual(invalid.countries, []);
});

test('removing trip stops preserves the filter with one or zero countries until an explicit switch', () => {
  const store = makeStore();
  store.dispatch(setCountries(['FR', 'CH']));
  store.dispatch(removeCountry('CH'));
  assert.equal(store.getState().itinerary.mode, 'trip');
  assert.equal(store.getState().itinerary.chooseTrip, true);
  assert.deepEqual(store.getState().itinerary.countries, ['FR']);
  store.dispatch(removeCountry('FR'));
  assert.deepEqual(store.getState().itinerary.countries, []);
  assert.equal(store.getState().itinerary.mode, 'trip');
  assert.equal(store.getState().itinerary.chooseTrip, true);
  store.dispatch(chooseCountry('DE'));
  assert.equal(store.getState().itinerary.mode, 'trip');
  store.dispatch(switchSearch('country'));
  assert.equal(store.getState().itinerary.mode, 'country');
  assert.deepEqual(store.getState().itinerary.countries, ['DE']);
});

test('cart merging does not mutate inputs and accepts exactly ten units', () => {
  const guest = [{ planId: 'a', quantity: 2 }];
  const account = [
    { planId: 'a', quantity: 3 },
    { planId: 'b', quantity: 5 },
  ];
  assert.deepEqual(mergeCartItems(guest, account), [
    { planId: 'a', quantity: 5 },
    { planId: 'b', quantity: 5 },
  ]);
  assert.deepEqual(guest, [{ planId: 'a', quantity: 2 }]);
  assert.deepEqual(account, [
    { planId: 'a', quantity: 3 },
    { planId: 'b', quantity: 5 },
  ]);
  for (const quantity of [0, -1, 1.5, NaN, Infinity])
    assert.throws(() => mergeCartItems([], [{ planId: 'a', quantity }]));
});

test('draft tab intent survives URL restoration without discarding a saved itinerary', () => {
  const tripDraft = readSearch(
    new URLSearchParams('mode=country&countries=FR&single=FR&trip=FR&intent=trip'),
  )!;
  assert.equal(tripDraft.chooseTrip, true);
  assert.deepEqual(tripDraft.countries, ['FR']);
  const singleDraft = readSearch(
    new URLSearchParams('mode=trip&countries=FR,CH,IT&trip=FR,CH,IT&intent=country'),
  )!;
  assert.equal(singleDraft.chooseSingle, true);
  assert.deepEqual(singleDraft.trip, ['FR', 'CH', 'IT']);
});

test('pending cart display uses the current quantity and cached price without relabelling currency', () => {
  const plan = { ...demoPlans[0], demo: false, priceCents: 500 };
  const lines = [{ plan, quantity: 3 }];
  const cached = [{ plan: { ...plan, priceCents: 600 }, quantity: 1 }];
  const preview = previewCartPrices(lines, cached, 'USD');
  assert.equal(preview.items[0].quantity, 3);
  assert.equal(preview.total, 1800);
  assert.equal(previewCartPrices(lines, cached, 'GBP').total, null);
  assert.equal(lines[0].plan.priceCents, 500);
  assert.equal(cached[0].quantity, 1);
  assert.equal(
    previewCartPrices([{ plan: { ...plan, priceCents: NaN }, quantity: 1 }], [], 'USD').total,
    null,
  );
  assert.equal(
    previewCartPrices(
      [{ plan: { ...plan, priceCents: Number.MAX_SAFE_INTEGER }, quantity: 2 }],
      [],
      'USD',
    ).total,
    null,
  );
});
