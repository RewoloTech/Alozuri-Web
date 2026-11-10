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
  test: true;
}
export interface PaymentStore {
  reserve(uid: string, requestId: string, plan: StoredPlan): Promise<PaymentOrder>;
  bind(orderId: string, sessionId: string): Promise<void>;
  apply(
    eventId: string,
    session: Stripe.Checkout.Session,
    state: 'paid' | 'expired',
  ): Promise<void>;
}
function paymentOrder(id: string, data: FirebaseFirestore.DocumentData): PaymentOrder {
  const parsed = orderSchema.parse(data);
  if (parsed.test !== true) throw new CheckoutError('Test checkout cannot modify live orders.');
  return {
    id,
    uid: parsed.uid,
    plan: parsed.plan,
    amountCents: parsed.amountCents,
    currency: 'USD',
    status: parsed.status,
    test: true,
    ...(typeof data.sessionId === 'string' ? { sessionId: data.sessionId } : {}),
  };
}
export function firestorePaymentStore(): PaymentStore {
  return {
    async reserve(uid, requestId, plan) {
      const db = database(),
        id =
          'order_' +
          createHash('sha256')
            .update(uid + ':' + requestId)
            .digest('hex')
            .slice(0, 48),
        ref = db.collection('orders').doc(id);
      return db.runTransaction(async (t) => {
        const existing = await t.get(ref);
        if (existing.exists) {
          const order = paymentOrder(id, existing.data()!);
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
          test: true,
          createdAt: new Date().toISOString(),
          supplierCode: plan.supplierCode,
          wholesaleUnits: plan.wholesaleUnits,
          fulfillmentMode: 'test_no_issuance',
          verifiedEmailAtCheckout: true,
        };
        orderSchema.parse(data);
        t.create(ref, data);
        return paymentOrder(id, data);
      });
    },
    async bind(id, sessionId) {
      const db = database(),
        ref = db.collection('orders').doc(id);
      await db.runTransaction(async (t) => {
        const d = await t.get(ref);
        if (!d.exists) throw new CheckoutError('Order unavailable.');
        const o = paymentOrder(id, d.data()!);
        if (o.sessionId && o.sessionId !== sessionId)
          throw new CheckoutError('Checkout session mismatch.');
        t.update(ref, {
          sessionId,
          ...(o.status === 'created' ? { status: 'checkout_pending' } : {}),
        });
      });
    },
    async apply(eventId, session, state) {
      if (session.livemode) throw new CheckoutError('Live payment events are disabled.');
      const id = session.metadata?.voyaspanOrderId,
        uid = session.metadata?.voyaspanUid;
      if (!id || !uid || !/^order_[a-f0-9]{48}$/.test(id)) return; // Other integrations on this Stripe account.
      z.string()
        .regex(/^evt_[a-zA-Z0-9_]{1,100}$/)
        .parse(eventId);
      const db = database(),
        eventRef = db.collection('stripeEvents').doc(eventId),
        ref = db.collection('orders').doc(id);
      await db.runTransaction(async (t) => {
        const [event, doc] = await Promise.all([t.get(eventRef), t.get(ref)]);
        if (event.exists) return;
        if (!doc.exists) return;
        const order = paymentOrder(id, doc.data()!);
        if (
          order.uid !== uid ||
          (order.sessionId && order.sessionId !== session.id) ||
          session.client_reference_id !== id ||
          session.amount_total !== order.amountCents ||
          session.currency !== 'usd'
        )
          throw new CheckoutError('Payment does not match the order snapshot.');
        if (state === 'paid' && session.payment_status !== 'paid') return;
        const status = state === 'paid' ? 'paid' : order.status === 'paid' ? 'paid' : 'expired';
        t.update(ref, {
          status,
          sessionId: session.id,
          ...(status === 'paid'
            ? {
                paidAt: doc.get('paidAt') || new Date().toISOString(),
                fulfillmentMode: 'test_no_issuance',
              }
            : {}),
        });
        t.create(eventRef, {
          type: state,
          orderId: id,
          receivedAt: new Date().toISOString(),
          test: true,
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
export class PaymentService {
  constructor(
    private stripe: Stripe,
    private store: PaymentStore,
    private loadPlan: (id: string) => Promise<StoredPlan>,
    private webhookSecret: string,
    private siteUrl: string,
  ) {
    const site = new URL(siteUrl);
    if (site.protocol !== 'https:' && site.hostname !== 'localhost')
      throw new Error('A secure site URL is required.');
  }
  async checkout(user: Principal, planId: string, requestId: string) {
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
    if (order.sessionId) {
      const existing = await this.stripe.checkout.sessions.retrieve(order.sessionId);
      if (existing.livemode || existing.status !== 'open' || !existing.url)
        throw new CheckoutError('This checkout is closed. Start a new checkout.');
      return { url: existing.url, orderId: order.id, paymentMode: 'test' };
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
                description: `${order.plan.dataGb} GB · ${order.plan.days} days · TEST PAYMENT — no eSIM issued`,
              },
            },
            quantity: 1,
          },
        ],
        client_reference_id: order.id,
        metadata: { voyaspanOrderId: order.id, voyaspanUid: user.uid },
        ...(user.email ? { customer_email: user.email } : {}),
        success_url: this.siteUrl + '/dashboard/orders?id=' + order.id + '&checkout=success',
        cancel_url: this.siteUrl + '/checkout/' + planId + '?cancelled=1',
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      },
      { idempotencyKey: order.id + ':checkout:v1' },
    );
    if (session.livemode || !session.url) throw new CheckoutError('Only test checkout is enabled.');
    await this.store.bind(order.id, session.id);
    return { url: session.url, orderId: order.id, paymentMode: 'test' };
  }
  async webhook(body: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(body, signature, this.webhookSecret);
    } catch {
      throw new CheckoutError('Invalid Stripe webhook signature.');
    }
    if (event.livemode) throw new CheckoutError('Live payment events are disabled.');
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
  if (process.env.PAYMENTS_MODE !== 'test' || !key?.startsWith('sk_test_') || !secret || !site)
    return null;
  return new PaymentService(
    new Stripe(key, { maxNetworkRetries: 2 }),
    firestorePaymentStore(),
    currentCheckoutPlan,
    secret,
    site.replace(/\/$/, ''),
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
        if (!payments) return reply.code(503).send({ error: 'Test payments are not configured.' });
        const signature = z.string().max(2000).parse(request.headers['stripe-signature']);
        if (!Buffer.isBuffer(request.body))
          return reply.code(400).send({ error: 'Invalid webhook body.' });
        await payments.webhook(request.body, signature);
        return { received: true };
      },
    );
  });
}
