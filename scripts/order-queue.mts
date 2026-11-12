// Defaults to inventory only. --apply writes dispatch intents and submits tasks.
// No service/queue/IAM creation or customer/supplier calls are performed here.
import { deleteApp, getApps } from 'firebase-admin/app';
import { database } from '../apps/api/src/lib/firebase.ts';
import { pendingOrderWork, prepareOrderWork } from '../apps/api/src/lib/order-work-recovery.ts';
import {
  configuredOrderTaskQueue,
  dispatchOrderWork,
  orderWorkSchema,
} from '../apps/api/src/lib/order-task-queue.ts';

const args = process.argv.slice(2),
  apply = args.includes('--apply'),
  redrive = args.includes('--redrive');
const idArg = args.find((arg) => arg.startsWith('--id='));
if (
  args.some((arg) => !['--apply', '--redrive'].includes(arg) && !arg.startsWith('--id=')) ||
  args.filter((arg) => arg.startsWith('--id=')).length > 1 ||
  (redrive && !idArg)
)
  throw new Error('Use [--apply] [--id=purchase_…|order_…] [--redrive with --id].');
if (!process.env.GOOGLE_CLOUD_PROJECT) throw new Error('Set GOOGLE_CLOUD_PROJECT explicitly.');
const queue = apply ? configuredOrderTaskQueue() : null;
if (apply && !queue)
  throw new Error(
    'Configure ORDER_PROCESSING_MODE=queue and the approved task settings before applying.',
  );
const db = database();
try {
  const id = idArg?.slice('--id='.length);
  const work = id
    ? [
        orderWorkSchema.parse({
          id,
          kind: id.startsWith('purchase_') ? 'purchase' : 'order',
          generation: 1,
        }),
      ]
    : await pendingOrderWork(db);
  let submitted = 0,
    skipped = 0;
  if (apply && queue)
    for (const candidate of work) {
      const prepared = await prepareOrderWork(db, candidate, redrive);
      if (!prepared) {
        skipped++;
        continue;
      }
      if (await dispatchOrderWork(db, queue, prepared.id)) submitted++;
      else skipped++;
    }
  console.log(
    JSON.stringify({
      mode: apply ? 'applied' : 'read-only',
      candidates: work.length,
      purchases: work.filter((w) => w.kind === 'purchase').length,
      legacyOrders: work.filter((w) => w.kind === 'order').length,
      submitted,
      skipped,
      redrive,
    }),
  );
} finally {
  await db.terminate();
  await Promise.all(getApps().map((app) => deleteApp(app)));
}
