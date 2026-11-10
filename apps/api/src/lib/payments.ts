import { createHash } from 'node:crypto';
import Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  type Plan,
  type StoredPlan,
  type OrderState,
} from '../../../../packages/shared/src/index.ts';
import { database } from './firebase.js';
import { cataloguePlan, type Principal } from './repository.js';
import { orderSchema, planSchema } from './validation.js';
import { SupplierClient, adaptPackage } from './supplier.js';
export class CheckoutError extends Error {
  statusCode = 400;
}
export interface PaymentOrder {
  id: string;
  uid: string;
  plan: Plan;
  amountCents: number;
  currency: 'USD';
  status: OrderState;
  sessionId?: string;
  test: boolean;
}
export interface PaymentStore {
  reserve(uid: string, requestId: string, plan: StoredPlan): Promise<PaymentOrder>;
  bind(orderId: string, sessionId: string): Promise<void>;
  find(uid: string, orderId: string): Promise<PaymentOrder | null>;
  adjust(
    eventId: string,
    charge: Stripe.Charge,
    failedRefund: boolean,
    pendingRefund?: boolean,
  ): Promise<void>;
  apply(
    eventId: string,
    session: Stripe.Checkout.Session,
    state: 'paid' | 'expired',
  ): Promise<void>;
}
function paymentOrder(
  id: string,
  data: FirebaseFirestore.DocumentData,
  mode: PaymentMode,
): PaymentOrder {
  const parsed = orderSchema.parse(data);
  if (parsed.test !== (mode === 'test'))
    throw new CheckoutError('Payment environment does not match this order.');
  return {
    id,
    uid: parsed.uid,
    plan: parsed.plan,
    amountCents: parsed.amountCents,
    currency: 'USD',
    status: parsed.status,
    test: parsed.test,
    ...(typeof data.sessionId === 'string' ? { sessionId: data.sessionId } : {}),
  };
}
export type PaymentMode = 'test' | 'live';
export function firestorePaymentStore(mode: PaymentMode = 'test'): PaymentStore {
  return {
    async find(uid, id) {
      const doc = await database().collection('orders').doc(id).get();
      const data = doc.data();
      return data?.uid === uid ? paymentOrder(id, data, mode) : null;
    },
    async adjust(eventId, charge, failedRefund, pendingRefund = false) {
      if (charge.livemode !== (mode === 'live'))
        throw new CheckoutError('Payment environment mismatch.');
      const paymentIntentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!paymentIntentId) return;
      const db = database(),
        matches = await db
          .collection('orders')
          .where('paymentIntentId', '==', paymentIntentId)
          .limit(2)
          .get();
      if (matches.size !== 1) return;
      const ref = matches.docs[0].ref,
        eventRef = db.collection('stripeEvents').doc(mode + '_' + eventId);
      await db.runTransaction(async (t) => {
        const [doc, event] = await Promise.all([t.get(ref), t.get(eventRef)]);
        if (event.exists || !doc.exists) return;
        const order = paymentOrder(doc.id, doc.data()!, mode);
        if (charge.amount !== order.amountCents || charge.currency !== 'usd')
          throw new CheckoutError('Payment adjustment mismatch.');
        if (!charge.disputed && !charge.amount_refunded && !failedRefund) return;
        t.update(ref, {
          paymentBlocked: true,
          status:
            failedRefund || charge.disputed
              ? 'provision_error'
              : charge.refunded && !pendingRefund
                ? 'refunded'
                : 'refund_pending',
          deliveryError: charge.disputed
            ? 'Payment disputed. Contact support.'
            : failedRefund
              ? 'Refund needs support.'
              : 'Payment refunded or adjusted.',
        });
        t.delete(db.collection('fulfillmentJobs').doc(doc.id));
        t.create(eventRef, {
          type: 'payment_adjustment',
          orderId: doc.id,
          test: mode === 'test',
          receivedAt: new Date().toISOString(),
        });
      });
    },
    async reserve(uid, requestId, plan) {
      const db = database(),
        id =
          'order_' +
          createHash('sha256')
            .update((mode === 'live' ? 'live:' : '') + uid + ':' + requestId)
            .digest('hex')
            .slice(0, 48),
        ref = db.collection('orders').doc(id);
      return db.runTransaction(async (t) => {
        const existing = await t.get(ref);
        if (existing.exists) {
          const order = paymentOrder(id, existing.data()!, mode);
          if (order.uid !== uid || order.plan.id !== plan.id)
            throw new CheckoutError('Checkout request was already used.');
          return order;
        }
        const data = {
          uid,
          plan: planSchema.parse(plan),
          amountCents: plan.priceCents,
          currency: 'USD',
          status: 'created',
          test: mode === 'test',
          createdAt: new Date().toISOString(),
          supplierCode: plan.supplierCode,
          wholesaleUnits: plan.wholesaleUnits,
          fulfillmentMode: mode === 'test' ? 'test_no_issuance' : 'esim_access',
          verifiedEmailAtCheckout: true,
        };
        orderSchema.parse(data);
        t.create(ref, data);
        return paymentOrder(id, data, mode);
      });
    },
    async bind(id, sessionId) {
      const db = database(),
        ref = db.collection('orders').doc(id);
      await db.runTransaction(async (t) => {
        const d = await t.get(ref);
        if (!d.exists) throw new CheckoutError('Order unavailable.');
        const o = paymentOrder(id, d.data()!, mode);
        if (o.sessionId && o.sessionId !== sessionId)
          throw new CheckoutError('Checkout session mismatch.');
        t.update(ref, {
          sessionId,
          ...(o.status === 'created' ? { status: 'checkout_pending' } : {}),
        });
      });
    },
    async apply(eventId, session, state) {
      if (session.livemode !== (mode === 'live'))
        throw new CheckoutError('Payment environment mismatch.');
      const id = session.metadata?.voyaspanOrderId,
        uid = session.metadata?.voyaspanUid;
      if (!id || !uid || !/^order_[a-f0-9]{48}$/.test(id)) return; // Other integrations on this Stripe account.
      z.string()
        .regex(/^evt_[a-zA-Z0-9_]{1,100}$/)
        .parse(eventId);
      const db = database(),
        eventRef = db.collection('stripeEvents').doc(mode + '_' + eventId),
        ref = db.collection('orders').doc(id);
      await db.runTransaction(async (t) => {
        const [event, doc] = await Promise.all([t.get(eventRef), t.get(ref)]);
        if (event.exists) return;
        if (!doc.exists) return;
        const order = paymentOrder(id, doc.data()!, mode);
        assertOrderSession(order, session);
        if (state === 'paid' && session.payment_status !== 'paid') return;
        const status =
          state === 'paid'
            ? ['created', 'checkout_pending', 'expired'].includes(order.status)
              ? 'paid'
              : order.status
            : ['created', 'checkout_pending'].includes(order.status)
              ? 'expired'
              : order.status;
        const firstPayment = state === 'paid' && !doc.get('paidAt');
        const paymentIntent =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id;
        if (firstPayment && mode === 'live') {
          if (!paymentIntent) throw new CheckoutError('Payment receipt unavailable.');
          // Queue delivery in the same transaction that records payment. Never rely on the browser.
          t.create(db.collection('fulfillmentJobs').doc(id), {
            nextAttemptAt: Date.now(),
            leaseUntil: 0,
            attempts: 0,
            createdAt: new Date().toISOString(),
          });
        }
        t.update(ref, {
          status,
          sessionId: session.id,
          ...(firstPayment
            ? {
                paidAt: doc.get('paidAt') || new Date().toISOString(),
                fulfillmentMode: mode === 'test' ? 'test_no_issuance' : 'esim_access',
                ...(paymentIntent ? { paymentIntentId: paymentIntent } : {}),
              }
            : {}),
        });
        t.create(eventRef, {
          type: state,
          orderId: id,
          receivedAt: new Date().toISOString(),
          test: mode === 'test',
        });
      });
    },
  };
}
export async function currentCheckoutPlan(
  id: string,
  supplier = new SupplierClient(),
): Promise<StoredPlan> {
  const ref = database().collection('packages').doc(id),
    doc = await ref.get(),
    data = doc.data();
  const publicPlan = data && cataloguePlan(data);
  if (
    !publicPlan ||
    publicPlan.demo ||
    typeof data?.supplierCode !== 'string' ||
    typeof data.wholesaleUnits !== 'number'
  )
    throw new CheckoutError('Plan unavailable. Search again.');
  const source = await supplier.packages({ locationCode: publicPlan.countries[0] });
  const fresh = source
    .map((p) => adaptPackage(p, new Date().toISOString()))
    .find((p) => p?.id === id);
  if (!fresh) throw new CheckoutError('This package is no longer available. Search again.');
  await ref.set(fresh, { merge: true });
  if (
    fresh.priceCents !== publicPlan.priceCents ||
    fresh.dataGb !== publicPlan.dataGb ||
    fresh.days !== publicPlan.days ||
    JSON.stringify([...fresh.countries].sort()) !== JSON.stringify([...publicPlan.countries].sort())
  )
    throw new CheckoutError('The plan changed. Refresh the plan and confirm its current price.');
  return fresh;
}
export type CheckoutUi = 'hosted' | 'embedded';
export interface CheckoutResult {
  orderId: string;
  paymentMode: PaymentMode;
  url?: string;
  clientSecret?: string;
}
export function assertOrderSession(order: PaymentOrder, session: Stripe.Checkout.Session) {
  if (
    session.livemode !== !order.test ||
    session.mode !== 'payment' ||
    session.metadata?.voyaspanUid !== order.uid ||
    session.metadata?.voyaspanOrderId !== order.id ||
    (order.sessionId && order.sessionId !== session.id) ||
    session.client_reference_id !== order.id ||
    session.amount_total !== order.amountCents ||
    session.currency !== 'usd'
  )
    throw new CheckoutError('Payment does not match the order snapshot.');
}
function checkoutResult(
  session: Stripe.Checkout.Session,
  order: PaymentOrder,
  ui: CheckoutUi,
): CheckoutResult {
  assertOrderSession(order, session);
  if (session.status !== 'open')
    throw new CheckoutError(
      'This checkout is closed. Check your orders before starting a new checkout.',
    );
  if (ui === 'embedded') {
    if (session.ui_mode !== 'embedded_page' || !session.client_secret)
      throw new CheckoutError('Checkout changed. Start a new checkout.');
    return {
      clientSecret: session.client_secret,
      orderId: order.id,
      paymentMode: order.test ? 'test' : 'live',
    };
  }
  if (session.ui_mode !== 'hosted_page' || !session.url)
    throw new CheckoutError('Checkout changed. Start a new checkout.');
  return { url: session.url, orderId: order.id, paymentMode: order.test ? 'test' : 'live' };
}
export class PaymentService {
  constructor(
    private stripe: Stripe,
    private store: PaymentStore,
    private loadPlan: (id: string) => Promise<StoredPlan>,
    private webhookSecret: string,
    private siteUrl: string,
    readonly mode: PaymentMode = 'test',
  ) {
    const site = new URL(siteUrl);
    if (
      site.username ||
      site.password ||
      site.search ||
      site.hash ||
      site.pathname !== '/' ||
      (site.protocol !== 'https:' && (site.hostname !== 'localhost' || mode === 'live'))
    )
      throw new Error('A secure site URL is required.');
  }
  async checkout(
    user: Principal,
    planId: string,
    requestId: string,
    ui: CheckoutUi = 'hosted',
  ): Promise<CheckoutResult> {
    if (!user.verified) throw new CheckoutError('Verify your email before checkout.');
    const plan = await this.loadPlan(planId);
    if (
      plan.demo ||
      plan.currency !== 'USD' ||
      !Number.isSafeInteger(plan.priceCents) ||
      plan.priceCents <= 0
    )
      throw new CheckoutError('Plan unavailable for checkout.');
    const order = await this.store.reserve(user.uid, requestId, plan);
    if (order.test !== (this.mode === 'test'))
      throw new CheckoutError('Payment environment mismatch.');
    if (order.sessionId) {
      const existing = await this.stripe.checkout.sessions.retrieve(order.sessionId);
      return checkoutResult(existing, order, ui);
    }
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        allowed_payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: order.amountCents,
              product_data: {
                name: order.plan.name,
                description: `${order.plan.dataGb} GB · ${order.plan.days} days${order.test ? ' · TEST PAYMENT — no eSIM issued' : ''}`,
              },
            },
            quantity: 1,
          },
        ],
        client_reference_id: order.id,
        metadata: { voyaspanOrderId: order.id, voyaspanUid: user.uid },
        ...(user.email ? { customer_email: user.email } : {}),
        ...(ui === 'embedded'
          ? {
              ui_mode: 'embedded_page' as const,
              redirect_on_completion: 'if_required' as const,
              return_url: this.siteUrl + '/dashboard/orders?id=' + order.id,
            }
          : {
              ui_mode: 'hosted_page' as const,
              success_url: this.siteUrl + '/dashboard/orders?id=' + order.id,
              cancel_url: this.siteUrl + '/checkout/' + planId + '?cancelled=1',
            }),
        expires_at: Math.floor(Date.now() / 1000) + 1860,
      },
      { idempotencyKey: order.id + ':checkout:v2:' + ui },
    );
    const result = checkoutResult(session, order, ui);
    await this.store.bind(order.id, session.id);
    return result;
  }
  async resume(user: Principal, orderId: string) {
    if (!user.verified) throw new CheckoutError('Verify your email before checkout.');
    const order = await this.store.find(user.uid, orderId);
    if (!order?.sessionId) throw new CheckoutError('Order not found.');
    if (order.test !== (this.mode === 'test'))
      throw new CheckoutError('Payment environment mismatch.');
    if (!['created', 'checkout_pending'].includes(order.status))
      throw new CheckoutError('This checkout is closed. Check your order status.');
    const session = await this.stripe.checkout.sessions.retrieve(order.sessionId);
    return checkoutResult(
      session,
      order,
      session.ui_mode === 'embedded_page' ? 'embedded' : 'hosted',
    );
  }
  async status(user: Principal, orderId: string) {
    if (!user.verified) throw new CheckoutError('Verify your email before checking payment.');
    const order = await this.store.find(user.uid, orderId);
    if (!order) throw new CheckoutError('Order not found.');
    if (order.test !== (this.mode === 'test'))
      throw new CheckoutError('Payment environment mismatch.');
    if (!order.sessionId) return { orderId, status: order.status, canResume: false };
    const session = await this.stripe.checkout.sessions.retrieve(order.sessionId);
    assertOrderSession(order, session);
    const state =
      session.payment_status === 'paid' ? 'paid' : session.status === 'expired' ? 'expired' : null;
    if (state) {
      const eventId =
        'evt_reconcile_' + createHash('sha256').update(session.id).digest('hex').slice(0, 48);
      await this.store.apply(eventId + '_' + state, session, state);
    }
    const updated = await this.store.find(user.uid, orderId);
    const status = updated?.status ?? order.status;
    return {
      orderId,
      status,
      canResume: session.status === 'open' && ['created', 'checkout_pending'].includes(status),
    };
  }
  async webhook(body: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(body, signature, this.webhookSecret);
    } catch {
      throw new CheckoutError('Invalid Stripe webhook signature.');
    }
    if (event.livemode !== (this.mode === 'live'))
      throw new CheckoutError('Live/test payment environment mismatch.');
    if (
      ['charge.refunded', 'charge.dispute.created', 'refund.updated', 'refund.failed'].includes(
        event.type,
      )
    ) {
      const source = event.data.object as unknown as {
        id: string;
        charge?: string | { id: string };
        status?: string;
      };
      const chargeId =
        event.type === 'charge.refunded'
          ? source.id
          : typeof source.charge === 'string'
            ? source.charge
            : source.charge?.id;
      if (!chargeId) return;
      const charge = await this.stripe.charges.retrieve(chargeId);
      const refund = event.type.startsWith('refund.')
        ? await this.stripe.refunds.retrieve(source.id)
        : null;
      const refunds =
        charge.amount_refunded > 0
          ? await this.stripe.refunds.list({ charge: charge.id, limit: 100 })
          : null;
      const pendingRefund =
        refunds?.data.some((r) => r.status === 'pending' || r.status === 'requires_action') ??
        false;
      await this.store.adjust(
        event.id,
        charge,
        refund?.status === 'failed' || refund?.status === 'canceled',
        pendingRefund,
      );
      return;
    }
    if (
      [
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
        'checkout.session.expired',
        'checkout.session.async_payment_failed',
      ].includes(event.type)
    ) {
      const source = event.data.object as Stripe.Checkout.Session;
      if (!source.metadata?.voyaspanOrderId) return;
      const session = await this.stripe.checkout.sessions.retrieve(source.id);
      const paid = [
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
      ].includes(event.type);
      if (paid && session.payment_status !== 'paid') return;
      await this.store.apply(event.id, session, paid ? 'paid' : 'expired');
    }
  }
}
export function configuredPayments(): PaymentService | null {
  const key = process.env.STRIPE_SECRET_KEY,
    secret = process.env.STRIPE_WEBHOOK_SECRET,
    site = process.env.SITE_URL;
  const mode = process.env.PAYMENTS_MODE;
  if ((mode !== 'test' && mode !== 'live') || !key?.startsWith(`sk_${mode}_`) || !secret || !site)
    return null;
  if (
    mode === 'live' &&
    (process.env.DEMO_MODE !== 'false' ||
      process.env.FULFILLMENT_ENABLED !== 'true' ||
      !process.env.ESIM_ACCESS_CODE ||
      !process.env.ESIM_SECRET_KEY ||
      !process.env.FULFILLMENT_WORKER_AUDIENCE ||
      !process.env.FULFILLMENT_WORKER_SERVICE_ACCOUNT)
  )
    return null;
  return new PaymentService(
    new Stripe(key, { maxNetworkRetries: 2 }),
    firestorePaymentStore(mode),
    currentCheckoutPlan,
    secret,
    site.replace(/\/$/, ''),
    mode,
  );
}
export async function registerStripeWebhook(app: FastifyInstance, payments: PaymentService | null) {
  await app.register(async (instance) => {
    instance.removeContentTypeParser('application/json');
    instance.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) =>
      done(null, body),
    );
    instance.post(
      '/v1/webhooks/stripe',
      { bodyLimit: 256 * 1024, config: { rateLimit: { max: 300, timeWindow: '1 minute' } } },
      async (request, reply) => {
        if (!payments) return reply.code(503).send({ error: 'Payments are not configured.' });
        const signature = z.string().max(2000).parse(request.headers['stripe-signature']);
        if (!Buffer.isBuffer(request.body))
          return reply.code(400).send({ error: 'Invalid webhook body.' });
        await payments.webhook(request.body, signature);
        return { received: true };
      },
    );
  });
}
