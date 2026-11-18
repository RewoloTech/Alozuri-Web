import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { activationSchema, SupplierClient } from './supplier.js';
import { OperationsError } from './operations-error.js';
import {
  configuredOrderTaskQueue,
  dispatchOrderWork,
  WORK_TIMEOUT_MS,
  type OrderTaskQueue,
} from './order-task-queue.js';

const timestamp = z
  .string()
  .refine(
    (value) => /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) && Number.isFinite(Date.parse(value)),
    'A timestamp with an explicit timezone is required.',
  );
export const topupReconciliationInput = z
  .object({
    requestId: z.uuid(),
    supplierConfirmed: z.literal(true),
    evidenceReference: z
      .string()
      .trim()
      .min(5)
      .max(200)
      .regex(/^[^\r\n]+$/),
    receipt: z
      .object({
        transactionId: z.string().min(1).max(50),
        iccid: z.string().regex(/^\d{15,25}$/),
        expiredTime: timestamp,
        topUpEsimTranNo: z.string().min(1).max(200),
      })
      .strict(),
  })
  .strict();

/** Manual, evidence-based settlement only. This never calls a supplier mutation.
 * A profile balance/expiry change alone is not proof that a transaction succeeded.
 * An operator must first obtain the receipt for THIS transaction from the supplier.
 */
