import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
import { CONTINENTS } from '../../../packages/shared/src/geography.ts';
import {
  discountedUnit,
  promotionMarginSetting,
  matchesPromotion,
  promotionMarginAllowed,
  promotionConfigHash,
} from '../src/lib/promotion-policy.ts';
import { priceExchange } from '../src/lib/exchange-rates.ts';
import {
  bannerSchema,
  campaignStatus,
  activeWindow,
  marketingUrl,
} from '../src/lib/marketing-policy.ts';
const plan = {
  ...demoPlans[0],
  id: 'internal-product',
  countries: ['FR'],
  tags: ['travel'],
  priceCents: 1200,
};
const base = { code: 'SAVE10', discountPercent: 10 };
const scope = (
  kind: 'all' | 'products' | 'destinations' | 'regions' | 'tags',
  values: string[] = [],
  excludedProducts: string[] = [],
) => ({ ...base, scope: { kind, values, excludedProducts } });
test('existing unscoped and all-product discounts remain applicable', () => {
  assert.equal(matchesPromotion(base, plan), true);
  assert.equal(matchesPromotion(scope('all'), plan), true);
  assert.equal(discountedUnit(999, base, priceExchange('USD')), 900);
});
test('internal product, multiple product, destination, tag and exclusion targeting', () => {
  for (const value of [
    scope('products', ['internal-product']),
    scope('products', ['other', 'internal-product']),
    scope('destinations', ['FR']),
    scope('tags', ['travel']),
  ])
    assert.equal(matchesPromotion(value, plan), true);
  assert.equal(matchesPromotion(scope('products', ['supplier-sku']), plan), false);
  assert.equal(matchesPromotion(scope('all', [], ['internal-product']), plan), false);
  assert.equal(
    matchesPromotion(scope('destinations', ['FR']), { ...plan, countries: ['FR', 'CH'] }),
    false,
  );
  assert.equal(
    matchesPromotion(scope('destinations', ['FR', 'CH']), { ...plan, countries: ['CH', 'FR'] }),
    true,
  );
  assert.equal(
    matchesPromotion(scope('regions', ['europe']), { ...plan, countries: [...CONTINENTS.Europe] }),
    true,
  );
});
test('monetary discounts use precise minor units, no increase, and a 50% ceiling', () => {
  assert.equal(
    discountedUnit(
      1000,
      { ...base, discount: { kind: 'fixed', value: 100 } },
      priceExchange('USD'),
    ),
    900,
  );
  assert.equal(
    discountedUnit(
      1000,
      { ...base, discount: { kind: 'price', value: 600 } },
      priceExchange('USD'),
    ),
    600,
  );
  assert.equal(
    discountedUnit(
      1000,
      { ...base, discount: { kind: 'fixed', value: 100 } },
      { source: 'test', asOf: '', fetchedAt: '', numerator: '11', denominator: '10' },
    ),
    890,
  );
  for (const value of [1, 1100])
    assert.throws(() =>
      discountedUnit(1000, { ...base, discount: { kind: 'price', value } }, priceExchange('USD')),
    );
});
test('supplier offer replacement leaves targets and prices unchanged but rechecks the new cost', () => {
  const p = scope('products', ['internal-product']);
  const first = { ...plan, providerId: 'esim-access', supplierCode: 'first-offer' };
  const second = { ...plan, providerId: 'telna', supplierCode: 'second-offer' };
  assert.equal(matchesPromotion(p, first), matchesPromotion(p, second));
  assert.equal(
    discountedUnit(first.priceCents, p, priceExchange('USD')),
    discountedUnit(second.priceCents, p, priceExchange('USD')),
  );
  assert.equal(promotionMarginAllowed(1080, 'USD', 1000, priceExchange('USD')), true);
  assert.equal(promotionMarginAllowed(1080, 'USD', 300000, priceExchange('USD')), false);
  assert.notEqual(
    promotionConfigHash(p),
    promotionConfigHash({ ...p, scope: { ...p.scope, excludedProducts: ['internal-product'] } }),
  );
});
const now = Date.parse('2026-11-18T00:00:00Z');
const banner = {
  id: 'offer',
  name: 'Offer',
  active: true,
  startsAt: '2026-11-17T00:00:00Z',
  expiresAt: '2026-11-19T00:00:00Z',
  placement: 'announcement',
  translations: {
    en: { heading: 'Offer', ctaLabel: 'Explore' },
    ro: { heading: 'Ofertă', ctaLabel: 'Descoperă' },
  },
  ctaUrl: '/destinations',
};
test('banner schedules, status, multilingual fallback configuration and colour contrast are validated', () => {
  const b = bannerSchema.parse(banner);
  assert.equal(activeWindow(b, now), true);
  assert.equal(campaignStatus(b, now), 'active');
  assert.equal(campaignStatus({ ...b, active: false }, now), 'paused');
  assert.equal(campaignStatus({ ...b, startsAt: '2026-11-18T01:00:00Z' }, now), 'scheduled');
  assert.equal(activeWindow({ ...b, expiresAt: '2026-11-18T00:00:00Z' }, now), false);
  assert.equal(
    bannerSchema.safeParse({ ...banner, background: '#FFFFFF', foreground: '#FFFFFF' }).success,
    false,
  );
  assert.equal(
    bannerSchema.safeParse({ ...banner, translations: { ro: { heading: 'Ofertă' } } }).success,
    false,
  );
  assert.equal(bannerSchema.safeParse({ ...banner, dismissible: true }).success, false);
});
test('unsafe and ambiguous CTA URLs are rejected', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,bad',
    '//external.example',
    'http://insecure.example',
    '/\\external.example',
    'relative/path',
  ])
    assert.equal(marketingUrl.safeParse(value).success, false, value);
  for (const value of ['/destinations?countries=FR', 'https://example.com/offers'])
    assert.equal(marketingUrl.safeParse(value).success, true);
});

test('promotion margin permits deliberate losses and supports negative settings independently of retail targets', () => {
  assert.equal(promotionMarginSetting.parse('-10000'), -10000);
  for (const value of ['-10001', '10000', '-1.5', 'bad', ''])
    assert.equal(promotionMarginSetting.safeParse(value).success, false);
  assert.equal(promotionMarginAllowed(75, 'USD', 4700, priceExchange('USD')), true);
  assert.equal(promotionMarginAllowed(75, 'USD', 4700, priceExchange('USD'), 0), false);
  assert.equal(promotionMarginAllowed(75, 'USD', 4700, priceExchange('USD'), -1000), true);
  assert.equal(promotionMarginAllowed(49, 'USD', 1000, priceExchange('USD')), false);
  assert.equal(promotionMarginAllowed(75, 'USD', 20000, priceExchange('USD')), false);
});

test('minus 20 percent promotion floor includes supplier costs and estimated payment fees', () => {
  // USD 1 sale: supplier USD 0.84 + estimated fee USD 0.36 => -USD 0.20.
  assert.equal(promotionMarginSetting.parse('-2000'), -2000);
  assert.equal(promotionMarginAllowed(100, 'USD', 8400, priceExchange('USD')), true);
  // Supplier 0.8401 rounds up to 0.85, so net contribution is -0.21: reject.
  assert.equal(promotionMarginAllowed(100, 'USD', 8401, priceExchange('USD')), false);
  // A setting override cannot accidentally retain the earlier -100% default.
  assert.equal(promotionMarginAllowed(100, 'USD', 10000, priceExchange('USD')), false);
});
