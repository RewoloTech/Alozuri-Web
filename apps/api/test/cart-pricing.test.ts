import test from 'node:test';
import assert from 'node:assert/strict';
import { cartView, itemsSchema, priceCart, checkSupplierCapacity } from '../src/lib/commerce.js';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
import type { StoredPlan } from '../../../packages/shared/src/index.ts';
import type { Repository } from '../src/lib/repository.js';

const plan: StoredPlan = {
  ...demoPlans[0],
  id: 'verified-plan',
  demo: false,
  active: true,
  priceCents: 1234,
  supplierCode: 'supplier-variant-42',
  wholesaleUnits: 31000,
};
const repository = (plans: StoredPlan[]): Repository => ({
  plans: async () => plans,
  orders: async () => [],
  order: async () => null,
});

test('cart pricing aggregates duplicate variants and calculates the exact server total in minor units', async () => {
  const second = { ...plan, id: 'second-plan', priceCents: 999 };
  const loaded: string[] = [];
  const result = await priceCart(
    [
      { planId: plan.id, quantity: 1 },
      { planId: plan.id, quantity: 2 },
      { planId: second.id, quantity: 2 },
    ],
    async (id) => {
      loaded.push(id);
      return id === plan.id ? plan : second;
    },
  );
  assert.deepEqual(loaded, [plan.id, second.id]);
  assert.equal(result.quote.subtotalCents, 5700);
  assert.equal(result.quote.totalCents, 5700);
  assert.equal(result.quote.currency, 'USD');
  assert.equal(result.quote.items[0].quantity, 3);
  assert.equal(result.snapshots[0].supplierCode, plan.supplierCode);
  assert.equal(result.snapshots[0].wholesaleUnits, plan.wholesaleUnits);
  assert.equal('supplierCode' in result.quote.items[0].plan, false);
  assert.equal('wholesaleUnits' in result.quote.items[0].plan, false);
});

for (const [reason, change] of [
  ['demonstration product', { demo: true }],
  ['inactive product', { active: false }],
  ['below Stripe minimum', { priceCents: 49 }],
  ['fractional cents', { priceCents: 1234.5 }],
  ['missing supplier variant', { supplierCode: '' }],
  ['invalid wholesale cost', { wholesaleUnits: 0 }],
] as const) {
  test('cart pricing refuses ' + reason, async () => {
    await assert.rejects(
      priceCart([{ planId: plan.id, quantity: 1 }], async () => ({ ...plan, ...change })),
      /unavailable/,
    );
  });
}

test('empty and invalid carts never reach product loading', async () => {
  let loads = 0;
  const load = async () => {
    loads++;
    return plan;
  };
  await assert.rejects(priceCart([], load), /empty/);
  for (const items of [
    [{ planId: '../private', quantity: 1 }],
    [{ planId: plan.id, quantity: 0 }],
    [{ planId: plan.id, quantity: 1.5 }],
    [{ planId: plan.id, quantity: 6 }],
    [
      { planId: plan.id, quantity: 3 },
      { planId: plan.id, quantity: 3 },
    ],
    [
      { planId: 'a', quantity: 5 },
      { planId: 'b', quantity: 5 },
      { planId: 'c', quantity: 1 },
    ],
  ])
    await assert.rejects(priceCart(items, load));
  assert.equal(loads, 0);
  assert.equal(
    itemsSchema.safeParse([{ planId: plan.id, quantity: 1, priceCents: 1 }]).success,
    false,
  );
});

test('cart pricing rejects amounts exceeding the supported charge limit', async () => {
  await assert.rejects(
    priceCart([{ planId: plan.id, quantity: 2 }], async () => ({ ...plan, priceCents: 50000000 })),
    /outside/,
  );
});

test('unavailable cart items retain a validated snapshot so customers can remove them', async () => {
  const items = [{ planId: plan.id, quantity: 2 }];
  const result = await cartView(repository([]), items, { [plan.id]: plan });
  assert.equal(result[0].unavailable, true);
  assert.equal(result[0].quantity, 2);
  assert.equal(result[0].plan.name, plan.name);
  assert.equal('supplierCode' in result[0].plan, false);
  await assert.rejects(
    cartView(repository([]), items, { [plan.id]: { name: 'corrupt' } }),
    /no longer available/,
  );
  await assert.rejects(
    cartView(repository([{ ...plan, demo: true }]), items),
    /no longer available/,
  );
});

test('available cart items use the current catalogue rather than a cached price', async () => {
  const result = await cartView(repository([plan]), [{ planId: plan.id, quantity: 1 }], {
    [plan.id]: { ...plan, priceCents: 1 },
  });
  assert.equal(result[0].plan.priceCents, 1234);
  assert.equal(result[0].unavailable, undefined);
});

test('supplier balance must cover every purchased unit before a live payment can start', async () => {
  const items = [
    { wholesaleUnits: 1000, quantity: 2 },
    { wholesaleUnits: 500, quantity: 3 },
  ];
  await assert.rejects(
    checkSupplierCapacity(items, async () => 0),
    /temporarily unavailable/,
  );
  await assert.rejects(
    checkSupplierCapacity(items, async () => 3499),
    /temporarily unavailable/,
  );
  await checkSupplierCapacity(items, async () => 3500);
  await assert.rejects(
    checkSupplierCapacity(items, async () => {
      throw new Error('private provider detail');
    }),
    /Purchases are temporarily unavailable/,
  );
});
