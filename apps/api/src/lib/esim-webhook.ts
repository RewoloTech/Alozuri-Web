import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { database } from './firebase.js';

const text = z.string().trim().min(1).max(200);
const amount = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
const date = text.refine((s) => Number.isFinite(Date.parse(s)));
// Supplier notifications are hints to reconcile with the supplier API. Never treat them
// as proof of payment or use them to overwrite customer orders or activation data.
const content = z.object({
  orderNo: text,
  transactionId: text.optional(),
  orderStatus: text.optional(),
  esimTranNo: text.optional(),
  iccid: text.optional(),
  eid: text.optional(),
  esimStatus: text.optional(),
  smdpStatus: text.optional(),
  timestamp: date.optional(),
  seqNumber: z.number().int().nonnegative().nullable().optional(),
  notifyStatus: text.nullable().optional(),
  totalVolume: amount.optional(),
  orderUsage: amount.optional(),
  remain: amount.optional(),
  remainVolume: amount.optional(),
  remainThreshold: z.number().min(0).max(1).optional(),
  lastUpdateTime: date.optional(),
  totalDuration: amount.optional(),
  durationUnit: text.optional(),
  expiredTime: date.optional(),
});
export const esimEventSchema = z
  .object({
    notifyType: z.enum([
      'CHECK_HEALTH',
      'ORDER_STATUS',
      'ESIM_STATUS',
      'SMDP_EVENT',
      'DATA_USAGE',
      'VALIDITY_USAGE',
    ]),
    notifyId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    eventGenerateTime: z.iso.datetime({ offset: true }),
    content,
  })
  .superRefine((event, ctx) => {
    const required: Record<typeof event.notifyType, string[]> = {
      CHECK_HEALTH: ['orderStatus'],
      ORDER_STATUS: ['orderStatus'],
      ESIM_STATUS: ['esimStatus'],
      SMDP_EVENT: ['iccid', 'esimStatus', 'smdpStatus'],
      DATA_USAGE: ['totalVolume', 'orderUsage', 'remain'],
      VALIDITY_USAGE: ['remain', 'totalDuration', 'durationUnit', 'expiredTime'],
    };
    for (const key of required[event.notifyType]) {
      if (!(key in event.content))
        ctx.addIssue({ code: 'custom', path: ['content', key], message: 'Missing event field.' });
    }
  });
export type EsimEvent = z.infer<typeof esimEventSchema>;
export interface EsimWebhookInbox {
  save(event: EsimEvent): Promise<'stored' | 'duplicate' | 'conflict'>;
}
function canonical(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => JSON.stringify(key) + ':' + canonical(entry))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}
export function eventHash(event: EsimEvent) {
  return createHash('sha256').update(canonical(event)).digest('hex');
}
export function createEsimWebhookInbox(): EsimWebhookInbox {
  return {
    async save(event) {
      // Revalidate at the write boundary, even when called outside the HTTP handler.
      event = esimEventSchema.parse(event);
      const db = database();
      const id = createHash('sha256').update(event.notifyId).digest('hex');
      const ref = db.collection('supplierWebhookEvents').doc('esim-access-' + id);
      const hash = eventHash(event);
      return db.runTransaction(async (transaction) => {
        const existing = await transaction.get(ref);
        if (existing.exists) return existing.get('payloadHash') === hash ? 'duplicate' : 'conflict';
        transaction.create(ref, {
          source: 'esim-access',
          event,
          payloadHash: hash,
          processingStatus: 'awaiting_reconciliation',
          receivedAt: Timestamp.now(),
          expireAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        return 'stored';
      });
    },
  };
}
function validToken(candidate: unknown, expected: string) {
  if (typeof candidate !== 'string' || candidate.length > 256) return false;
  const hash = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(hash(candidate), hash(expected));
}
export function registerEsimWebhook(
  app: FastifyInstance,
  options: {
    token?: string;
    inbox?: EsimWebhookInbox;
  } = {},
) {
  const token = options.token ?? process.env.ESIM_WEBHOOK_TOKEN;
  const inbox = options.inbox ?? createEsimWebhookInbox();
  app.post(
    '/v1/webhooks/esim-access',
    {
      bodyLimit: 32 * 1024,
      config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
      onRequest: async (request, reply) => {
        if (!token || token.length < 32)
          return reply.code(503).send({ error: 'Webhook unavailable.' });
        const parsed = z.object({ token: z.string() }).strict().safeParse(request.query);
        if (!parsed.success || !validToken(parsed.data.token, token))
          return reply.code(401).send({ error: 'Invalid webhook credentials.' });
      },
    },
    async (request, reply) => {
      const event = esimEventSchema.parse(request.body);
      if (event.notifyType === 'CHECK_HEALTH') return { success: true };
      const result = await inbox.save(event);
      if (result === 'conflict')
        return reply.code(409).send({ error: 'Event ID already received with different content.' });
      return { success: true };
    },
  );
}
