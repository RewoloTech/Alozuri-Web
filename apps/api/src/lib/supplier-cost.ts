import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import { documentId } from './validation.js';

/** Transaction evidence, never a catalogue price or a browser-submitted amount. */
export const supplierChargeSchema = z
  .object({
    amountUnits: z.number().int().nonnegative().safe(),
    currency: z.literal('USD'),
    supplierOrderNo: z.string().trim().min(1).max(200),
    source: z.literal('supplier_statement'),
    reference: z.string().trim().min(1).max(200),
    verifiedAt: z.iso.datetime(),
  })
  .strict();
export const supplierChargeInputSchema = supplierChargeSchema.omit({ verifiedAt: true });

/** Trusted operator only. Replays are harmless; conflicting evidence requires review. */
export async function recordSupplierCharge(
  db: Firestore,
  orderId: string,
  input: unknown,
  apply = true,
) {
  const id = documentId.parse(orderId);
  const charge = supplierChargeInputSchema.parse(input);
  const ref = db.collection('orders').doc(id);
  return db.runTransaction(async (t) => {
    const order = await t.get(ref);
    if (
      !order.exists ||
      order.get('test') !== false ||
      !order.get('paidAt') ||
      order.get('supplierOrderNo') !== charge.supplierOrderNo
    )
      throw new Error('Verified live supplier order required.');
    const parentId = order.get('parentOrderId');
    const parentRef = parentId ? db.collection('purchases').doc(documentId.parse(parentId)) : ref;
    if (parentId) {
      const parent = await t.get(parentRef);
      if (!parent.exists || parent.get('test') !== false || !parent.get('paidAt'))
        throw new Error('Verified parent purchase required.');
    }
    const existing = order.get('supplierCharge');
    if (existing) {
      const previous = supplierChargeSchema.parse(existing);
      if (
        previous.amountUnits !== charge.amountUnits ||
        previous.currency !== charge.currency ||
        previous.supplierOrderNo !== charge.supplierOrderNo ||
        previous.source !== charge.source ||
        previous.reference !== charge.reference
      )
        throw new Error('Conflicting supplier charge evidence requires review.');
    } else if (apply) {
      t.update(ref, { supplierCharge: { ...charge, verifiedAt: new Date().toISOString() } });
    }
    return parentRef;
  });
}
