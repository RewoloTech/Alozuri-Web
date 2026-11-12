import { createHash } from 'node:crypto';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { type Firestore, type Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';

export const orderWorkSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('purchase'),
      id: z.string().regex(/^purchase_[a-f0-9]{48}$/),
      generation: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('order'),
      id: z.string().regex(/^order_[a-f0-9]{48}$/),
      generation: z.number().int().positive(),
    })
    .strict(),
]);
export type OrderWork = z.infer<typeof orderWorkSchema>;
export interface OrderTaskQueue {
  enqueue(work: OrderWork, runAfterAt?: number): Promise<void>;
}
export const WORK_TIMEOUT_MS = 24 * 60 * 60_000;

// The payment and its dispatch intent commit together. Stripe retries the webhook
// if task creation fails after commit; a seen event must still dispatch this intent.
export function recordOrderWork(t: Transaction, db: Firestore, work: OrderWork) {
  t.create(db.collection('orderWork').doc(work.id), {
    ...work,
    status: 'pending',
    createdAt: Date.now(),
    deadlineAt: Date.now() + WORK_TIMEOUT_MS,
  });
}
export async function dispatchOrderWork(db: Firestore, queue: OrderTaskQueue, id: string) {
  const ref = db.collection('orderWork').doc(id),
    doc = await ref.get();
  if (!doc.exists || doc.get('status') !== 'pending') return false;
  const work = orderWorkSchema.parse({
    kind: doc.get('kind'),
    id: doc.id,
    generation: doc.get('generation'),
  });
  try {
    await queue.enqueue(
      work,
      typeof doc.get('runAfterAt') === 'number' ? doc.get('runAfterAt') : undefined,
    );
    await db.runTransaction(async (t) => {
      const current = await t.get(ref);
      // A fast task may already be running or finished. Never undo its status.
      if (current.get('generation') === work.generation && current.get('status') === 'pending')
        t.update(ref, { status: 'queued', queuedAt: Date.now() });
    });
    return true;
  } catch {
    // No secrets or customer data in the exception returned to Stripe/logs.
    throw new Error('Order queue dispatch unavailable; webhook must be retried.');
  }
}

export type OrderTaskConfig = {
  queue: string;
  workerUrl: string;
  audience: string;
  serviceAccount: string;
};
export function orderTaskConfig(env: NodeJS.ProcessEnv = process.env): OrderTaskConfig | null {
  if (env.ORDER_PROCESSING_MODE === undefined || env.ORDER_PROCESSING_MODE === 'scheduler')
    return null;
  if (env.ORDER_PROCESSING_MODE !== 'queue') throw new Error('Invalid order processing mode.');
  const config = z
    .object({
      queue: z
        .string()
        .regex(/^projects\/[a-z][a-z0-9-]+\/locations\/[a-z0-9-]+\/queues\/[a-zA-Z0-9-]{1,100}$/),
      workerUrl: z.url(),
      audience: z.url(),
      serviceAccount: z.email(),
    })
    .parse({
      queue: env.ORDER_TASK_QUEUE,
      workerUrl: env.ORDER_TASK_WORKER_URL,
      audience: env.ORDER_TASK_AUDIENCE,
      serviceAccount: env.ORDER_TASK_SERVICE_ACCOUNT,
    });
  const project = config.queue.split('/')[1];
  if (
    !config.serviceAccount.endsWith('@' + project + '.iam.gserviceaccount.com') ||
    (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== project)
  )
    throw new Error('Order queue and task identity must belong to this project.');
  const worker = new URL(config.workerUrl),
    audience = new URL(config.audience);
  if (
    worker.protocol !== 'https:' ||
    worker.username ||
    worker.password ||
    worker.search ||
    worker.hash ||
    worker.pathname !== '/internal/orders/process' ||
    config.audience !== worker.origin ||
    audience.protocol !== 'https:'
  )
    throw new Error('Invalid order task target.');
  return config;
}
export function orderTaskName(work: OrderWork) {
  return (
    'order-' +
    createHash('sha256')
      .update(JSON.stringify(orderWorkSchema.parse(work)))
      .digest('hex')
  );
}
type TaskRequest = { url: string; method: 'POST'; timeout: number; retry: false; data: unknown };
export type TaskTransport = (request: TaskRequest) => Promise<unknown>;
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-tasks'] });
export class CloudOrderTaskQueue implements OrderTaskQueue {
  constructor(
    private config: OrderTaskConfig,
    private request: TaskTransport = async (request) => (await auth.getClient()).request(request),
  ) {}
  async enqueue(input: OrderWork, runAfterAt?: number) {
    const work = orderWorkSchema.parse(input);
    try {
      await this.request({
        url: `https://cloudtasks.googleapis.com/v2/${this.config.queue}/tasks`,
        method: 'POST',
        timeout: 10_000,
        retry: false,
        data: {
          task: {
            ...(runAfterAt !== undefined
              ? { scheduleTime: new Date(runAfterAt).toISOString() }
              : {}),
            name: `${this.config.queue}/tasks/${orderTaskName(work)}`,
            dispatchDeadline: '300s',
            httpRequest: {
              url: this.config.workerUrl,
              httpMethod: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: Buffer.from(JSON.stringify(work)).toString('base64'),
              oidcToken: {
                serviceAccountEmail: this.config.serviceAccount,
                audience: this.config.audience,
              },
            },
          },
        },
      });
    } catch (error) {
      // Named tasks de-duplicate ambiguous create timeouts and concurrent webhook replays.
      if (
        z
          .object({
            response: z.object({
              status: z.literal(409),
              data: z.object({
                error: z.object({ status: z.literal('ALREADY_EXISTS') }),
              }),
            }),
          })
          .safeParse(error).success
      )
        return;
      throw new Error('Order task could not be created.');
    }
  }
}
export function configuredOrderTaskQueue(): OrderTaskQueue | null {
  const config = orderTaskConfig();
  return config ? new CloudOrderTaskQueue(config) : null;
}
export async function verifyOrderTaskIdentity(header: string | undefined) {
  const config = orderTaskConfig();
  if (!config || !header?.startsWith('Bearer ')) return false;
  try {
    const ticket = await new OAuth2Client().verifyIdToken({
      idToken: header.slice(7),
      audience: config.audience,
    });
    const payload = ticket.getPayload();
    return payload?.email === config.serviceAccount && payload.email_verified === true;
  } catch {
    return false;
  }
}
