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
