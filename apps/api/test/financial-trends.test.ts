import test from 'node:test';
import assert from 'node:assert/strict';
import { financialTrends } from '../src/lib/financial-trends.ts';
import { initialFinancial, calculateFinancial } from '../src/lib/financial-calculations.ts';
function row(at: string, name = 'United Kingdom', quantity = 1) {
  const r = initialFinancial(
    'fixture',
    'purchases',
    {
      uid: null,
      test: false,
      status: 'paid',
      paidAt: at,
      createdAt: at,
      currency: 'GBP',
      totalCents: 1000 * quantity,
      items: [
        {
          quantity,
          wholesaleUnits: 10000,
          plan: { name, countries: ['GB'], priceCents: 1000, currency: 'GBP' },
        },
      ],
    },
    { numerator: '8', denominator: '10', source: 'fixture', asOf: at },
  );
  r.selling.refundedMinor = 0;
  r.stripe.observedAt = at;
  r.stripe.revenueGbp = 1000 * quantity;
  r.stripe.feesGbp = 30;
  r.supplier.purchasedUnits = 10000 * quantity;
  r.supplier.verifiedUnits = 10000 * quantity;
  return calculateFinancial(r);
}
test('all paid rows contribute despite pagination; calendar days are filled and unpaid rows excluded', () => {
  const rows = Array.from({ length: 31 }, () => row('2026-11-12T12:00:00Z', 'UK', 2));
  const unpaid = row('2026-11-13T12:00:00Z');
  unpaid.paid = false;
  const result = financialTrends([...rows, unpaid], '2026-11-01', '2026-11-30');
  assert.equal(result.points.length, 30);
  assert.equal(result.points[11].orders, 31);
  assert.equal(result.points[11].revenueGbp, 62000);
  assert.equal(
    result.points[11].profitGbp,
    rows.reduce((n, r) => n + (r.profitGbp ?? 0), 0),
  );
  assert.equal(result.points[12].orders, 0);
  assert.equal(result.points[12].profitGbp, 0);
  assert.equal(result.topPlans[0].quantity, 62);
});
test('refunds and negative profit remain in the original order cohort; quantities are explicitly gross', () => {
  const r = row('2026-11-12T12:00:00Z', 'UK', 2);
  r.selling.refundedMinor = 2000;
  r.stripe.revenueGbp = 0;
  const result = financialTrends([calculateFinancial(r)], '2026-11-12', '2026-11-12');
  assert.equal(result.points[0].revenueGbp, 0);
  assert.equal(result.points[0].profitGbp, -190);
  assert.equal(result.topPlans[0].quantity, 2);
});
test('unknown values are never zero-filled and quoted profits remain provisional', () => {
  const known = row('2026-11-12T12:00:00Z');
  const missing = row('2026-11-12T12:00:00Z');
  missing.stripe.observedAt = null;
  missing.stripe.revenueGbp = null;
  missing.stripe.feesGbp = null;
  const result = financialTrends([known, calculateFinancial(missing)], '2026-11-12', '2026-11-12');
  assert.equal(result.points[0].revenueGbp, null);
  assert.equal(result.points[0].profitGbp, null);
  assert.equal(result.points[0].revenueProvisional, true);
  assert.equal(result.points[0].profitProvisional, true);
  const quoted = row('2026-11-12T12:00:00Z');
  quoted.supplier.verifiedUnits = null;
  const estimate = financialTrends([calculateFinancial(quoted)], '2026-11-12', '2026-11-12');
  assert.equal(estimate.points[0].profitGbp, 890);
  assert.equal(estimate.points[0].profitProvisional, true);
  assert.equal(estimate.points[0].revenueProvisional, false);
});
test('London dates handle summer midnight and both DST transitions without shifting cohorts', () => {
  const summer = row('2026-07-01T23:30:00Z');
  assert.equal(financialTrends([summer], '2026-07-02', '2026-07-02').points[0].orders, 1);
  assert.equal(financialTrends([summer], '2026-07-01', '2026-07-01').points[0].orders, 0);
  for (const at of [
    '2026-03-29T00:30:00Z',
    '2026-03-29T01:30:00Z',
    '2026-10-25T00:30:00Z',
    '2026-10-25T01:30:00Z',
  ])
    assert.equal(financialTrends([row(at)], at.slice(0, 10), at.slice(0, 10)).points[0].orders, 1);
});
test('long ranges use bounded weekly/monthly/yearly buckets; top plans group stable recorded coverage', () => {
  assert.equal(financialTrends([], '2026-01-01', '2026-05-01').grain, 'week');
  assert.equal(financialTrends([], '2025-01-01', '2026-12-31').grain, 'month');
  const long = financialTrends([], '1900-01-01', '2500-12-31');
  assert.equal(long.grain, 'year');
  assert.ok(long.points.length <= 120);
  const plans = Array.from({ length: 10 }, (_, i) => row('2026-11-12T12:00:00Z', 'Plan ' + i));
  const result = financialTrends(plans, '2026-11-12', '2026-11-12');
  assert.equal(result.topPlans.length, 8);
  assert.equal(result.planSales?.length, 10);
  assert.equal(result.planSales?.at(-1)?.name, 'Plan 9');
  assert.equal(
    result.planSales?.reduce((n, plan) => n + plan.quantity, 0),
    10,
  );
  assert.equal(result.otherPlanQuantity, 2);
  assert.throws(() => financialTrends([], '2026-11-15', '2026-11-01'));
});

test('billing-country analysis uses Stripe country, includes unknown and respects dates, refunds and payment state', () => {
  const a = row('2026-11-12T12:00:00Z');
  a.billingCountry = 'US';
  a.selling.refundedMinor = 500;
  a.stripe.revenueGbp = 500;
  const b = row('2026-11-12T12:00:00Z');
  b.billingCountry = 'GB';
  const unknown = row('2026-11-12T12:00:00Z');
  const unpaid = row('2026-11-12T12:00:00Z');
  unpaid.paid = false;
  unpaid.billingCountry = 'FR';
  const old = row('2026-10-12T12:00:00Z');
  old.billingCountry = 'FR';
  const result = financialTrends(
    [calculateFinancial(a), b, unknown, unpaid, old],
    '2026-11-01',
    '2026-11-30',
  );
  assert.equal(result.billingCountries?.length, 3);
  assert.equal(result.billingCountries?.find((r) => r.country === 'US')?.revenueGbp, 500);
  assert.equal(result.billingCountries?.find((r) => r.country === 'GB')?.orders, 1);
  assert.equal(result.billingCountries?.find((r) => r.country === null)?.orders, 1);
  assert.equal(
    result.billingCountries?.find((r) => r.country === 'FR'),
    undefined,
  );
});
