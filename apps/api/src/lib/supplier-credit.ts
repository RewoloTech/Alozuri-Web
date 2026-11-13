import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { supplierChargeSchema } from './supplier-cost.js';
import { OperationsError } from './operations-error.js';
export const supplierCreditInput = z
  .object({
    amountUsd: z
      .string()
      .trim()
      .regex(/^\d{1,10}(?:\.\d{1,4})?$/),
    reference: z.string().trim().min(1).max(200),
    expectedVersion: z.number().int().nonnegative().safe(),
    requestId: z.uuid(),
  })
  .strict();
export const supplierCreditSchema = z.object({
  amountUnits: z.number().int().nonnegative().safe(),
  reference: z.string().min(1).max(200),
  version: z.number().int().positive().safe(),
  recordedBy: z.string().min(1),
  recordedAt: z.iso.datetime(),
});
export function creditUnits(amount: string): number {
  const parsed = supplierCreditInput.shape.amountUsd.parse(amount);
  const [whole, fraction = ''] = parsed.split('.');
  return z
    .number()
    .int()
    .nonnegative()
    .safe()
    .parse(Number(BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'))));
}
export async function recordSupplierCredit(db: Firestore, id: string, raw: unknown, actor: string) {
  z.string()
    .regex(/^order_[a-f0-9]{48}$/)
    .parse(id);
  const input = supplierCreditInput.parse(raw),
    amountUnits = creditUnits(input.amountUsd);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([amountUnits, input.reference, input.expectedVersion, actor]))
    .digest('hex');
  const ref = db.doc('orders/' + id),
    audit = ref.collection('supplierCreditHistory').doc(input.requestId);
  return db.runTransaction(async (t) => {
    const [order, replay] = await Promise.all([t.get(ref), t.get(audit)]);
    if (
      !order.exists ||
      order.get('test') !== false ||
      !order.get('paidAt') ||
      !order.get('supplierOrderNo')
    )
      throw new OperationsError('A paid live eSIM with a supplier order is required.');
    const parentId = order.get('parentOrderId');
    if (parentId)
      z.string()
        .regex(/^purchase_[a-f0-9]{48}$/)
        .parse(parentId);
    const parentRef = parentId ? db.doc('purchases/' + parentId) : ref;
    const parent = parentId ? await t.get(parentRef) : order;
    if (!parent.exists || parent.get('test') !== false || !parent.get('paidAt'))
      throw new OperationsError('Paid parent order required.');
    if (replay.exists) {
      if (replay.get('fingerprint') !== fingerprint)
        throw new OperationsError('Request changed. Refresh the order.', 409);
      return parentRef;
    }
    const previous = order.get('supplierCredit')
      ? supplierCreditSchema.parse(order.get('supplierCredit'))
      : null;
    if ((previous?.version ?? 0) !== input.expectedVersion)
      throw new OperationsError('Supplier credit changed. Refresh the order before saving.', 409);
    const charge = supplierChargeSchema.safeParse(order.get('supplierCharge'));
    const original =
      charge.success && charge.data.supplierOrderNo === order.get('supplierOrderNo')
        ? charge.data.amountUnits
        : z.number().int().positive().safe().parse(order.get('wholesaleUnits'));
    if (amountUnits > original)
      throw new OperationsError(
        'Supplier credit cannot exceed the recorded original supplier cost.',
      );
    const credit = supplierCreditSchema.parse({
      amountUnits,
      reference: input.reference,
      version: input.expectedVersion + 1,
      recordedBy: actor,
      recordedAt: new Date().toISOString(),
    });
    t.create(audit, {
      ...credit,
      fingerprint,
      previousAmountUnits: previous?.amountUnits ?? 0,
      supplierOrderNo: order.get('supplierOrderNo'),
    });
    t.update(ref, { supplierCredit: credit });
    t.update(parentRef, { supplierFinancialPending: true });
    return parentRef;
  });
}
