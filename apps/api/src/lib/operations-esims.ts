import { operationsSupplier } from './operations-esim-reference.js';
import {
  OperationsOrderSearchService,
  operationsSearchSchema,
  customerReference,
} from './operations-order-search.js';
import { z } from 'zod';
import { type Firestore } from 'firebase-admin/firestore';
import { database } from './firebase.js';
import { purchaseOwnerUid } from './purchase-ownership.js';
import { SupplierClient } from './supplier.js';
import { EsimUsageService } from './usage.js';
import { OperationsError } from './operations-error.js';
import type { OperationsEsimDetails } from '../../../../packages/shared/src/financial.ts';
export const operationsLookupSchema = operationsSearchSchema.omit({ cursor: true });
const idSchema = z.string().regex(/^(?:purchase|order)_[a-f0-9]{48}$/);
const optionalReference = z.string().min(1).max(200).nullish();
export class OperationsEsims {
  constructor(
    private db: Firestore = database(),
    private usage = new EsimUsageService(db, new SupplierClient()),
  ) {}
  async search(input: z.infer<typeof operationsSearchSchema>) {
    return new OperationsOrderSearchService(this.db).search(input);
  }
  async lookup(q: string): Promise<OperationsEsimDetails> {
    const result = await this.search({ q });
    if (!result.rows.length) throw new OperationsError('Order not found.', 404);
    if (result.rows.length > 1 || result.nextCursor)
      throw new OperationsError('Select an order from the search results.', 409);
    return this.details(result.rows[0].id);
  }
  async details(input: string): Promise<OperationsEsimDetails> {
    const id = idSchema.parse(input);
    let parent = await this.db
      .doc((id.startsWith('purchase_') ? 'purchases/' : 'orders/') + id)
      .get();
    if (!parent.exists || parent.get('test') !== false)
      throw new OperationsError('Order not found.', 404);
    if (id.startsWith('order_') && parent.get('parentOrderId'))
      parent = await this.db.doc('purchases/' + idSchema.parse(parent.get('parentOrderId'))).get();
    if (!parent.exists || parent.get('test') !== false)
      throw new OperationsError('Order not found.', 404);
    const purchase = parent.ref.parent.id === 'purchases';
    const units = purchase
      ? (await this.db.collection('orders').where('parentOrderId', '==', parent.id).limit(11).get())
          .docs
      : [parent];
    if (units.length > 10) throw new OperationsError('Order allocations need review.', 409);
    const owner = purchase
      ? purchaseOwnerUid(parent.id, parent.get('uid') ?? null)
      : parent.get('uid');
    const rows: OperationsEsimDetails['units'] = [];
    for (const unit of units) {
      if (unit.get('test') !== false || unit.get('uid') !== owner)
        throw new OperationsError('eSIM ownership requires review.', 409);
      const activation = await this.db.doc('orderActivations/' + unit.id).get();
      if (activation.exists && activation.get('uid') !== owner)
        throw new OperationsError('eSIM ownership requires review.', 409);
      const supplier = operationsSupplier(unit);
      rows.push({
        id: unit.id,
        name: z.string().min(1).max(1000).parse(unit.get('plan')?.name),
        fulfilmentStatus: z.string().max(80).parse(unit.get('status')),
        supplier,
        amountMinor: z.number().int().nonnegative().safe().parse(unit.get('amountCents')),
        currency: z.enum(['USD', 'GBP', 'EUR']).parse(unit.get('currency')),
        supplierOrderNo: optionalReference.parse(unit.get('supplierOrderNo')) ?? null,
        esimTranNo: optionalReference.parse(activation.get('esimTranNo')) ?? null,
        usage:
          purchase && ['esimaccess', 'esim_access'].includes(supplier.id)
            ? await this.usage.getForOperations(parent.id, unit.id)
            : { state: 'unavailable', snapshot: null, stale: false },
      });
    }
    return {
      purchaseId: parent.id,
      reference: customerReference(parent),
      items: parent.get('items')
        ? z
            .array(
              z.object({
                quantity: z.number().int().positive().max(10),
                plan: z.object({ name: z.string().min(1).max(1000) }),
              }),
            )
            .min(1)
            .max(10)
            .parse(parent.get('items'))
            .map((i) => ({ name: i.plan.name, quantity: i.quantity }))
        : rows.map((u) => ({ name: u.name, quantity: 1 })),
      createdAt: z.iso.datetime().parse(parent.get('createdAt')),
      amountMinor: z
        .number()
        .int()
        .nonnegative()
        .safe()
        .parse(parent.get('totalCents') ?? parent.get('amountCents')),
      currency: z.enum(['USD', 'GBP', 'EUR']).parse(parent.get('currency')),
      fulfilmentStatus: !rows.length
        ? 'pending'
        : rows.every((u) => u.fulfilmentStatus === 'ready')
          ? 'fulfilled'
          : rows.every((u) => u.fulfilmentStatus === 'refunded')
            ? 'refunded'
            : rows.every((u) => u.fulfilmentStatus === 'cancelled')
              ? 'cancelled'
              : rows.some((u) => ['provision_error', 'refund_pending'].includes(u.fulfilmentStatus))
                ? 'needs_attention'
                : rows.some((u) => u.fulfilmentStatus === 'ready')
                  ? 'partially_fulfilled'
                  : rows.some((u) => ['fulfilling', 'provision_wait'].includes(u.fulfilmentStatus))
                    ? 'fulfilling'
                    : 'pending',
      email: z.email().nullish().parse(parent.get('email')) ?? null,
      paymentStatus: z.string().max(80).parse(parent.get('status')),
      units: rows,
    };
  }
}
