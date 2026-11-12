import { z } from 'zod';
import { BUSINESS } from '../../../../packages/shared/src/legal.ts';
import { orderReference } from './confirmation-order.js';

export const STRIPE_APP_INFO = { name: BUSINESS.brand, url: BUSINESS.site };
// Stored with a purchase so retries send the exact same request even after a deployment.
export const stripeAttributionSchema = z
  .object({
    description: z.string().min(1).max(255),
    metadata: z
      .object({
        alozuriPurchaseId: z.string().regex(/^purchase_[a-f0-9]{48}$/),
        app: z.literal('alozuri'),
        brand: z.literal('Alozuri'),
        company: z.string().min(1).max(500),
        website: z.url().max(500),
        order_reference: z.string().regex(/^AZ-(?:[A-F0-9]{4}-){3}[A-F0-9]{4}$/),
      })
      .strict(),
  })
  .strict();
export type StripeAttribution = z.infer<typeof stripeAttributionSchema>;
export function newStripeAttribution(id: string): StripeAttribution {
  const reference = orderReference(id);
  return stripeAttributionSchema.parse({
    description: `Alozuri eSIM order ${reference}`,
    metadata: {
      alozuriPurchaseId: id,
      app: 'alozuri',
      brand: BUSINESS.brand,
      company: BUSINESS.company,
      website: BUSINESS.site,
      order_reference: reference,
    },
  });
}
export function stripePaymentReference(
  id: string,
  frozen?: StripeAttribution,
): {
  description: string;
  metadata: Record<string, string>;
} {
  const reference = orderReference(id);
  if (!frozen)
    return { description: 'Alozuri eSIM order ' + id, metadata: { alozuriPurchaseId: id } };
  const attribution = stripeAttributionSchema.parse(frozen);
  if (
    attribution.metadata.alozuriPurchaseId !== id ||
    attribution.metadata.order_reference !== reference
  )
    throw new Error('Stripe attribution does not match this purchase.');
  return attribution;
}
export function stripeRefundMetadata(
  id: string,
  parentId?: string,
  frozen?: StripeAttribution,
): Record<string, string> {
  if (!frozen) return { alozuriOrderId: id };
  z.string()
    .regex(/^order_[a-f0-9]{48}$/)
    .parse(id);
  if (!parentId) throw new Error('Attributed refund requires its original purchase.');
  return { ...stripePaymentReference(parentId, frozen).metadata, alozuriOrderId: id };
}
