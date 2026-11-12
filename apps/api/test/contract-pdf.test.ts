import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleConfirmation } from '../../../tests/fixtures/order-confirmation.ts';
import { renderContractPdf } from '../src/lib/contract-pdf.ts';

test('contract downloads are real bounded PDF documents for USD, GBP and EUR', async () => {
  for (const currency of ['USD', 'GBP', 'EUR'] as const) {
    const pdf = await renderContractPdf(sampleConfirmation(currency));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.subarray(-10).toString().includes('%%EOF'));
    assert.ok(pdf.length > 10000 && pdf.length < 150000, `Unexpected PDF size: ${pdf.length}`);
  }
});
test('PDF generation rejects missing confirmation dates or altered totals instead of inventing a contract', async () => {
  const source = sampleConfirmation();
  await assert.rejects(renderContractPdf({ ...source, totalCents: 1 }));
  await assert.rejects(renderContractPdf({ ...source, paidAt: 'invalid' }));
});