export class TopupReconciliation {
  constructor(
    private db: Firestore,
    private supplier: Pick<SupplierClient, 'topupProfile'> = new SupplierClient(),
    private now = Date.now,
    private queue: OrderTaskQueue | null = configuredOrderTaskQueue(),
  ) {}
  async confirm(id: string, raw: unknown, actor: string) {
    z.string()
      .regex(/^order_[a-f0-9]{48}$/)
      .parse(id);
    z.string().min(1).max(128).parse(actor);
    const input = topupReconciliationInput.parse(raw);
    const orderRef = this.db.doc('orders/' + id);
    const order = await orderRef.get();
    if (
      !order.exists ||
      order.get('test') !== false ||
      !order.get('paidAt') ||
      order.get('repeatDecision.method') !== 'TOPUP' ||
      order.get('topupAttempted') !== true ||
      order.get('supplierTransactionId') !== input.receipt.transactionId
    )
      throw new OperationsError('A matching paid live top-up attempt is required.', 409);
    const uid = z.string().min(1).parse(order.get('uid'));
    const purchaseId = z
      .string()
      .regex(/^purchase_[a-f0-9]{48}$/)
      .parse(order.get('parentOrderId'));
    const purchaseRef = this.db.doc('purchases/' + purchaseId);
    const workRef = this.db.doc('orderWork/' + purchaseId);
    const profileId = z
      .string()
      .regex(/^order_[a-f0-9]{48}$/)
      .parse(order.get('repeatDecision.profileOrderId'));
    const profileRef = this.db.doc('orderActivations/' + profileId);
    const profileRecord = await profileRef.get();
    if (profileRecord.get('uid') !== uid)
      throw new OperationsError('Profile ownership requires review.', 409);
    const activation = activationSchema.parse(profileRecord.data());
    if (activation.iccid !== input.receipt.iccid)
      throw new OperationsError('Supplier receipt profile does not match.', 409);
    const live = await this.supplier.topupProfile(activation.esimTranNo);
    if (
      live.esimTranNo !== activation.esimTranNo ||
      live.iccid !== activation.iccid ||
      !live.expiredTime ||
      !timestamp.safeParse(live.expiredTime).success ||
      Date.parse(live.expiredTime) < Date.parse(input.receipt.expiredTime)
    )
      throw new OperationsError(
        'Supplier profile does not corroborate the confirmed receipt.',
        409,
      );
    const sharedRef = this.db.doc(
      'serviceLocks/topup_' + createHash('sha256').update(activation.esimTranNo).digest('hex'),
    );
    const auditRef = orderRef.collection('topupReconciliations').doc(input.requestId);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ ...input, actor }))
      .digest('hex');
    const receipt = {
      transactionId: input.receipt.transactionId,
      supplierReference: input.receipt.topUpEsimTranNo,
      expiresAt: new Date(input.receipt.expiredTime).toISOString(),
    };
    await this.db.runTransaction(async (t) => {
      const [current, profile, shared, audit, purchase, work, job, original] = await t.getAll(
        orderRef,
        profileRef,
        sharedRef,
        auditRef,
        purchaseRef,
        workRef,
        this.db.doc('fulfillmentJobs/' + id),
        this.db.doc('orders/' + profileId),
      );
      if (audit.exists) {
        if (audit.get('fingerprint') !== fingerprint)
          throw new OperationsError('Reconciliation request changed.', 409);
        return;
      }
      if (
        current.get('topupReceipt') ||
        current.get('test') !== false ||
        current.get('uid') !== uid ||
        !current.get('paidAt') ||
        current.get('supplierTransactionId') !== receipt.transactionId ||
        current.get('topupState') !== 'TOPUP_PENDING_RECONCILIATION' ||
        current.get('repeatDecision.profileOrderId') !== profileId ||
        shared.get('uid') !== uid ||
        shared.get('orderId') !== id ||
        profile.get('uid') !== uid ||
        profile.get('iccid') !== activation.iccid ||
        profile.get('esimTranNo') !== activation.esimTranNo ||
        profile.get('topUpHistoryKnown') !== true ||
        profile.get('topUpCount') > shared.get('count') ||
        profile.get('topupLockOrderId') !== id ||
        original.get('uid') !== uid ||
        original.get('supplierOrderNo') !== live.orderNo ||
        current.get('parentOrderId') !== purchaseId ||
        purchase.get('uid') !== uid ||
        purchase.get('test') !== false ||
        !purchase.get('paidAt') ||
        work.get('leaseUntil') > this.now() ||
        job.get('leaseUntil') > this.now()
      )
        throw new OperationsError('Top-up state changed. Review the order before settling.', 409);
      const count = z.number().int().min(0).max(8).parse(shared.get('count')) + 1;
      const { topupLockOrderId: _lock, ...data } = profile.data()!;
      void _lock;
      t.set(profileRef, {
        ...data,
        topUpCount: count,
        expiresAt: new Date(live.expiredTime!).toISOString(),
        lastSupplierSyncAt: this.now(),
      });
      t.set(sharedRef, { uid, count });
      t.set(this.db.doc('orderActivations/' + id), { ...activation, uid });
      const blocked =
        current.get('paymentBlocked') === true ||
        ['refunded', 'refund_pending', 'cancelled'].includes(current.get('status')) ||
        purchase.get('paymentBlocked') === true ||
        purchase.get('status') !== 'paid';
      t.update(orderRef, {
        topupReceipt: receipt,
        supplierAttempted: true,
        supplierOrderNo: live.orderNo,
        topupState: 'TOPUP_SUCCESSFUL',
        status: blocked ? current.get('status') : 'ready',
        readyAt: new Date(this.now()).toISOString(),
      });
      t.create(auditRef, {
        fingerprint,
        recordedBy: actor,
        recordedAt: new Date(this.now()).toISOString(),
        supplierEvidenceReference: input.evidenceReference,
        supplierConfirmed: true,
        receipt,
      });
      t.delete(this.db.doc('fulfillmentJobs/' + id));
      if (!blocked && purchase.get('status') === 'paid') {
        t.set(workRef, {
          kind: 'purchase',
          id: purchaseId,
          generation:
            z
              .number()
              .int()
              .nonnegative()
              .parse(work.get('generation') ?? 0) + 1,
          status: 'pending',
          createdAt: this.now(),
          recoveredAt: this.now(),
          deadlineAt: this.now() + WORK_TIMEOUT_MS,
          runAfterAt: this.now(),
        });
      }
    });
    // Existing worker sends the receipt and refreshes financial records. Failed
    // dispatch leaves a durable pending intent; replaying this request retries it.
    if (this.queue) await dispatchOrderWork(this.db, this.queue, purchaseId);
    return { confirmed: true as const };
  }
}
