import test from 'node:test';
import assert from 'node:assert/strict';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import {
  CloudOrderTaskQueue,
  orderTaskConfig,
  orderTaskName,
  verifyOrderTaskIdentity,
  type OrderWork,
  type OrderTaskConfig,
} from '../src/lib/order-task-queue.js';

const work: OrderWork = { kind: 'purchase', id: 'purchase_' + 'a'.repeat(48), generation: 1 };
const config: OrderTaskConfig = {
  queue: 'projects/demo-alozuri/locations/europe-west4/queues/order-processing',
  workerUrl: 'https://api.example.com/internal/orders/process',
  audience: 'https://api.example.com',
  serviceAccount: 'order-worker@demo-alozuri.iam.gserviceaccount.com',
};
const queueEnv = {
  ORDER_PROCESSING_MODE: 'queue',
  ORDER_TASK_QUEUE: config.queue,
  ORDER_TASK_WORKER_URL: config.workerUrl,
  ORDER_TASK_AUDIENCE: config.audience,
  ORDER_TASK_SERVICE_ACCOUNT: config.serviceAccount,
};
test('queue activation is opt-in; incomplete configuration fails closed', () => {
  assert.equal(orderTaskConfig({}), null);
  assert.equal(orderTaskConfig({ ORDER_PROCESSING_MODE: 'scheduler' }), null);
  assert.throws(() => orderTaskConfig({ ORDER_PROCESSING_MODE: 'queue' }));
  assert.throws(() => orderTaskConfig({ ...queueEnv, ORDER_PROCESSING_MODE: 'typo' }));
  assert.deepEqual(orderTaskConfig(queueEnv), config);
  for (const url of [
    'http://api.example.com/internal/orders/process',
    'https://api.example.com/other',
    'https://user:password@api.example.com/internal/orders/process',
    config.workerUrl + '?token=secret',
  ])
    assert.throws(() => orderTaskConfig({ ...queueEnv, ORDER_TASK_WORKER_URL: url }));
  assert.throws(() =>
    orderTaskConfig({ ...queueEnv, ORDER_TASK_AUDIENCE: 'https://other.example.com' }),
  );
});
test('named tasks carry only a typed work reference and use the configured service identity', async () => {
  const requests: unknown[] = [];
  const queue = new CloudOrderTaskQueue(config, async (request) => {
    requests.push(request);
  });
  await queue.enqueue(work);
  await queue.enqueue(work);
  assert.deepEqual(requests[0], requests[1]);
  const request = z
    .object({
      url: z.string(),
      retry: z.literal(false),
      timeout: z.literal(10000),
      data: z.object({
        task: z.object({
          name: z.string(),
          httpRequest: z.object({
            body: z.string(),
            oidcToken: z.object({ serviceAccountEmail: z.string(), audience: z.string() }),
          }),
        }),
      }),
    })
    .parse(requests[0]);
  assert.deepEqual(
    JSON.parse(Buffer.from(request.data.task.httpRequest.body, 'base64').toString()),
    work,
  );
  assert.deepEqual(request.data.task.httpRequest.oidcToken, {
    serviceAccountEmail: config.serviceAccount,
    audience: config.audience,
  });
  assert.equal(request.data.task.name, config.queue + '/tasks/' + orderTaskName(work));
  assert.notEqual(orderTaskName({ ...work, generation: 2 }), orderTaskName(work));
  assert.match(orderTaskName(work), /^order-[a-f0-9]{64}$/);
  const later = Date.now() + 60_000;
  await queue.enqueue({ ...work, generation: 2 }, later);
  const scheduled = z
    .object({ data: z.object({ task: z.object({ scheduleTime: z.string() }) }) })
    .parse(requests[2]);
  assert.equal(scheduled.data.task.scheduleTime, new Date(later).toISOString());
});
test('only ALREADY_EXISTS is acknowledged; quota/auth/server failures remain retryable by Stripe', async () => {
  for (const status of [409, 403, 429, 500]) {
    const queue = new CloudOrderTaskQueue(config, async () => {
      throw {
        response: {
          status,
          data: { error: { status: status === 409 ? 'ALREADY_EXISTS' : 'UNKNOWN' } },
        },
      };
    });
    if (status === 409) await queue.enqueue(work);
    else await assert.rejects(queue.enqueue(work), /could not be created/);
  }
});
test('a conflicting response without ALREADY_EXISTS cannot lose a dispatch intent', async () => {
  const queue = new CloudOrderTaskQueue(config, async () => {
    throw { response: { status: 409, data: { error: { status: 'ABORTED' } } } };
  });
  await assert.rejects(queue.enqueue(work), /could not be created/);
});
test('task identity checks require the configured verified Google service account and audience', async (context) => {
  const before = { ...process.env };
  Object.assign(process.env, queueEnv);
  let email = config.serviceAccount,
    verified = true;
  const verify = context.mock.method(
    OAuth2Client.prototype,
    'verifyIdToken',
    async () =>
      new LoginTicket('fixture', {
        iss: 'https://accounts.google.com',
        aud: config.audience,
        sub: 'fixture',
        iat: 1,
        exp: 2,
        email,
        email_verified: verified,
      }),
  );
  try {
    assert.equal(await verifyOrderTaskIdentity(undefined), false);
    assert.equal(await verifyOrderTaskIdentity('Bearer fixture'), true);
    assert.deepEqual(verify.mock.calls[0].arguments[0], {
      idToken: 'fixture',
      audience: config.audience,
    });
    email = 'attacker@example.com';
    assert.equal(await verifyOrderTaskIdentity('Bearer fixture'), false);
    email = config.serviceAccount;
    verified = false;
    assert.equal(await verifyOrderTaskIdentity('Bearer fixture'), false);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});
test('task endpoint rejects spoofed headers, validates work, and requests retries only for pending work', async () => {
  const seen: OrderWork[] = [];
  let pending = true;
  const app = await createApp({
    payments: null,
    commerce: null,
    fulfillment: null,
    orderWorker: {
      run: async (input) => {
        seen.push(input);
        return { state: pending ? 'pending' : 'complete' };
      },
    },
    verifyOrderTask: async (header) => header === 'Bearer controlled-service-identity',
  });
  try {
    const url = '/internal/orders/process';
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url,
          headers: { 'x-cloudtasks-taskname': 'spoofed' },
          payload: work,
        })
      ).statusCode,
      401,
    );
    const headers = { authorization: 'Bearer controlled-service-identity' };
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url,
          headers,
          payload: { ...work, email: 'injected@example.com' },
        })
      ).statusCode,
      400,
    );
    assert.equal(seen.length, 0);
    assert.equal(
      (await app.inject({ method: 'POST', url, headers, payload: work })).statusCode,
      503,
    );
    pending = false;
    assert.equal(
      (await app.inject({ method: 'POST', url, headers, payload: work })).statusCode,
      200,
    );
    assert.deepEqual(seen, [work, work]);
  } finally {
    await app.close();
  }
});

test('queue mode retires the authenticated scheduled polling endpoint', async (context) => {
  const before = { ...process.env };
  Object.assign(process.env, queueEnv, {
    FULFILLMENT_WORKER_AUDIENCE: 'https://api.example.com/internal/fulfillment/run',
    FULFILLMENT_WORKER_SERVICE_ACCOUNT: 'old-scheduler@demo-alozuri.iam.gserviceaccount.com',
  });
  context.mock.method(
    OAuth2Client.prototype,
    'verifyIdToken',
    async () =>
      new LoginTicket('fixture', {
        iss: 'https://accounts.google.com',
        aud: process.env.FULFILLMENT_WORKER_AUDIENCE!,
        sub: 'fixture',
        iat: 1,
        exp: 2,
        email: process.env.FULFILLMENT_WORKER_SERVICE_ACCOUNT!,
        email_verified: true,
      }),
  );
  const app = await createApp({ payments: null, commerce: null, fulfillment: null });
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/internal/fulfillment/run',
      headers: { authorization: 'Bearer old-scheduler' },
      payload: {},
    });
    assert.equal(response.statusCode, 410);
    assert.match(response.json().error, /polling is retired/);
  } finally {
    await app.close();
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});
