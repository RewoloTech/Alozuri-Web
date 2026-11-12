import test from 'node:test';
import assert from 'node:assert/strict';
import type { Currency } from '../src/index.ts';
import { demoPlans } from '../src/demo.ts';
import {
  validateContractOrder,
  contractPaymentConfirmed,
  contractMoney,
  type ContractOrder,
} from '../src/contract.ts';
function order(currency: Currency = 'GBP'): ContractOrder {
  return {
    id: 'purchase_' + 'a'.repeat(48),
    email: 'fixture@example.test',
    createdAt: '2026-11-11T12:00:00.000Z',
    status: 'paid',
    currency,
    totalCents: 3898,
    test: false,
    items: [{ plan: { ...demoPlans[0], currency, priceCents: 1949 }, quantity: 2 }],
    legal: {
      version: 'accepted-historical-version',
      effectiveDate: '2026-11-10',
      acceptedAt: '2026-11-11T12:00:00.000Z',
      termsText: 'The exact recorded historical terms.',
      refundText: 'The exact recorded historical refund policy.',
      requestText: '',
      acknowledgementText: '',
    },
  };
}
test('legacy paid order responses can download without a PDF capability flag or invented payment date', () => {
  const source = order();
  assert.equal(contractPaymentConfirmed(source), true);
  validateContractOrder(source);
  assert.equal(source.paidAt, undefined);
  assert.equal(source.legal.termsText, 'The exact recorded historical terms.');
  for (const status of ['pending_payment', 'payment_processing', 'cancelled', 'attention'])
    assert.equal(contractPaymentConfirmed({ ...source, status }), false);
  assert.equal(contractPaymentConfirmed({ ...source, status: 'refunded' }), true);
  assert.equal(
    contractPaymentConfirmed({
      ...source,
      status: 'refund_pending',
      contractDownloadAvailable: true,
    }),
    true,
  );
  assert.throws(
    () => validateContractOrder({ ...source, contractDownloadAvailable: false }),
    /after payment/,
  );
});
test('browser contracts validate recorded amounts, currencies and accepted dates', () => {
  for (const currency of ['USD', 'GBP', 'EUR'] as const) {
    const source = order(currency);
    validateContractOrder(source);
    assert.equal(contractMoney(source.totalCents, currency), `${currency} 38.98`);
    assert.throws(() => validateContractOrder({ ...source, totalCents: 1 }), /amounts/);
    assert.throws(() => validateContractOrder({ ...source, paidAt: 'not-a-date' }), /dates/);
    assert.throws(
      () => validateContractOrder({ ...source, legal: { ...source.legal, acceptedAt: 'invalid' } }),
      /dates/,
    );
    assert.throws(
      () => validateContractOrder({ ...source, legal: { ...source.legal, termsText: '' } }),
      /incomplete/,
    );
    assert.throws(
      () => validateContractOrder({ ...source, items: [{ ...source.items[0], quantity: 0 }] }),
      /invalid/,
    );
    assert.throws(
      () =>
        validateContractOrder({
          ...source,
          items: [
            {
              ...source.items[0],
              plan: { ...source.items[0].plan, currency: currency === 'USD' ? 'GBP' : 'USD' },
            },
          ],
        }),
      /invalid/,
    );
  }
  assert.throws(() => contractMoney(Number.MAX_SAFE_INTEGER + 1, 'GBP'), /amount/);
});
