// Administrative preview only: reuse the authoritative pricing module without
// writing packages or making any supplier request. Never used by public routes.
import { z } from 'zod';
import { storedPlanSchema } from './validation.js';
import { pricePackage } from './package-pricing.js';
const sourceSchema = storedPlanSchema.extend({
  supplierCode: z.string().min(1).max(200),
  wholesaleUnits: z.number().int().positive(),
  providerId: z.literal('esim-access').default('esim-access'),
});
export function previewFeaturedPricing(value: unknown): unknown {
  const parsed = sourceSchema.safeParse(value),
    previous = z.record(z.string(), z.unknown()).safeParse(value);
  return parsed.success && previous.success ? pricePackage(parsed.data, previous.data) : null;
}
