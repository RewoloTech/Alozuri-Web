import { operationsEsimReferences } from './operations-esim-reference.js';
import { z } from 'zod';
import {
  FieldPath,
  type DocumentSnapshot,
  type Firestore,
  type Query,
} from 'firebase-admin/firestore';
import { orderReference } from './confirmation-order.js';
import { OperationsError } from './operations-error.js';
import type {
  OperationsOrderSearch,
  OperationsOrderSummary,
} from '../../../../packages/shared/src/financial.ts';
export const supportId = z.string().regex(/^(?:purchase|order)_[a-f0-9]{48}$/);
export const operationsSearchSchema = z
  .object({
    q: z
      .string()
      .trim()
      .min(1)
      .max(254)
      .refine(
        (value) => !/[\u0000-\u001f\u007f]/.test(value),
        'Enter one complete reference or email address.',
      ),
    cursor: z.string().max(1500).optional(),
  })
  .strict();
export const customerReference = (doc: DocumentSnapshot): string =>
  z
    .string()
    .min(1)
    .max(100)
    .parse(
      doc.get('orderReference') ??
        (doc.id.startsWith('purchase_') ? orderReference(doc.id) : doc.id),
    );
const cursorSchema = z
  .object({ q: z.string(), phase: z.number().int().min(0).max(5), after: supportId.nullable() })
  .strict();
