import { discountConfig, discountedUnit } from './promotion-policy.js';
import { priceExchange } from './exchange-rates.js';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { database } from './firebase.js';
import { Promotions, promoCode, discountUnit } from './promotions.js';
import { catalogueDate, currentCatalogueDate, validPackagePricing } from './package-pricing.js';
import { PRICING_POLICY } from './pricing.js';
import { OperationsError } from './operations-error.js';
import { documentId } from './validation.js';

const previewPrice = z.number().int().positive().max(99999999);
const previewCost = z.number().int().positive().safe();
const packageSearchLimit = 20;

function packageSearchWords(text: string) {
  const normalized = text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  // Treat supplier spellings like 1GB and 7Days the same as 1 GB and 7 days.
  const words = normalized.match(/\d+(?:\.\d+)?(?:\s*(?:[gmt]b|days?)\b)?|\p{L}+/gu) ?? [];
  return words.map((word) => word.replace(/\s+/g, '').replace(/^(\d+)days$/, '$1day'));
}

function packagePreviewPricing(data: Record<string, unknown> | undefined, now = Date.now()) {
  if (
    !data ||
    data.demo ||
    data.active !== true ||
    data.currency !== 'USD' ||
    !currentCatalogueDate(data.catalogueDate, now) ||
    !validPackagePricing(data)
  )
    return null;
  const retail = previewPrice.safeParse(data.priceCents);
  const cost = previewCost.safeParse(data.wholesaleUnits);
  return retail.success && cost.success ? { retail: retail.data, cost: cost.data } : null;
}

