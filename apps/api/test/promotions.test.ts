import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discountUnit,
  promotionInput,
  promotionSnapshot,
  eligibility,
} from '../src/lib/promotions.ts';
import { contributionPreview } from '../src/lib/promotion-routes.ts';
import { initialFinancial } from '../src/lib/financial-calculations.ts';
import { promotionReport } from '../src/lib/promotion-report.ts';
const base = {
  code: ' save10 ',
  discountPercent: 10,
  active: true,
  startsAt: '2026-01-01T00:00:00Z',
  expiresAt: '2027-01-01T00:00:00Z',
  maxUses: null,
};
test('whole percentage ceiling, canonical codes, dates, and no stacking or browser amounts', () => {
  assert.equal(promotionInput.parse(base).code, 'SAVE10');
  for (const discountPercent of [40, 50]) {
    assert.equal(
      promotionInput.parse({ ...base, discountPercent }).discountPercent,
      discountPercent,
    );
    assert.equal(
      promotionSnapshot.parse({ id: 'SAVE50', code: 'SAVE50', discountPercent }).discountPercent,
      discountPercent,
    );
    assert.equal(
      contributionPreview(1000, 40001, discountPercent).finalMinor,
      1000 - discountPercent * 10,
    );
  }
  assert.throws(() => discountUnit(1000, 51));
  assert.equal(
    promotionSnapshot.safeParse({ id: 'SAVE51', code: 'SAVE51', discountPercent: 51 }).success,
    false,
  );
  for (const discountPercent of [0, -1, 40.1, 50.1, 51, 100])
    assert.equal(promotionInput.safeParse({ ...base, discountPercent }).success, false);
  assert.equal(promotionInput.safeParse({ ...base, amount: 1 }).success, false);
  assert.equal(promotionInput.safeParse({ ...base, code: ['ONE', 'TWO'] }).success, false);
  assert.equal(promotionInput.safeParse({ ...base, expiresAt: base.startsAt }).success, false);
  assert.equal(promotionInput.safeParse({ ...base, maxUses: 0 }).success, false);
});
for (const percent of [5, 10, 15, 20, 25, 30, 40, 50])
  test(`${percent}% discount rounds down per unit and cannot exceed ceiling`, () => {
    for (const price of [1, 101, 499, 12345, 99999999]) {
      const actual = discountUnit(price, percent);
      assert.equal(actual, Math.floor((price * percent) / 100));
      assert.ok(BigInt(actual) * 100n <= BigInt(price) * BigInt(percent));
    }
  });
test('eligibility distinguishes inactive, future, expired, exhausted and reserved codes', () => {
  const p = {
    ...promotionInput.parse(base),
    redemptionCount: 0,
    holds: {},
    totals: {},
    createdAt: base.startsAt,
    updatedAt: base.startsAt,
  };
  eligibility(p, '2026-11-13T00:00:00Z');
  assert.throws(() => eligibility({ ...p, active: false }), /inactive/);
  assert.throws(() => eligibility(p, '2025-01-01T00:00:00Z'), /not started/);
  assert.throws(() => eligibility(p, base.expiresAt), /expired/);
  assert.throws(
    () => eligibility({ ...p, maxUses: 1, redemptionCount: 1 }, '2026-11-13T00:00:00Z'),
    /limit/,
  );
  assert.throws(
    () => eligibility({ ...p, maxUses: 1, holds: { order: { at: 0 } } }, '2026-11-13T00:00:00Z'),
    /reserved/,
  );
});
test('package contribution uses margin, ceiling supplier rounding and explicitly estimated fees', () => {
  const preview = contributionPreview(1000, 40001, 10);
  assert.equal(preview.finalMinor, 900);
  assert.equal(preview.supplierMinor, 401);
  assert.equal(preview.contributionMinor, 900 - 401 - preview.estimatedFeeMinor);
  assert.equal(preview.marginBps, Math.trunc((preview.contributionMinor * 10000) / 900));
  assert.match(preview.feeBasis, /estimated/);
  assert.equal(preview.warning, 'normal');
  assert.equal(contributionPreview(1000, 62000, 10).warning, 'reduced');
  assert.equal(contributionPreview(1000, 70000, 10).warning, 'low');
  assert.equal(contributionPreview(1000, 85000, 10).warning, 'critical');
});
test('promotion report separates currencies, refunds, date usage and unknown fees/costs', () => {
  const make = (currency: 'USD' | 'GBP' | 'EUR', refunded: number | null) => {
    const r = initialFinancial('fixture', 'purchases', {
      ...base,
      promotion: { id: 'SAVE10', code: 'SAVE10', discountPercent: 10 },
      uid: null,
      test: false,
      status: 'paid',
      createdAt: '2026-11-13T10:00:00Z',
      paidAt: '2026-11-13T10:00:00Z',
      currency,
      totalCents: 900,
      originalRetailCents: 1000,
      discountCents: 100,
      items: [
        {
          quantity: 1,
          wholesaleUnits: 40000,
          plan: { name: 'UK', countries: ['GB'], priceCents: 900, currency },
        },
      ],
    });
    assert.equal(r.checkoutEstimate, null); // Historical fallback cannot invent a checkout fee estimate.
    r.selling.refundedMinor = refunded;
    return r;
  };
  const unpaid = make('GBP', 0);
  unpaid.paid = false;
  const rows = promotionReport([make('GBP', 100), make('USD', 900), make('EUR', null), unpaid]);
  assert.equal(rows.length, 3);
  assert.equal(rows.find((r) => r.currency === 'GBP')?.revenueMinor, 800);
  assert.equal(rows.find((r) => r.currency === 'USD')?.revenueMinor, 0);
  assert.equal(rows.find((r) => r.currency === 'EUR')?.revenueMinor, null);
  assert.equal(rows[0].discountMinor, 100);
  assert.equal(rows[0].feesGbp, null);
  assert.deepEqual(rows[0].usage, [{ date: '2026-11-13', sales: 1 }]);
});

test('checkout estimates freeze original currencies, FX, one processing fee and total supplier cost', async () => {
  const { promotionEstimate } = await import('../src/lib/promotion-estimate.ts');
  for (const currency of ['USD', 'GBP', 'EUR'] as const) {
    const rate =
      currency === 'GBP'
        ? { numerator: '8', denominator: '10' }
        : { numerator: '11', denominator: '10' };
    const e = promotionEstimate(900, currency, 80000, rate)!;
    assert.equal(e.currency, currency);
    assert.equal(e.supplierMinor, currency === 'USD' ? 800 : currency === 'GBP' ? 640 : 880);
    assert.equal(e.contributionMinor, 900 - e.supplierMinor - e.feeMinor);
    assert.match(e.basis, /Estimated/);
  }
  assert.equal(promotionEstimate(900, 'EUR', 10000, null), null);
});
