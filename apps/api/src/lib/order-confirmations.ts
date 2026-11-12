import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { FieldValue, type Firestore, type DocumentReference } from 'firebase-admin/firestore';
import { activationSchema } from './supplier.js';
import { purchaseOwnerUid } from './purchase-ownership.js';
import {
  installationConfirmationEmail,
  type EmailInstallation,
} from './order-email-installation.js';
import { confirmationOrderSchema, CONFIRMATION_VERSION } from './confirmation-order.js';
import {
  confirmationEmail,
  confirmationPayloadHash,
  EmailSendError,
  type OrderMailer,
} from './order-email.js';

const retryDelay = (attempt: number) =>
  Math.min(60 * 60_000, 60_000 * 2 ** Math.min(attempt - 1, 6));
// Resend retains send-idempotency keys for 24h. Leave a margin and require
// reconciliation afterwards rather than risking a second customer email.
export const SAFE_EMAIL_RETRY_MS = 23 * 60 * 60_000;
const leaseMs = 5 * 60_000;
export class OrderConfirmations {
  constructor(
    private db: Firestore,
    private mailer: OrderMailer,
    private site: string,
    private token: (id: string) => string,
    private now: () => number = Date.now,
  ) {}
  async run(purchaseId?: string) {
    let sent = 0,
      failed = 0,
      attention = 0;
    await this.adoptUnsentLegacyOrders(purchaseId);
    const docs = await this.due('confirmationDueAt', purchaseId);
    for (const doc of docs) {
      const lease = randomUUID();
      const claimed = await this.db.runTransaction(async (t) => {
        const current = await t.get(doc.ref);
        if (
          current.get('test') !== false ||
          !current.get('paidAt') ||
          current.get('confirmationSentAt') ||
          current.get('confirmationStatus') === 'attention' ||
          current.get('confirmationLeaseUntil') > this.now() ||
          typeof current.get('confirmationDueAt') !== 'number' ||
          current.get('confirmationDueAt') > this.now()
        )
          return null;
        let installations: EmailInstallation[] | undefined;
        if (current.get('confirmationVersion') === CONFIRMATION_VERSION) {
          if (current.get('status') !== 'paid') return null;
          const order = confirmationOrderSchema.parse({ ...current.data(), id: current.id });
          const units = await t.get(
            this.db.collection('orders').where('parentOrderId', '==', current.id).limit(11),
          );
          const expected = order.items.reduce((count, item) => count + item.quantity, 0);
          if (units.size !== expected || units.size > 10 || units.empty) return null;
          if (
            units.docs.some(
              (unit) =>
                unit.get('status') !== 'ready' ||
                unit.get('paymentBlocked') === true ||
                unit.get('uid') !==
                  purchaseOwnerUid(current.id, z.string().nullable().parse(current.get('uid'))),
            )
          )
            return null;
          const activations = await t.getAll(
            ...units.docs.map((unit) => this.db.collection('orderActivations').doc(unit.id)),
          );
          if (
            activations.some(
              (activation, index) =>
                !activation.exists ||
                activation.get('uid') !== units.docs[index].get('uid') ||
                !activationSchema.safeParse(activation.data()).success,
            )
          )
            return null;
          // Freeze the format before the first send. Older in-flight payloads keep
          // their original content and provider key, including ambiguous timeouts.
          if (
            current.get('confirmationIncludesInstallation') === true ||
            (current.get('confirmationFirstSendAt') === undefined &&
              current.get('confirmationPayloadHash') === undefined)
          ) {
            installations = units.docs.map((unit, index) => ({
              unitId: unit.id,
              planId: z.string().parse(unit.get('plan.id')),
              activation: activationSchema.parse(activations[index].data()),
            }));
          }
        }
        const attempts = Number(current.get('confirmationAttempts') || 0) + 1;
        t.update(doc.ref, {
          confirmationLease: lease,
          confirmationLeaseUntil: this.now() + leaseMs,
          confirmationStatus: 'preparing',
          confirmationAttempts: attempts,
          ...(installations ? { confirmationIncludesInstallation: true } : {}),
        });
        return { data: current.data(), attempts, installations };
      });
      if (!claimed) continue;
      try {
        const order = confirmationOrderSchema.parse({ ...claimed.data, id: doc.id });
        const url = `${this.site}/checkout/success?order=${doc.id}#access=${this.token(doc.id)}`;
        const email = claimed.installations
          ? await installationConfirmationEmail(order, url, claimed.installations)
          : confirmationEmail(
              order,
              url,
              claimed.data?.confirmationVersion === CONFIRMATION_VERSION
                ? CONFIRMATION_VERSION
                : 'email-v1',
            );
        const payloadHash = confirmationPayloadHash(email);
        const canSend = await this.db.runTransaction(async (t) => {
          const current = await t.get(doc.ref);
          if (current.get('confirmationLease') !== lease || current.get('confirmationSentAt'))
            return false;
          const firstAttemptAt = z
            .number()
            .finite()
            .nonnegative()
            .optional()
            .parse(current.get('confirmationFirstSendAt'));
          if (
            (firstAttemptAt !== undefined && this.now() - firstAttemptAt >= SAFE_EMAIL_RETRY_MS) ||
            (current.get('confirmationPayloadHash') &&
              current.get('confirmationPayloadHash') !== payloadHash)
          ) {
            t.update(doc.ref, {
              confirmationStatus: 'attention',
              confirmationError: 'send_reconciliation_required',
              confirmationLeaseUntil: 0,
              confirmationDueAt: FieldValue.delete(),
            });
            return false;
          }
          t.update(doc.ref, {
            confirmationStatus: 'sending',
            confirmationFirstSendAt: firstAttemptAt ?? this.now(),
            confirmationPayloadHash: payloadHash,
          });
          return true;
        });
        if (!canSend) {
          attention++;
          continue;
        }
        const receipt = await this.mailer.send(email);
        const sentAt = new Date(this.now()).toISOString();
        await this.updateOwned(doc.ref, lease, {
          confirmationStatus: 'sent',
          confirmationSentAt: sentAt,
          confirmationProviderId: receipt.providerMessageId,
          confirmationDeliveryStatus: 'sent',
          confirmationDeliveryDueAt: this.now(),
          confirmationDeliveryAttempts: 0,
          confirmationDueAt: FieldValue.delete(),
          confirmationLeaseUntil: 0,
          confirmationError: FieldValue.delete(),
          // Preserve the established contract-before-fulfilment marker for old readers.
          contractEmailSentAt: sentAt,
          emailSentAt: sentAt,
        });
        sent++;
      } catch (error) {
        failed++;
        const needsAttention =
          error instanceof z.ZodError ||
          (error instanceof EmailSendError && error.reason === 'idempotency_conflict');
        if (needsAttention) attention++;
        await this.updateOwned(doc.ref, lease, {
          confirmationStatus: needsAttention ? 'attention' : 'retry',
          confirmationLeaseUntil: 0,
          confirmationError:
            error instanceof z.ZodError
              ? 'snapshot_review_required'
              : needsAttention
                ? 'send_reconciliation_required'
                : error instanceof EmailSendError
                  ? error.reason
                  : 'email_failed',
          confirmationDueAt: needsAttention
            ? FieldValue.delete()
            : this.now() + retryDelay(claimed.attempts),
        });
      }
    }
    failed += await this.reconcileDelivery(purchaseId);
    return { sent, failed, attention };
  }
  private async due(field: string, purchaseId?: string) {
    if (purchaseId) {
      const doc = await this.db.collection('purchases').doc(purchaseId).get();
      const due: unknown = doc.get(field);
      return doc.exists && typeof due === 'number' && due <= this.now() ? [doc] : [];
    }
    return (await this.db.collection('purchases').where(field, '<=', this.now()).limit(10).get())
      .docs;
  }
  private async adoptUnsentLegacyOrders(purchaseId?: string) {
    const queues = await Promise.all(
      ['contractEmailDueAt', 'emailDueAt'].map((field) => this.due(field, purchaseId)),
    );
    const refs = new Map(queues.flatMap((queue) => queue.map((doc) => [doc.id, doc.ref] as const)));
    for (const ref of refs.values())
      await this.db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if (
          doc.get('test') !== false ||
          !doc.get('paidAt') ||
          doc.get('contractEmailLeaseUntil') > this.now() ||
          doc.get('emailLeaseUntil') > this.now()
        )
          return;
        const retired = {
          contractEmailDueAt: FieldValue.delete(),
          emailDueAt: FieldValue.delete(),
        };
        if (
          doc.get('confirmationVersion') ||
          doc.get('contractEmailSentAt') ||
          doc.get('emailSentAt')
        ) {
          t.update(ref, retired);
        } else if (
          !doc.get('legal') ||
          doc.get('contractEmailLeaseUntil') !== undefined ||
          doc.get('emailLeaseUntil') !== undefined
        ) {
          // An old send may have succeeded without a Firestore acknowledgement.
          // Its old provider key is different: never blindly send a new message.
          t.update(ref, {
            ...retired,
            confirmationStatus: 'attention',
            confirmationError: 'legacy_send_review_required',
          });
        } else {
          t.update(ref, {
            ...retired,
            confirmationVersion: 'email-v1',
            confirmationStatus: 'pending',
            confirmationDueAt: this.now(),
          });
        }
      });
  }
  private async updateOwned(
    ref: DocumentReference,
    lease: string,
    fields: Record<string, unknown>,
  ) {
    await this.db.runTransaction(async (t) => {
      const current = await t.get(ref);
      if (current.get('confirmationLease') !== lease) throw new Error('Confirmation lease lost.');
      t.update(ref, fields);
    });
  }
  private async reconcileDelivery(purchaseId?: string) {
    let failures = 0;
    const docs = await this.due('confirmationDeliveryDueAt', purchaseId);
    for (const doc of docs) {
      const id: unknown = doc.get('confirmationProviderId');
      if (typeof id !== 'string' || doc.get('test') !== false) continue;
      const attempts = Number(doc.get('confirmationDeliveryAttempts') || 0) + 1;
      try {
        const event = await this.mailer.deliveryStatus(id);
        const delivered = ['delivered', 'opened', 'clicked'].includes(event);
        const failed = ['bounced', 'failed', 'complained', 'suppressed', 'canceled'].includes(
          event,
        );
        if (failed) failures++;
        await this.updateDelivery(doc.ref, {
          confirmationDeliveryStatus: delivered ? 'delivered' : failed ? 'failed' : 'pending',
          confirmationDeliveryEvent: event,
          confirmationDeliveryAttempts: attempts,
          confirmationDeliveryCheckedAt: new Date(this.now()).toISOString(),
          confirmationDeliveryError: FieldValue.delete(),
          ...(failed
            ? { confirmationStatus: 'attention', confirmationError: 'delivery_failed' }
            : {}),
          ...(delivered ? { confirmationDeliveredAt: new Date(this.now()).toISOString() } : {}),
          confirmationDeliveryDueAt:
            delivered || failed ? FieldValue.delete() : this.now() + retryDelay(attempts),
        });
      } catch {
        failures++;
        await this.updateDelivery(doc.ref, {
          confirmationDeliveryAttempts: attempts,
          confirmationDeliveryError: 'status_unavailable',
          confirmationDeliveryDueAt: this.now() + retryDelay(attempts),
        });
      }
    }
    return failures;
  }
  private async updateDelivery(ref: DocumentReference, fields: Record<string, unknown>) {
    await this.db.runTransaction(async (t) => {
      const current = await t.get(ref);
      // A slower poll must not undo a terminal result written by another worker.
      if (['delivered', 'failed'].includes(current.get('confirmationDeliveryStatus'))) return;
      t.update(ref, fields);
    });
  }
}
