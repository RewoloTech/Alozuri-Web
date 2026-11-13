import { operationsLookupSchema, type OperationsEsims } from './operations-esims.js';
import { customerReference, operationsSearchSchema } from './operations-order-search.js';
import { pricingHistoryQuery, type PricingHistoryReports } from './pricing-history.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import { database } from './firebase.js';
import type { Principal } from './repository.js';
import type { OperationsReport, OperationsRow } from '../../../../packages/shared/src/financial.ts';
import {
  financialSchema,
  calculateFinancial,
  initialFinancial,
  londonBounds,
  summarize,
} from './financial-calculations.js';
export { OperationsError } from './operations-error.js';
import { OperationsError } from './operations-error.js';
export const operationsQuerySchema = z
  .object({ from: z.iso.date(), to: z.iso.date(), cursor: z.string().max(200).optional() })
  .strict();
export class OperationsReports {
  constructor(private db: Firestore = database()) {}
  async report(input: z.infer<typeof operationsQuerySchema>): Promise<OperationsReport> {
    let bounds: ReturnType<typeof londonBounds>;
    try {
      bounds = londonBounds(input.from, input.to);
    } catch {
      throw new OperationsError('Choose a valid date range.');
    }
    const results = await Promise.all(
      ['purchases', 'orders'].map((collection) =>
        this.db
          .collection(collection)
          .where('createdAt', '>=', bounds.start)
          .where('createdAt', '<', bounds.end)
          .orderBy('createdAt', 'desc')
          .limit(5001)
          .select(
            'financial',
            'financialReconciliationPending',
            'createdAt',
            'email',
            'uid',
            'status',
            'test',
            'paidAt',
            'totalCents',
            'amountCents',
            'currency',
            'items',
            'plan',
            'wholesaleUnits',
            'exchange',
            'orderReference',
            'parentOrderId',
          )
          .get(),
      ),
    );
    if (results.some((r) => r.size > 5000))
      throw new OperationsError('This date range is too large. Select a shorter range.', 422);
    const rows: OperationsRow[] = [];
    for (const [index, result] of results.entries())
      for (const doc of result.docs) {
        if (doc.get('test') !== false || doc.get('parentOrderId')) continue;
        try {
          const row = doc.get('financial')
            ? financialSchema.parse(doc.get('financial'))
            : initialFinancial(doc.id, index === 0 ? 'purchases' : 'orders', doc.data());
          if (index === 0 && /^purchase_[a-f0-9]{48}$/.test(doc.id))
            row.reference = customerReference(doc);
          row.paid = Boolean(doc.get('paidAt'));
          const paymentStatus = z.string().parse(doc.get('status'));
          row.paymentStatus =
            paymentStatus === 'paid' &&
            row.selling.refundedMinor !== null &&
            row.selling.refundedMinor > 0
              ? row.selling.refundedMinor === row.selling.amountMinor
                ? 'refunded'
                : 'partially_refunded'
              : paymentStatus;
          if (row.paid && doc.get('financialReconciliationPending') === true) {
            row.stripe.observedAt = null;
            row.stripe.revenueGbp = null;
            row.selling.refundedMinor = null;
          }
          const calculated = calculateFinancial(row);
          calculated.updatedAt = row.updatedAt;
          rows.push(calculated);
        } catch {
          throw new OperationsError(
            'Historical financial data needs review before this range can be reported.',
            409,
          );
        }
      }
    if (rows.length > 5000) throw new OperationsError('Select a shorter date range.', 422);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    let start = 0;
    if (input.cursor) {
      let token: { from: string; to: string; id: string };
      try {
        token = z
          .object({ from: z.string(), to: z.string(), id: z.string() })
          .strict()
          .parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')));
      } catch {
        throw new OperationsError('Invalid report cursor.');
      }
      if (token.from !== input.from || token.to !== input.to)
        throw new OperationsError('Report date range changed.');
      start = rows.findIndex((r) => r.id === token.id) + 1;
      if (start === 0)
        throw new OperationsError('The report changed. Refresh this date range.', 409);
    }
    const page = rows.slice(start, start + 25);
    return {
      from: input.from,
      to: input.to,
      timezone: 'Europe/London',
      currency: 'GBP',
      summary: summarize(rows),
      rows: page,
      nextCursor:
        start + page.length < rows.length
          ? Buffer.from(
              JSON.stringify({ from: input.from, to: input.to, id: page.at(-1)!.id }),
            ).toString('base64url')
          : null,
    };
  }
}
export function registerOperations(
  app: FastifyInstance,
  verify: (token: string) => Promise<Principal>,
  reports: Pick<OperationsReports, 'report'> | null,
  pricing: Pick<PricingHistoryReports, 'report'> | null = null,
  esims: Pick<OperationsEsims, 'lookup' | 'details' | 'search'> | null = null,
) {
  async function requireAdmin(header: string | undefined) {
    if (!header?.startsWith('Bearer '))
      throw new OperationsError('Sign in to access Operations.', 401);
    let p: Principal;
    try {
      p = await verify(header.slice(7));
    } catch {
      throw new OperationsError('Sign in again to access Operations.', 401);
    }
    if (!p.verified || p.admin !== true)
      throw new OperationsError('Administrator access required.', 403);
  }
  app.get('/v1/operations/access', async (req) => {
    await requireAdmin(req.headers.authorization);
    z.object({}).strict().parse(req.query);
    return { authorized: true };
  });
  app.get(
    '/v1/operations/orders/search',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req) => {
      await requireAdmin(req.headers.authorization);
      const input = operationsSearchSchema.parse(req.query);
      if (!esims) throw new OperationsError('Order search is unavailable.', 503);
      return esims.search(input);
    },
  );
  app.get(
    '/v1/operations/esims/lookup',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req) => {
      await requireAdmin(req.headers.authorization);
      const input = operationsLookupSchema.parse(req.query);
      if (!esims) throw new OperationsError('eSIM support details are unavailable.', 503);
      return esims.lookup(input.q);
    },
  );
  app.get(
    '/v1/operations/orders/:id/esims',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req) => {
      await requireAdmin(req.headers.authorization);
      z.object({}).strict().parse(req.query);
      const params = z
        .object({ id: z.string().regex(/^(?:purchase|order)_[a-f0-9]{48}$/) })
        .strict()
        .parse(req.params);
      if (!esims) throw new OperationsError('eSIM support details are unavailable.', 503);
      return esims.details(params.id);
    },
  );
  app.get(
    '/v1/operations/financials',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req) => {
      await requireAdmin(req.headers.authorization);
      const input = operationsQuerySchema.parse(req.query);
      if (!reports) throw new OperationsError('Financial reporting is unavailable.', 503);
      return reports.report(input);
    },
  );
  app.get(
    '/v1/operations/pricing-history',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req) => {
      await requireAdmin(req.headers.authorization);
      const input = pricingHistoryQuery.parse(req.query);
      if (!pricing) throw new OperationsError('Pricing history is unavailable.', 503);
      return pricing.report(input);
    },
  );
}
