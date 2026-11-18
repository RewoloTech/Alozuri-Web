import assert from 'node:assert/strict';
import test from 'node:test';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
import { configSchema } from '../../../packages/shared/src/pricing-management.ts';
import { pricingScope, resolvePricing, readRules } from '../src/lib/pricing-rules.js';
import { calculatePricing, profitable, contributionAtRetail } from '../src/lib/pricing.js';
import { pricePackage, validPackagePricing } from '../src/lib/package-pricing.js';
import { cataloguePlan } from '../src/lib/repository.js';
import { priceCart } from '../src/lib/commerce.js';
const plan = {
  ...demoPlans[0],
  id: 'local',
  name: 'Nigeria 1GB',
  countries: ['NG'],
  active: true,
  demo: false,
  wholesaleUnits: 50000,
  supplierCode: 'local',
  syncedAt: new Date().toISOString(),
};
const assign = (profile: string) => ({ profile, settings: {}, active: true });
test('local, named regional, exact coverage, global and disabled rules resolve independently', () => {
  const snapshot = readRules(undefined),
    c = snapshot.config;
  const fresh = { ...plan, id: 'future' };
  assert.equal(resolvePricing(plan, snapshot), null);
  c.countries.NG = assign('competitive');
  assert.equal(resolvePricing(fresh, snapshot)?.profile, 'competitive');
  const regional = { ...plan, name: 'Africa (2 areas) 1GB', countries: ['NG', 'CI'] };
  assert.equal(resolvePricing(regional, snapshot), null);
  c.regions.africa = assign('standard');
  assert.equal(resolvePricing({ ...regional, name: 'Africa & Asia 1GB' }, snapshot), null);
  const key = pricingScope(regional).bundle!;
  c.regions[key] = assign('aggressive');
  assert.equal(
    resolvePricing({ ...regional, countries: ['CI', 'NG'] }, snapshot)?.profile,
    'aggressive',
  );
  assert.equal(
    resolvePricing({ ...regional, countries: ['NG', 'ZA'] }, snapshot)?.profile,
    'standard',
  );
  c.regions[key].active = false;
  assert.equal(resolvePricing(regional, snapshot)?.scope, 'africa');
  assert.equal(resolvePricing({ ...regional, name: 'Unclassified product' }, snapshot), null);
  assert.equal(resolvePricing({ ...regional, name: 'Global 1GB' }, snapshot), null);
  c.countries.NG.active = false;
  assert.equal(resolvePricing(plan, snapshot), null);
  assert.equal(
    configSchema.safeParse({ ...c, countries: { ZZ: assign('standard') } }).success,
    false,
  );
});
test('benchmark can sacrifice target, floors survive fee rounding, target miss remains measurable', () => {
  const settings = {
    targetCents: 345,
    minimumContributionCents: 50,
    minimumContributionBps: 800,
    undercutBps: 500,
  };
  const ordinary = calculatePricing(50000, settings);
  const undercut = calculatePricing(50000, { ...settings, benchmarkUsd: 800 });
  assert.ok(undercut.price < ordinary.price);
  assert.ok(contributionAtRetail(50000, undercut.price).contribution < 345);
  assert.equal(undercut.competitorTarget, 760);
  const low = calculatePricing(50000, { ...settings, benchmarkUsd: 400 });
  assert.ok(low.minimum > low.competitorTarget!);
  for (let units = 1; units < 150000; units += 93) {
    const calc = calculatePricing(units, {
      ...settings,
      minimumContributionBps: 5000,
      benchmarkUsd: 100,
    });
    assert.ok(profitable(units, calc.price, { ...settings, minimumContributionBps: 5000 }));
    assert.equal(calc.price % 50, 49);
  }
});
test('fixed packages require a cost-bound approval below floors, negative contributions never qualify', async () => {
  const snap = readRules(undefined);
  snap.config.countries.NG = assign('competitive');
  snap.config.packages.local = {
    active: true,
    mode: 'fixed',
    fixedCents: 570,
    approvedCostUnits: null,
    settings: {},
  };
  const priced = (units = 50000) =>
    pricePackage(
      { ...plan, wholesaleUnits: units },
      {},
      undefined,
      false,
      resolvePricing(plan, snap),
    );
  assert.equal(priced().active, false);
  snap.config.packages.local.approvedCostUnits = 50000;
  assert.equal(priced().priceCents, 570);
  assert.ok(validPackagePricing(priced()));
  assert.equal(priced(50100).active, false);
  snap.config.packages.local.fixedCents = 510;
  assert.equal(priced().active, false);
  snap.config.packages.local.active = false;
  assert.ok(priced().priceCents > 570);
  const p = priced(),
    quote = await priceCart([{ planId: p.id, quantity: 2 }], async () => p);
  assert.equal(quote.quote.totalCents, p.priceCents * 2);
  assert.equal('managedPricing' in cataloguePlan(p)!, false);
  assert.equal('managedPricing' in quote.quote.items[0].plan, false);
  assert.equal(validPackagePricing({ ...p, priceCents: 100, sellingPriceUsdCents: 100 }), false);
  const gbp = await priceCart([{ planId: p.id, quantity: 1 }], async () => p, 'GBP', {
    source: 'frankfurter-ecb',
    asOf: '2026-01-01',
    fetchedAt: '2026-01-01T00:00:00Z',
    numerator: '3',
    denominator: '4',
  });
  assert.equal(gbp.snapshots[0].baseSellingPriceUsdCents, p.priceCents);
  assert.equal(gbp.quote.currency, 'GBP');
});

test('verified promotions keep their independent contribution threshold on a managed base price', async () => {
  const { promotionMarginAllowed } = await import('../src/lib/promotion-policy.js');
  const { priceExchange } = await import('../src/lib/exchange-rates.js');
  const config = readRules(undefined);
  config.config.countries.NG = assign('competitive');
  const p = pricePackage(plan, {}, undefined, false, resolvePricing(plan, config));
  const discounted = p.priceCents - Math.floor((p.priceCents * 20) / 100);
  assert.equal(profitable(p.wholesaleUnits, discounted, p.managedPricing), false);
  assert.equal(
    promotionMarginAllowed(discounted, 'USD', p.wholesaleUnits, priceExchange('USD'), -2000),
    true,
  );
});
