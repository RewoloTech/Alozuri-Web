import { z } from 'zod';
import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import type { OperationsEsimReference } from '../../../../packages/shared/src/financial.ts';
import { purchaseOwnerUid } from './purchase-ownership.js';
import { OperationsError } from './operations-error.js';
export function operationsSupplier(unit: DocumentSnapshot) {
  const id = z
    .string()
    .min(1)
    .max(100)
    .parse(
      unit.get('supplierId') ??
        unit.get('plan')?.supplier ??
        unit.get('fulfillmentMode') ??
        'esimaccess',
    );
  const name = z
    .string()
    .min(1)
    .max(200)
    .parse(
      unit.get('supplierDisplayName') ??
        (['esimaccess', 'esim_access'].includes(id) ? 'eSIM Access' : id),
    );
  return { id, name };
}
/** Provider + its exact Tran No identifies each allocated profile without fetching credentials or usage. */
export async function operationsEsimReferences(
  db: Firestore,
  root: DocumentSnapshot,
): Promise<OperationsEsimReference[]> {
  const purchase = root.ref.parent.id === 'purchases';
  const units = purchase
    ? (
        await db
          .collection('orders')
          .where('parentOrderId', '==', root.id)
          .select(
            'uid',
            'test',
            'plan.name',
            'plan.supplier',
            'supplierId',
            'supplierDisplayName',
            'fulfillmentMode',
          )
          .limit(11)
          .get()
      ).docs
    : [root];
  if (units.length > 10) throw new OperationsError('Order allocations require review.', 409);
  if (!units.length) return [];
  const owner = purchase ? purchaseOwnerUid(root.id, root.get('uid') ?? null) : root.get('uid');
  const activations = await db.getAll(...units.map((u) => db.doc('orderActivations/' + u.id)), {
    fieldMask: ['esimTranNo', 'uid'],
  });
  return units.map((unit, i) => {
    if (
      unit.get('test') !== false ||
      unit.get('uid') !== owner ||
      (activations[i].exists && activations[i].get('uid') !== owner)
    )
      throw new OperationsError('eSIM ownership requires review.', 409);
    return {
      id: unit.id,
      name: z.string().min(1).max(1000).parse(unit.get('plan')?.name),
      supplier: operationsSupplier(unit),
      esimTranNo:
        z.string().min(1).max(200).nullish().parse(activations[i].get('esimTranNo')) ?? null,
    };
  });
}
