import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFinancial,
  financialSchema,
  initialFinancial,
  londonBounds,
  summarize,
} from '../src/lib/financial-calculations.ts';
import { londonMonth } from '../../../packages/shared/src/financial.ts';
import { createApp } from '../src/app.ts';
const rate = {
  numerator: '8',
  denominator: '10',
  source: 'historical-fixture',
  asOf: '2026-11-12',
};
export function financialFixture(currency: 'GBP' | 'USD' | 'EUR' = 'GBP') {
  const row = initialFinancial(
    'purchase_fixture',
    'purchases',
    {
      uid: null,
      email: 'sample@example.test',
      createdAt: '2026-11-12T12:00:00.000Z',
      paidAt: '2026-11-12T12:01:00.000Z',
      status: 'paid',
      test: false,
      currency,
      totalCents: 2000,
      items: [
        {
          quantity: 2,
          wholesaleUnits: 55000,
          exchange: { ...rate, numerator: currency === 'EUR' ? '9' : '8' },
          plan: { name: 'Europe', countries: ['FR', 'IT'], priceCents: 1000, currency },
        },
      ],
    },
    rate,
  );
  row.stripe.observedAt = '2026-11-12T12:02:00.000Z';
  row.selling.refundedMinor = 0;
  return row;
}
test('profit uses purchased historical supplier units and actual GBP Stripe fees', () => {
  const row = financialFixture();
  row.supplier.purchasedUnits = 110000;
  row.stripe = { ...row.stripe, revenueGbp: 2000, feesGbp: 30 };
  const result = calculateFinancial(row);
  assert.equal(result.supplierGbp, 880);
  assert.equal(result.grossProfitGbp, 1120);
  assert.equal(result.profitGbp, 1090);
  assert.equal(result.marginBps, 5450);
  assert.equal(result.calculationStatus, 'final');
  assert.equal(result.supplier.quotedUnits, 110000);
  assert.equal(row.supplierGbp, null);
});
test('missing cost or actual fees cannot become a final profit or a zero summary', () => {
  const row = financialFixture();
  assert.equal(row.profitGbp, null);
  assert.equal(row.calculationStatus, 'pending');
  assert.equal(summarize([row]).profitGbp, null);
  assert.equal(summarize([]).sales, 0);
  assert.equal(summarize([row]).provisional, 1);
});
test('actual Stripe settlement overrides reference revenue for USD and EUR', () => {
  for (const currency of ['USD', 'EUR'] as const) {
    const row = financialFixture(currency);
    row.stripe = { ...row.stripe, revenueGbp: 1750, feesGbp: 45 };
    row.supplier.purchasedUnits = 110000;
    const result = calculateFinancial(row);
    assert.equal(result.revenueGbp, 1750);
    assert.equal(result.profitGbp, 825);
    assert.equal(result.calculationStatus, 'final');
  }
});
test('partial and full refunds retain non-returned supplier costs and fees', () => {
  const row = financialFixture();
  row.supplier.purchasedUnits = 110000;
  row.selling.refundedMinor = 1000;
  row.stripe = { ...row.stripe, revenueGbp: 1000, feesGbp: 30 };
  let result = calculateFinancial(row);
  assert.equal(result.profitGbp, 90);
  assert.equal(result.marginBps, 900);
  row.selling.refundedMinor = 2000;
  row.stripe.revenueGbp = 0;
  result = calculateFinancial(row);
  assert.equal(result.profitGbp, -910);
  assert.equal(result.marginBps, null);
  row.stripe.refundsPending = true;
  assert.equal(calculateFinancial(row).calculationStatus, 'pending');
});
test('failed supplier purchase can have known zero cost, unknown outcomes stay provisional', () => {
  const row = financialFixture();
  row.stripe = { ...row.stripe, revenueGbp: 0, feesGbp: 30 };
  row.supplier.purchasedUnits = 0;
  assert.equal(calculateFinancial(row).profitGbp, -30);
  row.supplier.purchasedUnits = null;
  assert.equal(calculateFinancial(row).profitGbp, null);
});
test('GBP provisional conversion uses frozen rational rates, never today’s catalogue', () => {
  const row = financialFixture('EUR');
  row.selling.refundedMinor = 1100;
  assert.equal(calculateFinancial(row).revenueGbp, 800);
  row.usdGbp = null;
  assert.equal(calculateFinancial(row).revenueGbp, null);
  row.supplier.quotedUnits = Number.MAX_SAFE_INTEGER + 1;
  assert.equal(financialSchema.safeParse(row).success, false);
});
test('London date ranges include the whole day across both DST transitions', () => {
  assert.deepEqual(londonBounds('2026-03-29', '2026-03-29'), {
    start: '2026-03-29T00:00:00.000Z',
    end: '2026-03-29T23:00:00.000Z',
  });
  assert.deepEqual(londonBounds('2026-10-25', '2026-10-25'), {
    start: '2026-10-24T23:00:00.000Z',
    end: '2026-10-26T00:00:00.000Z',
  });
  assert.throws(() => londonBounds('2026-02-30', '2026-03-01'));
  assert.throws(() => londonBounds('2026-12-01', '2026-11-01'));
  assert.deepEqual(londonMonth(new Date('2026-04-30T23:30:00Z')), {
    from: '2026-05-01',
    to: '2026-05-31',
  });
});
test('Operations API authorizes every request before invoking financial queries', async () => {
  let reads = 0;
  const app = await createApp({
    demo: true,
    payments: null,
    commerce: null,
    fulfillment: null,
    profiles: null,
    financial: null,
    operations: {
      report: async (input) => {
        reads++;
        return {
          ...input,
          timezone: 'Europe/London',
          currency: 'GBP',
          summary: summarize([]),
          rows: [],
          nextCursor: null,
        };
      },
    },
    verify: async (token) => {
      if (token === 'invalid') throw new Error();
      return { uid: token, verified: token !== 'unverified', admin: token === 'admin' };
    },
  });
  try {
    for (const [token, code] of [
      [null, 401],
      ['invalid', 401],
      ['customer', 403],
      ['unverified', 403],
      ['admin', 200],
    ] as const) {
      const headers = token ? { authorization: 'Bearer ' + token, 'x-admin': 'true' } : {};
      for (const url of [
        '/v1/operations/access',
        '/v1/operations/financials?from=2026-11-01&to=2026-11-30',
      ]) {
        const response = await app.inject({ url, headers });
        assert.equal(response.statusCode, code);
        assert.equal(response.headers['cache-control'], 'no-store');
      }
    }
    assert.equal(reads, 1);
    const response = await app.inject({
      url: '/v1/operations/financials?from=2026-11-01&to=2026-11-30&admin=true',
      headers: { authorization: 'Bearer admin' },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(reads, 1);
  } finally {
    await app.close();
  }
});

test('unreconciled historical refunds are unknown, never an invented zero', () => {
  const row = financialFixture();
  row.stripe.observedAt = null;
  const result = calculateFinancial(row);
  assert.equal(result.selling.refundedMinor, null);
  assert.equal(result.revenueGbp, null);
  assert.equal(result.profitGbp, null);
});
