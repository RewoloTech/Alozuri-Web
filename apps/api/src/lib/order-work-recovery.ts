import { FieldPath, type Firestore, type Query } from 'firebase-admin/firestore';
import { orderWorkSchema, WORK_TIMEOUT_MS, type OrderWork } from './order-task-queue.js';

type WorkReference = Pick<OrderWork, 'kind' | 'id'>;
// Only a reviewed migration or explicit operator recovery calls this helper.
// It never clears supplier references, payment evidence or email idempotency state.
export async function prepareOrderWork(db: Firestore, input: WorkReference, redrive = false) {
  const initial = orderWorkSchema.parse({ ...input, generation: 1 });
  return db.runTransaction(async (t) => {
    const ref = db.collection('orderWork').doc(initial.id);
    const [previous, source] = await Promise.all([
      t.get(ref),
      t.get(db.collection(initial.kind === 'purchase' ? 'purchases' : 'orders').doc(initial.id)),
    ]);
    if (!source.exists || source.get('test') !== false || !source.get('paidAt')) return null;
    if (initial.kind === 'purchase' && source.get('status') !== 'paid') return null;
    if (
      initial.kind === 'order' &&
      (source.get('parentOrderId') ||
        source.get('paymentBlocked') === true ||
        !['paid', 'fulfilling', 'provision_wait', 'provision_error', 'refund_pending'].includes(
          source.get('status'),
        ))
    )
      return null;
    if (previous.exists && !redrive)
      return orderWorkSchema.parse({
        kind: previous.get('kind'),
        id: previous.id,
        generation: previous.get('generation'),
      });
    if (
      previous.exists &&
      redrive &&
      (previous.get('leaseUntil') > Date.now() ||
        (previous.get('status') !== 'attention' && previous.get('deadlineAt') > Date.now()))
    )
      throw new Error('Active work cannot be redriven; inspect its existing task first.');
    const work = orderWorkSchema.parse({
      ...initial,
      generation: previous.exists ? Number(previous.get('generation')) + 1 : 1,
    });
    t.set(ref, {
      ...work,
      status: 'pending',
      createdAt: Date.now(),
      deadlineAt: Date.now() + WORK_TIMEOUT_MS,
      ...(previous.exists ? { recoveredAt: Date.now() } : {}),
    });
    return work;
  });
}

async function* pages(query: Query) {
  let batch = await query.limit(100).get();
  while (batch.size) {
    yield* batch.docs;
    batch = await query
      .startAfter(batch.docs[batch.size - 1])
      .limit(100)
      .get();
  }
}
// One-time migration inventory, not a recurring worker. Includes future retries.
export async function pendingOrderWork(db: Firestore): Promise<WorkReference[]> {
  const candidates = new Map<string, WorkReference>();
  for await (const job of pages(db.collection('fulfillmentJobs').orderBy(FieldPath.documentId()))) {
    const order = await db.collection('orders').doc(job.id).get();
    if (
      !order.exists ||
      order.get('test') !== false ||
      !order.get('paidAt') ||
      order.get('paymentBlocked') === true
    )
      continue;
    const parent: unknown = order.get('parentOrderId');
    const work =
      typeof parent === 'string'
        ? { kind: 'purchase' as const, id: parent }
        : { kind: 'order' as const, id: order.id };
    orderWorkSchema.parse({ ...work, generation: 1 });
    candidates.set(work.id, work);
  }
  for (const field of [
    'confirmationDueAt',
    'confirmationDeliveryDueAt',
    'contractEmailDueAt',
    'emailDueAt',
  ]) {
    for await (const purchase of pages(
      db
        .collection('purchases')
        .where(field, '<=', Number.MAX_SAFE_INTEGER)
        .orderBy(field)
        .orderBy(FieldPath.documentId()),
    )) {
      if (
        purchase.get('test') === false &&
        purchase.get('paidAt') &&
        purchase.get('status') === 'paid'
      )
        candidates.set(purchase.id, { kind: 'purchase', id: purchase.id });
    }
  }
  // Includes committed-but-undispatched payments whose Stripe retries were exhausted.
  for await (const intent of pages(
    db.collection('orderWork').where('status', '==', 'pending').orderBy(FieldPath.documentId()),
  )) {
    const work = orderWorkSchema.parse({
      kind: intent.get('kind'),
      id: intent.id,
      generation: intent.get('generation'),
    });
    candidates.set(work.id, { kind: work.kind, id: work.id });
  }
  return [...candidates.values()];
}
