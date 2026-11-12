import { randomUUID } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { CommerceService } from './commerce.js';
import type { FulfillmentService } from './fulfillment.js';
import {
  dispatchOrderWork,
  orderWorkSchema,
  type OrderWork,
  type OrderTaskQueue,
} from './order-task-queue.js';

export type OrderWorkResult = {
  state: 'complete' | 'scheduled' | 'pending' | 'attention' | 'ignored';
};
const workLeaseMs = 6 * 60_000;
export class OrderWorker {
  constructor(
    private db: Firestore,
    private commerce: Pick<CommerceService, 'notify'>,
    private fulfillment: Pick<FulfillmentService, 'run'>,
    private queue: OrderTaskQueue,
    private now: () => number = Date.now,
  ) {}
  async run(input: OrderWork): Promise<OrderWorkResult> {
    const work = orderWorkSchema.parse(input),
      ref = this.db.collection('orderWork').doc(work.id),
      lease = randomUUID();
    const claimed = await this.db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (
        !doc.exists ||
        doc.get('kind') !== work.kind ||
        ['done', 'attention'].includes(doc.get('status'))
      )
        return 'ignored';
      if (doc.get('generation') < work.generation) return 'ignored';
      if (doc.get('leaseUntil') > this.now()) return 'busy';
      if (typeof doc.get('deadlineAt') !== 'number' || doc.get('deadlineAt') <= this.now()) {
        t.update(ref, {
          status: 'attention',
          reason: 'processing_deadline_exceeded',
          leaseUntil: 0,
        });
        return 'attention';
      }
      if (doc.get('generation') !== work.generation)
        return doc.get('status') === 'pending' ? 'repair' : 'ignored';
      if (doc.get('runAfterAt') > this.now()) return 'busy';
      t.update(ref, {
        status: 'running',
        lease,
        leaseUntil: this.now() + workLeaseMs,
        attempts: Number(doc.get('attempts') || 0) + 1,
        lastAttemptAt: this.now(),
      });
      return 'claimed';
    });
    if (claimed === 'repair') {
      await dispatchOrderWork(this.db, this.queue, work.id);
      return { state: 'scheduled' };
    }
    if (claimed !== 'claimed') return { state: claimed === 'busy' ? 'pending' : claimed };
    const finish = async (
      state: 'complete' | 'pending' | 'attention',
      reason?: string,
      runAfterAt = this.now() + 30_000,
    ): Promise<OrderWorkResult> => {
      await this.db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if (doc.get('generation') !== work.generation || doc.get('lease') !== lease)
          throw new Error('Order processing lease unavailable.');
        t.update(ref, {
          status: state === 'complete' ? 'done' : state,
          ...(state === 'pending' ? { generation: work.generation + 1, runAfterAt } : {}),
          leaseUntil: 0,
          updatedAt: this.now(),
          reason: reason ?? FieldValue.delete(),
        });
      });
      if (state === 'pending') {
        await dispatchOrderWork(this.db, this.queue, work.id);
        return { state: 'scheduled' };
      }
      return { state };
    };
    try {
      let ids: string[];
      if (work.kind === 'purchase') {
        const purchase = await this.db.collection('purchases').doc(work.id).get();
        if (!purchase.exists || purchase.get('test') !== false || !purchase.get('paidAt'))
          return finish('attention', 'verified_live_payment_required');
        if (['cancelled', 'refunded', 'refund_pending'].includes(purchase.get('status')))
          return finish('complete');
        if (purchase.get('status') !== 'paid') return finish('attention', 'payment_needs_review');
        const units = await this.db
          .collection('orders')
          .where('parentOrderId', '==', work.id)
          .limit(11)
          .get();
        if (!units.size || units.size > 10) return finish('attention', 'order_units_need_review');
        ids = units.docs.map((doc) => doc.id);
        // Target one immutable purchase, never scan or send another customer's email.
        await this.commerce.notify(work.id);
      } else {
        const order = await this.db.collection('orders').doc(work.id).get();
        if (
          !order.exists ||
          order.get('test') !== false ||
          !order.get('paidAt') ||
          order.get('parentOrderId')
        )
          return finish('attention', 'verified_legacy_order_required');
        ids = [work.id];
      }
      const beforeJobs = await this.db.getAll(
        ...ids.map((id) => this.db.collection('fulfillmentJobs').doc(id)),
      );
      const dueIds = beforeJobs
        .filter(
          (job) =>
            job.exists &&
            job.get('nextAttemptAt') <= this.now() &&
            !(job.get('leaseUntil') > this.now()),
        )
        .map((job) => job.id);
      await this.fulfillment.run(dueIds);
      const jobs = await this.db.getAll(
        ...ids.map((id) => this.db.collection('fulfillmentJobs').doc(id)),
      );
      let emailPending = false;
      let emailDueAt = this.now() + 30_000;
      if (work.kind === 'purchase') {
        const purchase = await this.db.collection('purchases').doc(work.id).get();
        if (
          purchase.get('confirmationStatus') === 'attention' ||
          purchase.get('confirmationDeliveryStatus') === 'failed'
        )
          return finish('attention', 'confirmation_needs_review');
        emailPending =
          purchase.get('confirmationVersion') === 'email-v1' &&
          purchase.get('confirmationDeliveryStatus') !== 'delivered';
        const times: unknown[] = [
          'confirmationDueAt',
          'confirmationDeliveryDueAt',
          'confirmationLeaseUntil',
        ].map((field) => purchase.get(field));
        const due = times.filter(
          (time): time is number => typeof time === 'number' && time > this.now(),
        );
        if (due.length) emailDueAt = Math.min(...due);
      }
      const units = await this.db.getAll(...ids.map((id) => this.db.collection('orders').doc(id)));
      if (
        units.some(
          (unit) => unit.get('paymentBlocked') === true && unit.get('status') !== 'refunded',
        )
      )
        return finish('attention', 'order_needs_review');
      const queuedIds = new Set(jobs.filter((job) => job.exists).map((job) => job.id));
      if (
        units.some(
          (unit) =>
            !unit.exists ||
            (!['ready', 'refunded'].includes(unit.get('status')) && !queuedIds.has(unit.id)),
        )
      )
        return finish('attention', 'missing_fulfillment_work');
      const activeJobs = jobs.filter((job) => job.exists);
      const dueAt = activeJobs.length
        ? Math.min(
            ...activeJobs.map((job) =>
              Math.max(Number(job.get('nextAttemptAt')) || 0, Number(job.get('leaseUntil')) || 0),
            ),
          )
        : this.now() + 30_000;
      return finish(
        emailPending || activeJobs.length ? 'pending' : 'complete',
        undefined,
        Math.max(this.now() + 15_000, emailPending ? emailDueAt : dueAt),
      );
    } catch {
      // Keep durable work recoverable; Cloud Tasks retries a non-2xx response.
      await this.db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if (doc.get('generation') === work.generation && doc.get('lease') === lease)
          t.update(ref, {
            status: 'retry',
            leaseUntil: 0,
            reason: 'processing_temporarily_unavailable',
          });
      });
      throw new Error('Order processing temporarily unavailable.');
    }
  }
}
