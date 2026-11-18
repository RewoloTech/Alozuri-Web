import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
import { productServiceHash, resolveCanonicalProducts } from '../src/lib/canonical-products.ts';
import {
  discountedUnit,
  matchesPromotion,
  promotionMarginAllowed,
} from '../src/lib/promotion-policy.ts';
import { priceExchange } from '../src/lib/exchange-rates.ts';
const original = {
  ...demoPlans[0],
  id: 'offer-a',
  countries: ['FR'],
  wholesaleUnits: 1000,
  supplierCode: 'SKU_A',
  providerId: 'provider-a',
  active: true,
  supplierComparison: {
    key: 'verified-service',
    fup: 'Fixed allowance',
    fupKbps: null,
    topupType: 2,
    attributes: { speed: '4G', dataOnly: true },
  },
};
const serviceHash = productServiceHash(original);
const mappings = [
  { providerId: 'provider-a', adapterProductId: 'offer-a', serviceHash, selected: true },
  { providerId: 'provider-b', adapterProductId: 'offer-b', serviceHash, selected: false },
];
test('supplier mappings preserve canonical ID, targeting and pricing across equivalent offers', () => {
  const product = { id: 'internal-immutable', data: { productOffers: mappings } };
  assert.equal(resolveCanonicalProducts('provider-a', [original], [product])[0].id, product.id);
  const replacement = {
    ...original,
    id: 'offer-b',
    supplierCode: 'SKU_B',
    providerId: 'provider-b',
    wholesaleUnits: 1100,
  };
  const switched = {
    ...product,
    data: {
      productOffers: mappings.map((o) => ({ ...o, selected: o.providerId === 'provider-b' })),
    },
  };
  assert.equal(resolveCanonicalProducts('provider-a', [original], [switched]).length, 0);
  const next = resolveCanonicalProducts('provider-b', [replacement], [switched])[0];
  assert.equal(next.id, product.id);
  const promo = {
    code: 'SAVE10',
    discountPercent: 10,
    scope: { kind: 'products' as const, values: [product.id], excludedProducts: [] },
  };
  assert.equal(matchesPromotion(promo, next), true);
  assert.equal(
    discountedUnit(next.priceCents, promo, priceExchange('USD')),
    discountedUnit(original.priceCents, promo, priceExchange('USD')),
  );
  assert.equal(
    promotionMarginAllowed(1000, 'USD', next.wholesaleUnits, priceExchange('USD')),
    true,
  );
  assert.equal(promotionMarginAllowed(1000, 'USD', 100000, priceExchange('USD')), true);
});
test('mapping rejects changed coverage, allowance, validity, speed or unknown service characteristics', () => {
  const products = [{ id: 'canonical', data: { productOffers: mappings } }];
  for (const change of [
    { countries: ['CH'] },
    { dataGb: 999 },
    { days: 99 },
    { supplierComparison: { ...original.supplierComparison, attributes: { speed: '3G' } } },
    { supplierComparison: undefined },
  ])
    assert.throws(() =>
      resolveCanonicalProducts('provider-a', [{ ...original, ...change }], products),
    );
  assert.throws(() =>
    resolveCanonicalProducts(
      'provider-a',
      [original],
      [...products, { id: 'duplicate', data: { productOffers: mappings } }],
    ),
  );
});
