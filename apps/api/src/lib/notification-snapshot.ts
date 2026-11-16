import { z } from 'zod';
import { LOCALES } from '../../../../packages/shared/src/i18n/locales.ts';
import { confirmationVersionSchema, confirmationHash } from './confirmation-order.js';
import {
  confirmationPayload,
  confirmationPayloadHash,
  type ConfirmationEmail,
} from './order-email.js';

// Private durable outbox entry. Contains access credentials just like the original
// message; it must never be returned by customer or operations order serializers.
export const notificationSnapshotSchema = z.object({
  event: z.literal('order-confirmation'),
  orderId: z.string(),
  locale: z.enum(LOCALES),
  templateVersion: confirmationVersionSchema,
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  installationHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  rendered: z.object({
    id: z.string(),
    version: confirmationVersionSchema,
    email: z.email(),
    url: z.url(),
    subject: z.string().min(1),
    from: z.string().min(1),
    replyTo: z.string().min(1),
    text: z.string().min(1),
    html: z.string().min(1),
    attachments: z
      .array(
        z.object({
          filename: z.string(),
          content: z.string(),
          content_type: z.literal('image/png'),
          content_id: z.string(),
        }),
      )
      .optional(),
  }),
});

export class NotificationSnapshotError extends Error {
  constructor() {
    super('notification_snapshot_review_required');
  }
}

export function freezeNotification(email: ConfirmationEmail) {
  const payload = confirmationPayload(email);
  const frozen = {
    ...email,
    version: email.version ?? 'email-v1',
    from: payload.from,
    replyTo: payload.reply_to,
    subject: payload.subject,
  };
  // Leave room below Firestore's 1 MiB document limit. Refuse to send until a
  // durable record exists, rather than sending an unrecorded oversized payload.
  if (Buffer.byteLength(JSON.stringify(frozen)) > 900_000) throw new NotificationSnapshotError();
  return frozen;
}
export const installationSnapshotHash = (installations: unknown) =>
  installations === undefined ? null : confirmationHash(JSON.stringify(installations));

export function readNotification(
  input: unknown,
  orderId: string,
  locale: string,
  installationHash: string | null,
) {
  const result = notificationSnapshotSchema.safeParse(input);
  if (!result.success) throw new NotificationSnapshotError();
  const stored = result.data;
  if (
    stored.orderId !== orderId ||
    stored.rendered.id !== orderId ||
    stored.locale !== locale ||
    stored.templateVersion !== stored.rendered.version ||
    stored.installationHash !== installationHash ||
    stored.payloadHash !== confirmationPayloadHash(stored.rendered)
  )
    throw new NotificationSnapshotError();
  return stored.rendered;
}
