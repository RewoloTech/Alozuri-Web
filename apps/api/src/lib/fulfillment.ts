import {
  STRIPE_APP_INFO,
  stripeAttributionSchema,
  stripeRefundMetadata,
} from './stripe-attribution.js';
import { CONFIRMATION_VERSION } from './confirmation-order.js';
import { legalSnapshotSchema } from './legal.js';
import { MINIMUM_CHARGE_MINOR } from './exchange-rates.js';
import { createHash, randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { database } from './firebase.js';
import { orderSchema } from './validation.js';
import { assertOrderSession, type PaymentOrder } from './payments.js';
import { SupplierClient, SupplierError, activationSchema, type Activation } from './supplier.js';

const liveOrderSchema = orderSchema
  .extend({
    test: z.literal(false),
    supplierCode: z.string().min(1).max(200),
    wholesaleUnits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    sessionId: z.string().startsWith('cs_live_').optional(),
    parentOrderId: z
      .string()
      .regex(/^purchase_[a-f0-9]{48}$/)
      .optional(),
    chargeTotalCents: z.number().int().positive().optional(),
    paymentIntentId: z.string().startsWith('pi_'),
    supplierOrderNo: z.string().min(1).max(200).optional(),
    refundId: z.string().optional(),
    stripeAttribution: stripeAttributionSchema.optional(),
  })
  .refine(
    (o) =>
      !o.plan.demo &&
      o.amountCents === o.plan.priceCents &&
      o.currency === o.plan.currency &&
      o.amountCents >= MINIMUM_CHARGE_MINOR[o.currency] &&
      (Boolean(o.sessionId) || Boolean(o.parentOrderId && o.chargeTotalCents)),
  );
export type DeliveryOrder = PaymentOrder &
  z.infer<typeof liveOrderSchema> & { lease: string; attempts: number };
export interface FulfillmentStore {
  due(): Promise<string[]>;
  claim(id: string): Promise<DeliveryOrder | null>;
  update(order: DeliveryOrder, fields: Record<string, unknown>): Promise<void>;
  retry(order: DeliveryOrder, reason: string): Promise<void>;
  finish(
    order: DeliveryOrder,
    fields: Record<string, unknown>,
    activation?: Activation,
  ): Promise<void>;
  activation(uid: string, id: string): Promise<Activation | null>;
}
const eligible = ['paid', 'fulfilling', 'provision_wait', 'provision_error', 'refund_pending'];
export function firestoreFulfillmentStore(): FulfillmentStore {
  const db = database();
  async function change(
    order: DeliveryOrder,
    fields: Record<string, unknown>,
    done: boolean,
    activation?: Activation,
  ) {
    await db.runTransaction(async (t) => {
      const jobRef = db.collection('fulfillmentJobs').doc(order.id),
        ref = db.collection('orders').doc(order.id);
      const [job, doc] = await Promise.all([t.get(jobRef), t.get(ref)]);
      if (
        job.get('lease') !== order.lease ||
        !doc.exists ||
        doc.get('paymentBlocked') === true ||
        !eligible.includes(doc.get('status'))
      )
        throw new Error('Delivery lease unavailable.');
      t.update(ref, fields);
      if (activation)
        t.set(db.collection('orderActivations').doc(order.id), {
          // Guest ownership can change while the supplier request is in flight.
          uid: orderSchema.shape.uid.parse(doc.get('uid')),
          ...activationSchema.parse(activation),
        });
      if (done) t.delete(jobRef);
    });
  }
  return {
    async due() {
      return (
        await db
          .collection('fulfillmentJobs')
          .where('nextAttemptAt', '<=', Date.now())
          .orderBy('nextAttemptAt')
          .limit(10)
          .get()
      ).docs.map((d) => d.id);
    },
    async claim(id) {
      return db.runTransaction(async (t) => {
        const jobRef = db.collection('fulfillmentJobs').doc(id),
          ref = db.collection('orders').doc(id);
        const [job, doc] = await Promise.all([t.get(jobRef), t.get(ref)]);
        if (
          !job.exists ||
          job.get('leaseUntil') > Date.now() ||
          job.get('nextAttemptAt') > Date.now()
        )
          return null;
        if (
          !doc.exists ||
          doc.get('test') !== false ||
          doc.get('paymentBlocked') === true ||
          !eligible.includes(doc.get('status'))
        ) {
          t.delete(jobRef);
          return null;
        }
        // Ready-only confirmations follow preparation; legacy orders keep their delivery gate.
        const parentId = doc.get('parentOrderId');
        if (typeof parentId === 'string') {
          const parent = await t.get(db.collection('purchases').doc(parentId));
          const readyOnly = parent.get('confirmationVersion') === CONFIRMATION_VERSION;
          if (
            readyOnly &&
            (parent.get('status') !== 'paid' ||
              !parent.get('paidAt') ||
              !legalSnapshotSchema.safeParse(parent.get('legal')).success)
          )
            return null;
          // Legacy email contracts must reach the recipient's mail server before supply.
          // Old purchases retain their established confirmation marker.
          if (
            parent.get('confirmationVersion') === 'email-v1' &&
            parent.get('confirmationDeliveryStatus') !== 'delivered'
          )
            return null;
          if (
            !readyOnly &&
            (doc.get('legalVersion') || parent.get('legal')) &&
            (!parent.exists || !parent.get('contractEmailSentAt'))
          )
            return null;
        }
        const validated = liveOrderSchema.safeParse(doc.data());
        if (!validated.success) {
          t.update(ref, {
            status: 'provision_error',
            paymentBlocked: true,
            deliveryError: 'Order needs support.',
          });
          t.delete(jobRef);
          return null;
        }
        const parsed = validated.data,
          lease = randomUUID(),
          attempts = (job.get('attempts') || 0) + 1;
        t.update(jobRef, { lease, leaseUntil: Date.now() + 120000, attempts });
        return { ...parsed, id, lease, attempts };
      });
    },
    async update(order, fields) {
      await change(order, fields, false);
      Object.assign(order, fields);
    },
    async finish(order, fields, activation) {
      await change(order, fields, true, activation);
    },
    async retry(order, reason) {
      await db.runTransaction(async (t) => {
        const ref = db.collection('fulfillmentJobs').doc(order.id),
          job = await t.get(ref);
        if (job.get('lease') !== order.lease) return;
        t.update(ref, {
          leaseUntil: 0,
          nextAttemptAt: Date.now() + Math.min(900000, 15000 * 2 ** Math.min(order.attempts, 6)),
          lastError: reason,
        });
        t.update(db.collection('orders').doc(order.id), {
          deliveryDelayed: order.attempts >= 10,
          deliveryError: reason,
        });
      });
    },
    async activation(uid, id) {
      return db.runTransaction(async (t) => {
        const [order, doc] = await Promise.all([
          t.get(db.collection('orders').doc(id)),
          t.get(db.collection('orderActivations').doc(id)),
        ]);
        if (
          order.get('uid') !== uid ||
          order.get('test') !== false ||
          order.get('status') !== 'ready' ||
          order.get('paymentBlocked') === true ||
          doc.get('uid') !== uid
        )
          return null;
        return activationSchema.parse(doc.data());
      });
    },
  };
}
export interface DeliverySupplier {
  order(
    transactionId: string,
    packageCode: string,
    wholesaleUnits: number,
    periodNum?: number,
  ): Promise<string>;
  profile(orderNo: string, transactionId: string, packageCode: string): Promise<Activation | null>;
}
export class FulfillmentService {
  constructor(
    private stripe: Stripe,
    private store: FulfillmentStore,
    private supplier: DeliverySupplier,
  ) {}
  async run(ids?: string[]) {
    let processed = 0,
      failed = 0;
    for (const id of (ids ?? (await this.store.due())).slice(0, 3)) {
      const order = await this.store.claim(id);
      if (!order) continue;
      try {
        await this.deliver(order);
        processed++;
      } catch (e) {
        failed++;
        await this.store.retry(
          order,
          e instanceof SupplierError
            ? 'Supplier response ' + e.code + '; reconciliation required.'
            : 'Delivery requires reconciliation.',
        );
      }
    }
    return { processed, failed };
  }
  activation(uid: string, id: string) {
    return this.store.activation(uid, id);
  }
  private async refund(order: DeliveryOrder) {
    await this.store.update(order, { status: 'refund_pending' });
    let refund: Stripe.Refund | undefined;
    if (order.refundId) refund = await this.stripe.refunds.retrieve(order.refundId);
    else {
      const existing = await this.stripe.refunds.list({
        payment_intent: order.paymentIntentId,
        limit: 100,
      });
      refund = existing.data.find((r) => r.metadata?.alozuriOrderId === order.id);
      refund ??= await this.stripe.refunds.create(
        {
          payment_intent: order.paymentIntentId,
          amount: order.amountCents,
          metadata: stripeRefundMetadata(order.id, order.parentOrderId, order.stripeAttribution),
        },
        { idempotencyKey: order.id + ':unfulfilled-refund:v1' },
      );
    }
    if (
      refund.payment_intent !== order.paymentIntentId ||
      refund.amount !== order.amountCents ||
      refund.currency !== order.currency.toLowerCase()
    )
      throw new Error('Refund mismatch.');
    const fields = {
      refundId: refund.id,
      status:
        refund.status === 'succeeded'
          ? 'refunded'
          : refund.status === 'failed' || refund.status === 'canceled'
            ? 'provision_error'
            : 'refund_pending',
    };
    if (refund.status === 'succeeded' || refund.status === 'failed' || refund.status === 'canceled')
      await this.store.finish(order, {
        ...fields,
        ...(fields.status === 'provision_error'
          ? { paymentBlocked: true, deliveryError: 'Refund needs support.' }
          : {}),
      });
    else {
      await this.store.update(order, fields);
      await this.store.retry(order, 'Refund pending.');
    }
  }
  private async deliver(order: DeliveryOrder) {
    if (order.test || !eligible.includes(order.status)) throw new Error('Not a paid live order.');
    if (!order.parentOrderId) {
      const session = await this.stripe.checkout.sessions.retrieve(order.sessionId!);
      assertOrderSession(order, session);
      if (
        !session.livemode ||
        session.status !== 'complete' ||
        session.payment_status !== 'paid' ||
        session.payment_intent !== order.paymentIntentId
      )
        throw new Error('Payment not confirmed.');
    }
    const intent = await this.stripe.paymentIntents.retrieve(order.paymentIntentId, {
      expand: ['latest_charge'],
    });
    if (order.parentOrderId && intent.metadata?.alozuriPurchaseId !== order.parentOrderId)
      throw new Error('Payment receipt mismatch.');
    const charge = intent.latest_charge;
    if (
      !intent.livemode ||
      intent.status !== 'succeeded' ||
      intent.amount_received !== (order.chargeTotalCents ?? order.amountCents) ||
      intent.currency !== order.currency.toLowerCase() ||
      !charge ||
      typeof charge === 'string'
    )
      throw new Error('Payment receipt unavailable.');
    if (order.status === 'refund_pending' || order.refundId) {
      await this.refund(order);
      return;
    }
    let unrelatedRefund = false;
    if (order.parentOrderId && charge.amount_refunded > 0 && !charge.refunded && !charge.disputed) {
      const refunds = await this.stripe.refunds.list({
        payment_intent: order.paymentIntentId,
        limit: 100,
      });
      const own = refunds.data.find((r) => r.metadata?.alozuriOrderId === order.id);
      if (own) {
        await this.store.update(order, { status: 'refund_pending', refundId: own.id });
        await this.refund(order);
        return;
      }
      unrelatedRefund =
        refunds.data.length > 0 &&
        refunds.data
          .filter((r) => r.status !== 'failed' && r.status !== 'canceled')
          .reduce((sum, r) => sum + r.amount, 0) === charge.amount_refunded &&
        refunds.data.every(
          (r) =>
            typeof r.metadata?.alozuriOrderId === 'string' &&
            /^order_[a-f0-9]{48}$/.test(r.metadata.alozuriOrderId),
        );
    }
    if (charge.disputed || (charge.amount_refunded > 0 && !unrelatedRefund)) {
      await this.store.finish(order, {
        status: charge.refunded ? 'refunded' : 'provision_error',
        paymentBlocked: true,
        deliveryError: 'Payment adjusted. Contact support.',
      });
      return;
    }
    const transactionId = 'az_' + createHash('sha256').update(order.id).digest('hex').slice(0, 40);
    if (!order.supplierOrderNo) {
      await this.store.update(order, { status: 'fulfilling', supplierAttempted: true });
      let orderNo: string;
      try {
        orderNo = await this.supplier.order(
          transactionId,
          order.supplierCode,
          order.wholesaleUnits,
          order.plan.dataType === 'daily' ? 1 : undefined,
        );
      } catch (e) {
        if (e instanceof SupplierError && e.rejected) {
          await this.store.update(order, {
            status: 'refund_pending',
            deliveryError: 'Supplier rejected this package.',
            supplierRejected: true,
          });
          await this.refund(order);
          return;
        }
        // An ambiguous timeout may have placed an order. Retry the SAME transaction ID.
        throw e;
      }
      await this.store.update(order, { supplierOrderNo: orderNo, status: 'provision_wait' });
    }
    const activation = await this.supplier.profile(
      order.supplierOrderNo!,
      transactionId,
      order.supplierCode,
    );
    if (!activation) {
      await this.store.retry(order, 'Profile allocation pending.');
      return;
    }
    await this.store.finish(
      order,
      { status: 'ready', readyAt: new Date().toISOString(), deliveryDelayed: false },
      activation,
    );
  }
}
export function configuredFulfillment(): FulfillmentService | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (
    process.env.PAYMENTS_MODE !== 'live' ||
    process.env.FULFILLMENT_ENABLED !== 'true' ||
    !key?.startsWith('sk_live_') ||
    !process.env.ESIM_ACCESS_CODE ||
    !process.env.ESIM_SECRET_KEY
  )
    return null;
  return new FulfillmentService(
    new Stripe(key, { maxNetworkRetries: 1, timeout: 10000, appInfo: STRIPE_APP_INFO }),
    firestoreFulfillmentStore(),
    new SupplierClient(),
  );
}
export async function verifyFulfillmentIdentity(header: string | undefined) {
  const audience = process.env.FULFILLMENT_WORKER_AUDIENCE,
    email = process.env.FULFILLMENT_WORKER_SERVICE_ACCOUNT;
  if (!audience || !email || !header?.startsWith('Bearer ')) return false;
  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken: header.slice(7), audience });
    const p = ticket.getPayload();
    return p?.email === email && p.email_verified === true;
  } catch {
    return false;
  }
}
