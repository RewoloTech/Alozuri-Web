import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutLegalSchema, legalSnapshot } from '../src/lib/legal.js';
import { CHECKOUT_LEGAL_ACCEPTANCE } from '../../../packages/shared/src/legal.ts';
test('legal acceptance requires current terms and separately affirmative supply acknowledgements', () => {
  assert.ok(checkoutLegalSchema.safeParse(CHECKOUT_LEGAL_ACCEPTANCE).success);
  for (const change of [
    { version: 'old' },
    { termsAccepted: false },
    { immediateSupplyRequested: false },
    { cancellationAcknowledged: false },
    { extra: 'untrusted' },
  ])
    assert.equal(
      checkoutLegalSchema.safeParse({ ...CHECKOUT_LEGAL_ACCEPTANCE, ...change }).success,
      false,
    );
  assert.equal(checkoutLegalSchema.safeParse(undefined).success, false);
});
test('the server snapshots the accepted text and time, retaining statutory-rights wording', () => {
  const snapshot = legalSnapshot(CHECKOUT_LEGAL_ACCEPTANCE, '2026-11-11T12:00:00Z');
  assert.equal(snapshot.acceptedAt, '2026-11-11T12:00:00Z');
  assert.ok(snapshot.termsText.includes('Rewolo Technologies Ltd'));
  assert.ok(snapshot.refundText.includes('not an automatic waiver'));
  assert.ok(
    snapshot.acknowledgementText.includes(
      'My rights for faulty or misdescribed products are not waived',
    ),
  );
  assert.ok(snapshot.termsText.includes('Registered') || snapshot.termsText.includes('registered'));
});

test('sitemap catalogue exposes only public identifiers and refresh dates', async () => {
  const { createApp } = await import('../src/app.js');
  const { demoPlans } = await import('../../../packages/shared/src/demo.ts');
  const api = await createApp({
    repository: {
      plans: async () => [
        { ...demoPlans[0], demo: false, supplierCode: 'PRIVATE_SUPPLIER', wholesaleUnits: 1000 },
      ],
      orders: async () => [],
      order: async () => null,
    },
    payments: null,
    commerce: null,
    fulfillment: null,
  });
  try {
    const response = await api.inject({ method: 'GET', url: '/v1/catalogue/sitemap' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(Object.keys(response.json().plans[0]).sort(), ['id', 'syncedAt']);
    assert.ok(!response.body.includes('PRIVATE_SUPPLIER'));
    assert.ok(!response.body.includes('wholesaleUnits'));
  } finally {
    await api.close();
  }
});
