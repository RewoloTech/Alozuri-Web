import { z } from 'zod';
import type { StoredPlan } from '../../../../packages/shared/src/index.ts';
import { decisionHash } from './catalogue-curation.js';
/** Private, explicitly reviewed mappings. An adapter ID never becomes a promotion target. */
export const productOffersSchema = z
  .array(
    z
      .object({
        providerId: z.string().regex(/^[a-z][a-z0-9-]{1,49}$/),
        adapterProductId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
        serviceHash: z.string().regex(/^[a-f0-9]{64}$/),
        selected: z.boolean(),
      })
      .strict(),
  )
  .min(1)
  .max(20)
  .refine(
    (v) =>
      v.filter((o) => o.selected).length === 1 &&
      new Set(v.map((o) => o.providerId + ':' + o.adapterProductId)).size === v.length,
    'Select exactly one unique supplier offer.',
  );
/** Equality is deliberately conservative: unknown material service data prevents a swap. */
export function productServiceHash(p: StoredPlan): string {
  if (!p.supplierComparison)
    throw new Error('Verified material service characteristics are required for offer mappings.');
  return decisionHash({
    countries: [...p.countries].sort(),
    dataGb: p.dataGb,
    days: p.days,
    dataType: p.dataType,
    dailyPolicy: p.dailyPolicy ?? null,
    activation: p.activation,
    networks: [...p.networks].sort(),
    fairUse: p.fairUse,
    supplierNotes: p.supplierNotes ?? null,
    service: p.supplierComparison,
  });
}
export function resolveCanonicalProducts(
  providerId: string,
  incoming: StoredPlan[],
  products: { id: string; data: Record<string, unknown> }[],
): StoredPlan[] {
  const mappings = new Map<string, { id: string; serviceHash: string }>();
  const unselected = new Set<string>();
  for (const product of products) {
    if (product.data.productOffers === undefined) continue;
    const offers = productOffersSchema.parse(product.data.productOffers);
    for (const offer of offers.filter((o) => o.providerId === providerId)) {
      if (mappings.has(offer.adapterProductId) || unselected.has(offer.adapterProductId))
        throw new Error('A supplier offer cannot map to multiple internal products.');
      if (offer.selected)
        mappings.set(offer.adapterProductId, { id: product.id, serviceHash: offer.serviceHash });
      else unselected.add(offer.adapterProductId);
    }
  }
  return incoming.flatMap((p) => {
    if (unselected.has(p.id)) return [];
    const mapping = mappings.get(p.id);
    if (!mapping) return [p];
    if (productServiceHash(p) !== mapping.serviceHash)
      throw new Error('Mapped supplier service changed; review equivalence before publication.');
    return [{ ...p, id: mapping.id }];
  });
}
