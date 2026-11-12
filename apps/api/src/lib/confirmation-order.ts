import { createHash } from 'node:crypto';
import { z } from 'zod';
import { legalSnapshotSchema } from './legal.js';
import { planSchema } from './validation.js';

export const CONFIRMATION_VERSION = 'email-v2-ready';
export const confirmationVersionSchema = z.enum(['email-v1', CONFIRMATION_VERSION]);
export const CONTRACT_PDF_FILENAME = 'Alozuri-Order-Confirmation.pdf';
const cents = z.number().int().nonnegative().safe();
// Deliberately select only confirmation data. No supplier credentials, access tokens,
// Stripe identifiers, or eSIM activation fields can reach the email or PDF templates.
export const confirmationOrderSchema = z
  .object({
    id: z.string().regex(/^purchase_[a-f0-9]{48}$/),
    email: z.email(),
    customerName: z.string().min(1).max(200).optional(),
    createdAt: z.iso.datetime({ offset: true }),
    paidAt: z.iso.datetime({ offset: true }),
    currency: z.enum(['USD', 'GBP', 'EUR']),
    subtotalCents: cents.optional(),
    taxCents: cents.optional(),
    totalCents: cents.positive(),
    items: z
      .array(z.object({ plan: planSchema, quantity: z.number().int().min(1).max(5) }))
      .min(1)
      .max(10),
    legal: legalSnapshotSchema,
    test: z.boolean(),
  })
  .superRefine((order, ctx) => {
    const subtotal = order.items.reduce(
      (sum, item) => sum + BigInt(item.plan.priceCents) * BigInt(item.quantity),
      0n,
    );
    if (
      order.items.some((item) => item.plan.currency !== order.currency) ||
      subtotal + BigInt(order.taxCents ?? 0) !== BigInt(order.totalCents) ||
      (order.subtotalCents !== undefined && subtotal !== BigInt(order.subtotalCents))
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Contract amounts do not match the recorded purchase.',
      });
    }
  });
export type ConfirmationOrder = z.infer<typeof confirmationOrderSchema>;
export const confirmationHash = (bytes: Buffer | string) =>
  createHash('sha256').update(bytes).digest('hex');
export function confirmationMoney(cents: number, currency: string) {
  const amount = BigInt(cents);
  return `${currency} ${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`;
}

export function orderReference(id: string) {
  confirmationOrderSchema.shape.id.parse(id);
  return (
    'AZ-' +
    id
      .slice(9, 25)
      .toUpperCase()
      .match(/.{1,4}/g)!
      .join('-')
  );
}
