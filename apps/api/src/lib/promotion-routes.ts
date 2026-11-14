import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { database } from './firebase.js';
import { Promotions, promoCode, discountUnit } from './promotions.js';
import { currentCatalogueDate, validPackagePricing } from './package-pricing.js';
import { PRICING_POLICY } from './pricing.js';
import { OperationsError } from './operations-error.js';
export function contributionPreview(retail: number, supplierUnits: number, percent: number) {
  z.number().int().positive().safe().parse(supplierUnits);
  const discountMinor = discountUnit(retail, percent),
    finalMinor = retail - discountMinor;
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
  authorize: (header: string | undefined) => Promise<void>,
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
        await authorize(req.headers.authorization);
        await new Promotions(database()).save(req.body, method === 'POST');
        return { saved: true };
      },
    });
  app.get('/v1/operations/promotions/packages', async (req) => {
    await authorize(req.headers.authorization);
    const q = z
      .object({ q: z.string().trim().max(100).default('') })
      .strict()
      .parse(req.query);
    let query = database().collection('packages').orderBy('name').limit(20);
    if (q.q) query = query.startAt(q.q).endAt(q.q + '\uf8ff');
    const docs = await query.select('name', 'active', 'currency', 'priceCents').get();
    return {
      rows: docs.docs
        .filter((d) => d.get('active') === true && d.get('currency') === 'USD')
        .map((d) => ({ id: d.id, name: d.get('name') })),
    };
  });
  app.post('/v1/operations/promotions/preview', async (req) => {
    await authorize(req.headers.authorization);
    const input = z
      .object({
        packageId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
        discountPercent: z.number().int().min(1).max(50),
      })
      .strict()
      .parse(req.body);
    const doc = await database()
      .doc('packages/' + input.packageId)
      .get();
    if (
      !doc.exists ||
      doc.get('demo') ||
      doc.get('active') !== true ||
      doc.get('currency') !== 'USD' ||
      !validPackagePricing(doc.data() ?? {}) ||
      !currentCatalogueDate(doc.get('catalogueDate'))
    )
      throw new OperationsError('Choose an active live catalogue package.');
    const retail = z.number().int().positive().max(99999999).parse(doc.get('priceCents'));
    const cost = z.number().int().positive().safe().parse(doc.get('wholesaleUnits'));
    return contributionPreview(retail, cost, input.discountPercent);
  });
}