export function contributionPreview(retail: number, supplierUnits: number, percent: number) {
  z.number().int().positive().safe().parse(supplierUnits);
  return contributionAtPrice(retail, supplierUnits, retail - discountUnit(retail, percent));
}
export function contributionAtPrice(retail: number, supplierUnits: number, finalMinor: number) {
  const discountMinor = retail - finalMinor;
  const supplierMinor = Number((BigInt(supplierUnits) + 99n) / 100n);
  const policy = PRICING_POLICY.fees[2];
  const estimatedFeeMinor =
    Number((BigInt(finalMinor) * BigInt(policy.bps) + 9999n) / 10000n) + policy.fixedCents;
  const contributionMinor = finalMinor - supplierMinor - estimatedFeeMinor;
  const marginBps = Number((BigInt(contributionMinor) * 10000n) / BigInt(finalMinor));
  return {
    currency: 'USD',
    originalMinor: retail,
    discountMinor,
    finalMinor,
    supplierMinor,
    supplierUnits,
    estimatedFeeMinor,
    contributionMinor,
    marginBps,
    warning:
      contributionMinor <= 0
        ? 'critical'
        : marginBps < 2000
          ? 'low'
          : marginBps < 2500
            ? 'reduced'
            : 'normal',
    feeBasis: `${policy.bps / 100}% + USD ${(policy.fixedCents / 100).toFixed(2)} estimated; excludes taxes`,
  };
}
export function registerPromotionRoutes(
  app: FastifyInstance,
  authorize: (header: string | undefined) => Promise<{ uid: string } | void>,
) {
  app.get('/v1/operations/promotions', async (req) => {
    await authorize(req.headers.authorization);
    const q = z
      .object({
        after: promoCode.optional(),
        q: z.string().trim().toUpperCase().max(32).optional(),
        active: z.enum(['true', 'false']).optional(),
      })
      .strict()
      .parse(req.query);
    return new Promotions(database()).list(
      q.after,
      q.q,
      q.active === undefined ? undefined : q.active === 'true',
    );
  });
  for (const method of ['POST', 'PUT'] as const)
    app.route({
      method,
      url: '/v1/operations/promotions',
      handler: async (req) => {
        const actor = await authorize(req.headers.authorization);
        await new Promotions(database()).save(req.body, method === 'POST', actor?.uid);
        return { saved: true };
      },
    });
  app.patch('/v1/operations/promotions/:code/status', async (req) => {
    const actor = await authorize(req.headers.authorization);
    const params = z.object({ code: promoCode }).strict().parse(req.params);
    const input = z.object({ active: z.boolean() }).strict().parse(req.body);
    await new Promotions(database()).setActive(params.code, input.active, actor?.uid);
    return { saved: true };
  });
  app.delete('/v1/operations/promotions/:code', async (req) => {
    const actor = await authorize(req.headers.authorization);
    const params = z.object({ code: promoCode }).strict().parse(req.params);
    z.object({}).strict().parse(req.query);
    await new Promotions(database()).deleteUnused(params.code, actor?.uid);
    return { deleted: true };
  });
  app.put('/v1/operations/promotions/products/:id/tags', async (req) => {
    const actor = await authorize(req.headers.authorization);
    const { id } = z.object({ id: documentId }).parse(req.params);
    const { tags } = z
      .object({ tags: z.array(z.string().trim().min(1).max(100)).max(50) })
      .strict()
      .parse(req.body);
    await database().runTransaction(async (t) => {
      const ref = database().doc('packages/' + id),
        product = await t.get(ref);
      if (!product.exists) throw new OperationsError('Product not found.', 404);
      t.set(database().doc('marketingState/current'), { revision: crypto.randomUUID() });
      t.update(ref, { tags });
      t.create(database().collection('marketingAudit').doc(), {
        actor: actor?.uid ?? 'verified-admin',
        action: 'product_tags',
        target: id,
        tags,
        at: new Date().toISOString(),
      });
    });
    return { saved: true };
  });
  app.get('/v1/operations/promotions/packages', async (req) => {
    await authorize(req.headers.authorization);
    const { q } = z
      .object({ q: z.string().trim().max(100).toLowerCase().default('') })
      .strict()
      .parse(req.query);
    const now = Date.now();
    const terms = packageSearchWords(q);
    const phrase = terms.join(' ');
    const docs = await database()
      .collection('packages')
      .where('catalogueDate', 'in', [catalogueDate(now), catalogueDate(now - 86400000)])
      .get();
    const matches = docs.docs.flatMap((doc) => {
      const data = doc.data();
      if (typeof data.name !== 'string' || !documentId.safeParse(doc.id).success) return [];
      const words = q ? packageSearchWords(data.name) : [];
      const idMatch = doc.id.toLowerCase() === q;
      if (
        q &&
        !idMatch &&
        (!terms.length || !terms.every((term) => words.some((word) => word.startsWith(term))))
      )
        return [];
      if (!packagePreviewPricing(data, now)) return [];
      const name = words.join(' ');
      const rank =
        idMatch || name === phrase
          ? 0
          : name.startsWith(phrase)
            ? 1
            : name.includes(phrase)
              ? 2
              : 3;
      return [{ id: doc.id, name: data.name, rank }];
    });
    matches.sort(
      (a, b) =>
        a.rank - b.rank ||
        a.name.localeCompare(b.name, 'en', { numeric: true }) ||
        a.id.localeCompare(b.id),
    );
    return {
      rows: matches.slice(0, packageSearchLimit).map(({ id, name }) => ({ id, name })),
      hasMore: matches.length > packageSearchLimit,
    };
  });
  app.post('/v1/operations/promotions/preview', async (req) => {
    await authorize(req.headers.authorization);
    const input = z
      .object({
        packageId: documentId,
        discountPercent: z.number().int().min(1).max(50),
        discount: discountConfig.optional(),
      })
      .strict()
      .parse(req.body);
    const doc = await database()
      .doc('packages/' + input.packageId)
      .get();
    const pricing = packagePreviewPricing(doc.data());
    if (!pricing)
      throw new OperationsError(
        'Choose an active live catalogue package.',
        400,
        'PLAN_UNAVAILABLE',
      );
    const { retail, cost } = pricing;
    if (!input.discount) return contributionPreview(retail, cost, input.discountPercent);
    const exchange = priceExchange('USD');
    let finalMinor: number;
    try {
      finalMinor = discountedUnit(
        retail,
        { code: 'PREVIEW', discountPercent: input.discountPercent, discount: input.discount },
        exchange,
      );
    } catch {
      throw new OperationsError(
        'The discount must reduce the selected package price by at most 50%.',
        400,
        'PROMO_CODE_NOT_APPLICABLE',
      );
    }
    return contributionAtPrice(retail, cost, finalMinor);
  });
}
