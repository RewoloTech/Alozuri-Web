import { z } from 'zod';
import { orderStates } from '../../../../packages/shared/src/index.ts';

export const documentId = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const text = z.string().trim().min(1).max(1000);
const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.iso.datetime({ offset: true });
// Parse stored values at the trust boundary; object schemas strip non-public fields.
export const planSchema = z.object({
  id: documentId,
  name: text,
  countries: z
    .array(z.string().regex(/^[A-Z]{2}$/))
    .min(1)
    .max(250),
  dataGb: z.number().finite().nonnegative().max(10000),
  days: z.number().int().positive().max(3660),
  priceCents: cents,
  currency: z.literal('USD'),
  dataType: z.enum(['fixed', 'daily', 'unlimited']),
  activation: text,
  networks: z.array(text).max(250),
  fairUse: z.string().max(5000),
  demo: z.boolean().optional(),
  syncedAt: timestamp,
});
export const storedPlanSchema = planSchema.extend({ active: z.boolean() });
export const orderSchema = z.object({
  uid: z.string().min(1).max(128),
  plan: planSchema,
  status: z.enum(orderStates),
  createdAt: timestamp,
  amountCents: cents,
  currency: z.literal('USD'),
  refundRequested: z.boolean().optional(),
  test: z.boolean().optional(),
});