const summarySchema = z.object({
  createdAt: z.iso.datetime(),
  email: z.email().nullish(),
  status: z.string().max(80),
  currency: z.enum(['USD', 'GBP', 'EUR']),
  totalCents: z.number().int().nonnegative().safe().optional(),
  amountCents: z.number().int().nonnegative().safe().optional(),
  items: z
    .array(
      z.object({
        quantity: z.number().int().positive().max(10),
        plan: z.object({ name: z.string().min(1).max(1000) }),
      }),
    )
    .min(1)
    .max(10)
    .optional(),
  plan: z.object({ name: z.string().min(1).max(1000) }).optional(),
});
type Source = {
  kind: 'email' | 'reference' | 'prefix' | 'supplier' | 'transaction';
  collection: 'purchases' | 'orders' | 'orderActivations';
  query: Query;
};
/** Bounded index queries and a cursor over matching records; no supplier calls or database scan. */
export class OperationsOrderSearchService {
  constructor(private db: Firestore) {}
  async search(raw: z.infer<typeof operationsSearchSchema>): Promise<OperationsOrderSearch> {
    const input = operationsSearchSchema.parse(raw);
    const email = z.email().safeParse(input.q);
    const q = email.success ? input.q.toLowerCase() : input.q;
    const referenceQuery = /^az-/i.test(q) ? q.toUpperCase() : q;
    if (/^(?:purchase|order)_[a-f0-9]{48}$/.test(q)) {
      if (input.cursor) throw new OperationsError('This order lookup has no next page.');
      const doc = await this.db
        .doc((q.startsWith('purchase_') ? 'purchases/' : 'orders/') + q)
        .get();
      const root = await this.root(doc);
      return { query: q, rows: root ? [await this.summary(root)] : [], nextCursor: null };
    }
    const sources: Source[] = [];
    const add = (kind: Source['kind'], collection: Source['collection'], field: string) =>
      sources.push({
        kind,
        collection,
        query: this.db
          .collection(collection)
          .where(field, '==', kind === 'reference' ? referenceQuery : q),
      });
    if (email.success) {
      add('email', 'purchases', 'email');
      add('email', 'orders', 'email');
    } else {
      if (referenceQuery.startsWith('AZ-')) {
        add('reference', 'purchases', 'orderReference');
        add('reference', 'orders', 'orderReference');
        if (/^AZ-(?:[A-F0-9]{4}-){3}[A-F0-9]{4}$/.test(referenceQuery)) {
          const prefix = 'purchase_' + referenceQuery.slice(3).replaceAll('-', '').toLowerCase();
          sources.push({
            kind: 'prefix',
            collection: 'purchases',
            query: this.db
              .collection('purchases')
              .where(FieldPath.documentId(), '>=', prefix)
              .where(FieldPath.documentId(), '<=', prefix + '\uf8ff'),
          });
        }
      }
      add('supplier', 'orders', 'supplierOrderNo');
      add('transaction', 'orderActivations', 'esimTranNo');
    }
    let phase = 0,
      after: string | null = null;
    if (input.cursor) {
      let cursor: z.infer<typeof cursorSchema>;
      try {
        cursor = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString()));
      } catch {
        throw new OperationsError('Invalid order search cursor.');
      }
      if (
        cursor.q !== q ||
        cursor.phase >= sources.length ||
        (cursor.after &&
          !cursor.after.startsWith(
            sources[cursor.phase].collection === 'purchases' ? 'purchase_' : 'order_',
          ))
      )
        throw new OperationsError('Search changed. Start a new order search.');
      phase = cursor.phase;
      after = cursor.after;
    }
    const rootCache = new Map<string, DocumentSnapshot>();
    const transactionRepresentatives = new Map<string, string | undefined>();
    const rows: OperationsOrderSummary[] = [],
      positions: string[] = [];
    const visited = new Set<string>();
    const siblings = new Map<string, DocumentSnapshot[]>();
    const units = async (root: DocumentSnapshot) => {
      if (root.ref.parent.id === 'orders') return [root];
      const cached = siblings.get(root.ref.path);
      if (cached) return cached;
      const docs = (
        await this.db
          .collection('orders')
          .where('parentOrderId', '==', root.id)
          .select('supplierOrderNo', 'test')
          .limit(11)
          .get()
      ).docs;
      if (docs.length > 10) throw new OperationsError('Order allocations require review.', 409);
      siblings.set(root.ref.path, docs);
      return docs;
    };
    const token = () => Buffer.from(JSON.stringify({ q, phase, after })).toString('base64url');
    let examined = 0;
    while (phase < sources.length && examined < 50) {
      const source = sources[phase];
      let query = source.query.orderBy(FieldPath.documentId());
      if (after) query = query.startAfter(after);
      const limit = Math.min(11, 50 - examined);
      const page = await query.limit(limit).get();
      if (!page.size) {
        phase++;
        after = null;
        continue;
      }
      for (const doc of page.docs) {
        after = doc.id;
        examined++;
        const root = await this.root(doc, rootCache);
        if (!root) continue;
        // Email/reference matches on allocated child orders are represented by the parent record.
        if (['email', 'reference'].includes(source.kind) && doc.get('parentOrderId')) continue;
        if (
          source.kind === 'prefix' &&
          (root.get('orderReference') || customerReference(root) !== referenceQuery)
        )
          continue;
        if (source.kind === 'supplier' || source.kind === 'transaction') {
          // A parent reference wins over a coincidentally identical supplier identifier.
          if (referenceQuery.startsWith('AZ-') && customerReference(root) === referenceQuery)
            continue;
          const family = await units(root);
          const supplierMatches = family
            .filter((u) => u.get('test') === false && u.get('supplierOrderNo') === q)
            .sort((a, b) => a.id.localeCompare(b.id));
          if (source.kind === 'supplier' && supplierMatches[0]?.id !== doc.id) continue;
          if (source.kind === 'transaction') {
            if (supplierMatches.length) continue;
            if (!transactionRepresentatives.has(root.ref.path)) {
              const activations = family.length
                ? await this.db.getAll(
                    ...family.map((u) => this.db.doc('orderActivations/' + u.id)),
                    { fieldMask: ['esimTranNo'] },
                  )
                : [];
              transactionRepresentatives.set(
                root.ref.path,
                activations
                  .filter((a) => a.exists && a.get('esimTranNo') === q)
                  .sort((a, b) => a.id.localeCompare(b.id))[0]?.id,
              );
            }
            if (transactionRepresentatives.get(root.ref.path) !== doc.id) continue;
          }
        }
        if (visited.has(root.ref.path)) continue;
        visited.add(root.ref.path);
        rows.push(await this.summary(root));
        positions.push(token());
        if (rows.length === 11)
          return { query: q, rows: rows.slice(0, 10), nextCursor: positions[9] };
      }
      if (page.size < limit) {
        phase++;
        after = null;
      }
    }
    return { query: q, rows, nextCursor: phase < sources.length ? token() : null };
  }
  private async root(
    doc: DocumentSnapshot,
    cache = new Map<string, DocumentSnapshot>(),
  ): Promise<DocumentSnapshot | null> {
    const read = async (path: string) => {
      const saved = cache.get(path);
      if (saved) return saved;
      const value = await this.db.doc(path).get();
      cache.set(path, value);
      return value;
    };
    if (!doc.exists) return null;
    let order = doc;
    if (doc.ref.parent.id === 'orderActivations')
      order = await read('orders/' + supportId.parse(doc.id));
    if (!order.exists || order.get('test') !== false) return null;
    const parent = order.get('parentOrderId');
    if (parent) {
      const root = await read('purchases/' + supportId.parse(parent));
      return root.exists && root.get('test') === false ? root : null;
    }
    return order;
  }
  private async summary(doc: DocumentSnapshot): Promise<OperationsOrderSummary> {
    const p = summarySchema.parse(doc.data());
    const amountMinor = p.totalCents ?? p.amountCents;
    if (amountMinor === undefined)
      throw new OperationsError('Historical order amount requires review.', 409);
    return {
      id: doc.id,
      esims: await operationsEsimReferences(this.db, doc),
      reference: customerReference(doc),
      createdAt: p.createdAt,
      email: p.email ?? null,
      paymentStatus: p.status,
      amountMinor,
      currency: p.currency,
      plans:
        p.items?.map((i) => ({ name: i.plan.name, quantity: i.quantity })) ??
        (p.plan ? [{ name: p.plan.name, quantity: 1 }] : []),
    };
  }
}
