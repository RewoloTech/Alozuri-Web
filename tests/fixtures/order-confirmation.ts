import { CHECKOUT_LEGAL_ACCEPTANCE } from '../../packages/shared/src/legal';
import { demoPlans } from '../../packages/shared/src/demo';
import { legalSnapshot } from '../../apps/api/src/lib/legal';
import {
  confirmationOrderSchema,
  type ConfirmationOrder,
} from '../../apps/api/src/lib/confirmation-order';
export function sampleConfirmation(currency: 'USD' | 'GBP' | 'EUR' = 'GBP'): ConfirmationOrder {
  return confirmationOrderSchema.parse({
    id: 'purchase_' + 'a'.repeat(48),
    email: 'sample@example.test',
    createdAt: '2026-11-11T12:00:00.000Z',
    paidAt: '2026-11-11T12:03:12.000Z',
    currency,
    subtotalCents: 3898,
    taxCents: 0,
    totalCents: 3898,
    items: [
      {
        plan: { ...demoPlans[0], name: 'Europe connection', currency, priceCents: 1949 },
        quantity: 2,
      },
    ],
    test: false,
    legal: legalSnapshot(CHECKOUT_LEGAL_ACCEPTANCE, '2026-11-11T12:00:00.000Z'),
  });
}

// Synthetic installation credentials only; never use real customer profiles in tests.
export function sampleInstallations(order: ConfirmationOrder = sampleConfirmation()) {
  let index = 0;
  return order.items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => {
      const serial = ++index;
      return {
        unitId: 'order_' + serial.toString(16).padStart(48, '0'),
        planId: item.plan.id,
        activation: {
          ac: `LPA:1$rsp.example.test$SYNTHETIC-ESIM-${serial}${serial === 1 ? '$SYNTHETIC-CONFIRMATION' : ''}`,
          iccid: '890000000000000' + String(serial).padStart(4, '0'),
          esimTranNo: 'private-supplier-fixture-' + serial,
        },
      };
    }),
  );
}
