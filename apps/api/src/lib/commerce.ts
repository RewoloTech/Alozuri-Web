import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import Stripe from 'stripe';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import { database } from './firebase.js';
import { currentCheckoutPlan, type PaymentMode } from './payments.js';
import type { Principal, Repository } from './repository.js';
import { planSchema } from './validation.js';
import {
  mergeCartItems,
  type CartItem,
  type StoredPlan,
  type Plan,
} from '../../../../packages/shared/src/index.ts';
export class CommerceError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}
export const itemsSchema = z
  .array(
    z
      .object({
        planId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
        quantity: z.number().int().min(1).max(5),
      })
      .strict(),
  )
  .max(10)
  .transform((items, ctx) => {
    try {
      return mergeCartItems([], items);
    } catch (e) {
      ctx.addIssue({ code: 'custom', message: e instanceof Error ? e.message : 'Invalid cart' });
      return z.NEVER;
    }
  });
const snapshotSchema = z.object({
  plan: planSchema,
  quantity: z.number().int().min(1).max(5),
  supplierCode: z.string().min(1),
  wholesaleUnits: z.number().int().positive(),
});
const purchaseSchema = z.object({
  uid: z.string().nullable(),
  email: z.email(),
  items: z.array(snapshotSchema).min(1).max(10),
  currency: z.literal('USD'),
  totalCents: z.number().int().positive(),
  status: z.enum([
    'pending_payment',
    'payment_processing',
    'paid',
    'cancelled',
    'refunded',
    'refund_pending',
    'attention',
  ]),
  test: z.boolean(),
  createdAt: z.string(),
  accessHash: z.string(),
  paymentIntentId: z.string().optional(),
  paidAt: z.string().optional(),
});
type Purchase = z.infer<typeof purchaseSchema>;
export type Quote = {
  items: { plan: Plan; quantity: number }[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: 'USD';
};
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export async function priceCart(
  items: CartItem[],
  loadPlan: (id: string) => Promise<StoredPlan>,
): Promise<{ quote: Quote; snapshots: z.infer<typeof snapshotSchema>[] }> {
  const normalized = itemsSchema.parse(items);
  if (!normalized.length) throw new CommerceError('Your cart is empty.');
  const snapshots = [];
  for (const item of normalized) {
    const p = await loadPlan(item.planId);
    if (
      (p.providerId && p.providerId !== 'esim-access') ||
      p.demo ||
      p.currency !== 'USD' ||
      !p.active ||
      p.priceCents < 50 ||
      !Number.isSafeInteger(p.priceCents) ||
      !p.supplierCode ||
      !Number.isSafeInteger(p.wholesaleUnits) ||
      p.wholesaleUnits <= 0
    )
      throw new CommerceError('A plan is unavailable. Update your cart.');
    snapshots.push({
      plan: planSchema.parse(p),
      quantity: item.quantity,
      supplierCode: p.supplierCode,
      wholesaleUnits: p.wholesaleUnits,
    });
  }
  const total = snapshots.reduce((n, i) => n + i.plan.priceCents * i.quantity, 0);
  if (!Number.isSafeInteger(total) || total > 99999999)
    throw new CommerceError('Order amount is outside the supported range.');
  return {
    snapshots,
    quote: {
      items: snapshots.map(({ plan, quantity }) => ({ plan, quantity })),
      subtotalCents: total,
      taxCents: 0,
      totalCents: total,
      currency: 'USD',
    },
  };
}
export interface OrderMailer {
  send(input: { id: string; email: string; url: string }): Promise<void>;
}
export class ResendOrderMailer implements OrderMailer {
  constructor(
    private key: string,
    private from: string,
  ) {}
  async send(input: { id: string; email: string; url: string }) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.key,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.id + ':delivery:v1',
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.email],
        subject: 'Your Alozuri eSIM order',
        text: `Your Alozuri order ${input.id} is ready to view. Open this private link for your eSIM installation details and order status:\n\n${input.url}\n\nKeep this link private. Install over Wi-Fi and follow your plan’s activation rules.`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Order email delivery failed.');
  }
}
export class CommerceService {
  constructor(
    private stripe: Stripe,
    readonly mode: PaymentMode,
    private secret: string,
    private accessSecret: string,
    private site: string,
    private loadPlan: (id: string) => Promise<StoredPlan> = currentCheckoutPlan,
    private db: Firestore = database(),
    private mailer: OrderMailer | null = null,
  ) {
    const url = new URL(site);
    if (
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      (url.protocol !== 'https:' && (mode === 'live' || url.hostname !== 'localhost'))
    )
      throw new Error('Invalid checkout site URL.');
    if (accessSecret.length < 32) throw new Error('Order access signing secret is required.');
  }
  quote(items: CartItem[]) {
    return priceCart(items, this.loadPlan).then((r) => r.quote);
  }
  private token(id: string) {
    return createHmac('sha256', this.accessSecret)
      .update('guest-order:' + id)
      .digest('base64url');
  }
  private authorized(p: Purchase, user: Principal | null, access: string | undefined) {
    if (user?.verified && (p.uid === user.uid || user.email?.toLowerCase() === p.email))
      return true;
    if (!access) return false;
    const actual = Buffer.from(hash(access)),
      expected = Buffer.from(p.accessHash);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  async checkout(
    input: {
      items: CartItem[];
      email: string;
      emailConfirmation: string;
      requestId: string;
      compatible: true;
      currency: 'USD';
      expectedTotalCents: number;
    },
    user: Principal | null,
  ) {
    if (input.email.toLowerCase() !== input.emailConfirmation.toLowerCase())
      throw new CommerceError('Email addresses do not match.');
    const email = input.email.toLowerCase(),
      owner = user?.verified ? user.uid : 'guest',
      id = 'purchase_' + hash(this.mode + ':' + owner + ':' + input.requestId).slice(0, 48),
      ref = this.db.collection('purchases').doc(id),
      accessToken = this.token(id);
    const { quote, snapshots } = await priceCart(input.items, this.loadPlan);
    if (input.expectedTotalCents !== quote.totalCents)
      throw new CommerceError('The price changed. Review the updated total before paying.', 409);
    const proposed = {
      uid: user?.verified ? user.uid : null,
      email,
      items: snapshots,
      currency: 'USD' as const,
      totalCents: quote.totalCents,
      status: 'pending_payment' as const,
      test: this.mode === 'test',
      createdAt: new Date().toISOString(),
      accessHash: hash(accessToken),
    };
    const purchase = await this.db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (doc.exists) {
        const p = purchaseSchema.parse(doc.data());
        if (
          p.email !== email ||
          p.totalCents !== proposed.totalCents ||
          JSON.stringify(
            p.items.map((i) => [
              i.plan.id,
              i.quantity,
              i.plan.priceCents,
              i.plan.dataGb,
              i.plan.days,
              i.plan.dataType,
              i.plan.dailyPolicy || null,
              i.plan.countries,
              i.supplierCode,
            ]),
          ) !==
            JSON.stringify(
              proposed.items.map((i) => [
                i.plan.id,
                i.quantity,
                i.plan.priceCents,
                i.plan.dataGb,
                i.plan.days,
                i.plan.dataType,
                i.plan.dailyPolicy || null,
                i.plan.countries,
                i.supplierCode,
              ]),
            ) ||
          p.uid !== proposed.uid
        )
          throw new CommerceError('Checkout changed. Start a new checkout.', 409);
        return p;
      }
      t.create(ref, proposed);
      return proposed as Purchase;
    });
    if (purchase.status !== 'pending_payment' && purchase.status !== 'payment_processing')
      throw new CommerceError('This order has already been processed. Check its status.');
    const intent = purchase.paymentIntentId
      ? await this.stripe.paymentIntents.retrieve(purchase.paymentIntentId)
      : await this.stripe.paymentIntents.create(
          {
            amount: purchase.totalCents,
            currency: 'usd',
            receipt_email: email,
            automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
            metadata: { alozuriPurchaseId: id },
            description: 'Alozuri eSIM order ' + id,
          },
          { idempotencyKey: id + ':payment:v1' },
        );
    this.assertIntent(id, purchase, intent);
    if (!intent.client_secret || intent.status === 'canceled' || intent.status === 'succeeded')
      throw new CommerceError('This payment is closed. Check your order.');
    await this.db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      const p = purchaseSchema.parse(doc.data());
      if (p.paymentIntentId && p.paymentIntentId !== intent.id)
        throw new CommerceError('Payment session mismatch.');
      t.update(ref, { paymentIntentId: intent.id });
    });
    return {
      orderId: id,
      accessToken,
      clientSecret: intent.client_secret,
      quote,
      paymentMode: this.mode,
    };
  }
  private assertIntent(id: string, p: Purchase, intent: Stripe.PaymentIntent) {
    if (
      intent.livemode !== !p.test ||
      intent.metadata.alozuriPurchaseId !== id ||
      intent.amount !== p.totalCents ||
      intent.currency !== 'usd' ||
      (p.paymentIntentId && p.paymentIntentId !== intent.id)
    )
      throw new CommerceError('Payment does not match this order.');
  }
  async webhook(body: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(body, signature, this.secret);
    } catch {
      throw new CommerceError('Invalid Stripe webhook signature.');
    }
    if (event.livemode !== (this.mode === 'live'))
      throw new CommerceError('Payment environment mismatch.');
    if (
      ['charge.refunded', 'charge.dispute.created', 'refund.updated', 'refund.failed'].includes(
        event.type,
      )
    ) {
      const source = event.data.object as unknown as {
        id: string;
        charge?: string | { id: string };
      };
      const chargeId =
        event.type === 'charge.refunded'
          ? source.id
          : typeof source.charge === 'string'
            ? source.charge
            : source.charge?.id;
      if (!chargeId) return;
      const charge = await this.stripe.charges.retrieve(chargeId),
        pi =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;
      if (!pi) return;
      const intent = await this.stripe.paymentIntents.retrieve(pi),
        id = intent.metadata.alozuriPurchaseId;
      if (!id || !/^purchase_[a-f0-9]{48}$/.test(id)) return;
      const refunds = (await this.stripe.refunds.list({ payment_intent: pi, limit: 100 })).data;
      const ref = this.db.collection('purchases').doc(id),
        eventRef = this.db.collection('commerceEvents').doc(this.mode + '_' + event.id);
      await this.db.runTransaction(async (t) => {
        const [doc, seen, units] = await Promise.all([
          t.get(ref),
          t.get(eventRef),
          t.get(this.db.collection('orders').where('parentOrderId', '==', id)),
        ]);
        if (!doc.exists || seen.exists) return;
        const p = purchaseSchema.parse(doc.data());
        this.assertIntent(id, p, intent);
        const knownIds = new Set(units.docs.map((u) => u.id));
        const unassigned = refunds.some(
          (r) => !r.metadata?.alozuriOrderId || !knownIds.has(r.metadata.alozuriOrderId),
        );
        const full =
          charge.refunded &&
          !refunds.some((r) => r.status === 'pending' || r.status === 'requires_action');
        for (const unit of units.docs) {
          const own = refunds.filter((r) => r.metadata?.alozuriOrderId === unit.id);
          if (!charge.disputed && !unassigned && !full && !own.length) continue;
          const failed = own.some((r) => r.status === 'failed' || r.status === 'canceled');
          const refunded =
            full ||
            own.some((r) => r.status === 'succeeded' && r.amount === unit.get('amountCents'));
          t.update(unit.ref, {
            paymentBlocked: true,
            status:
              charge.disputed || failed || (unassigned && !full)
                ? 'provision_error'
                : refunded
                  ? 'refunded'
                  : 'refund_pending',
          });
          t.delete(this.db.collection('fulfillmentJobs').doc(unit.id));
        }
        const allRefunded =
          units.size > 0 &&
          units.docs.every(
            (u) =>
              u.get('status') === 'refunded' ||
              refunds.some(
                (r) =>
                  r.metadata?.alozuriOrderId === u.id &&
                  r.status === 'succeeded' &&
                  r.amount === u.get('amountCents'),
              ),
          );
        t.update(ref, {
          status:
            charge.disputed || (unassigned && !full)
              ? 'attention'
              : full || allRefunded
                ? 'refunded'
                : 'paid',
        });
        t.create(eventRef, { orderId: id, type: event.type, receivedAt: new Date().toISOString() });
      });
      return;
    }
    if (!event.type.startsWith('payment_intent.')) return;
    const source = event.data.object as Stripe.PaymentIntent,
      id = source.metadata?.alozuriPurchaseId;
    if (!id || !/^purchase_[a-f0-9]{48}$/.test(id)) return;
    const intent = await this.stripe.paymentIntents.retrieve(source.id),
      ref = this.db.collection('purchases').doc(id),
      eventRef = this.db.collection('commerceEvents').doc(this.mode + '_' + event.id);
    await this.db.runTransaction(async (t) => {
      const [doc, seen] = await Promise.all([t.get(ref), t.get(eventRef)]);
      if (seen.exists || !doc.exists) return;
      const p = purchaseSchema.parse(doc.data());
      this.assertIntent(id, p, intent);
      if (['cancelled', 'refunded', 'refund_pending', 'attention'].includes(p.status)) {
        t.create(eventRef, { orderId: id, type: event.type, receivedAt: new Date().toISOString() });
        return;
      }
      if (
        event.type === 'payment_intent.succeeded' &&
        intent.status === 'succeeded' &&
        intent.amount_received !== p.totalCents
      )
        throw new CommerceError('Received amount does not match the order.');
      if (
        event.type === 'payment_intent.succeeded' &&
        intent.status === 'succeeded' &&
        intent.amount_received === p.totalCents &&
        !p.paidAt
      ) {
        let index = 0;
        for (const line of p.items)
          for (let unit = 0; unit < line.quantity; unit++) {
            const childId = 'order_' + hash(id + ':' + index++).slice(0, 48),
              childRef = this.db.collection('orders').doc(childId);
            t.create(childRef, {
              uid: p.uid || 'guest_' + hash(id).slice(0, 24),
              plan: line.plan,
              amountCents: line.plan.priceCents,
              currency: 'USD',
              status: 'paid',
              test: p.test,
              createdAt: p.createdAt,
              paidAt: new Date().toISOString(),
              supplierCode: line.supplierCode,
              wholesaleUnits: line.wholesaleUnits,
              parentOrderId: id,
              chargeTotalCents: p.totalCents,
              paymentIntentId: intent.id,
              fulfillmentMode: p.test ? 'test_no_issuance' : 'esim_access',
            });
            if (!p.test)
              t.create(this.db.collection('fulfillmentJobs').doc(childId), {
                nextAttemptAt: Date.now(),
                leaseUntil: 0,
                attempts: 0,
                createdAt: p.createdAt,
              });
          }
        t.update(ref, {
          status: 'paid',
          paidAt: new Date().toISOString(),
          paymentIntentId: intent.id,
          emailDueAt: Date.now(),
        });
      } else if (!p.paidAt)
        t.update(ref, {
          status:
            intent.status === 'canceled'
              ? 'cancelled'
              : intent.status === 'processing'
                ? 'payment_processing'
                : 'pending_payment',
        });
      t.create(eventRef, { orderId: id, type: event.type, receivedAt: new Date().toISOString() });
    });
  }
  async order(id: string, user: Principal | null, access: string | undefined) {
    const doc = await this.db.collection('purchases').doc(id).get();
    if (!doc.exists) throw new CommerceError('Order not found.', 404);
    const p = purchaseSchema.parse(doc.data());
    if (!this.authorized(p, user, access)) throw new CommerceError('Order not found.', 404);
    const units = await this.db.collection('orders').where('parentOrderId', '==', id).get();
    const allocations = units.docs.map((d) => ({
      id: d.id,
      status: String(d.get('status')),
      plan: planSchema.parse(d.get('plan')),
    }));
    return {
      id,
      email: p.email,
      items: p.items.map(({ plan, quantity }) => ({ plan, quantity })),
      totalCents: p.totalCents,
      currency: p.currency,
      status: p.status,
      test: p.test,
      createdAt: p.createdAt,
      allocations,
    };
  }
  async activation(id: string, unitId: string, user: Principal | null, access: string | undefined) {
    await this.order(id, user, access);
    return this.db.runTransaction(async (t) => {
      const [unit, a] = await Promise.all([
        t.get(this.db.collection('orders').doc(unitId)),
        t.get(this.db.collection('orderActivations').doc(unitId)),
      ]);
      if (
        unit.get('parentOrderId') !== id ||
        unit.get('test') !== false ||
        unit.get('status') !== 'ready' ||
        unit.get('paymentBlocked') === true ||
        !a.exists ||
        a.get('uid') !== unit.get('uid')
      )
        throw new CommerceError('Installation details are not ready.', 404);
      return {
        ac: a.get('ac') as string,
        iccid: a.get('iccid') as string,
        esimTranNo: a.get('esimTranNo') as string,
      };
    });
  }
  async history(user: Principal) {
    const [owned, email] = await Promise.all([
      this.db.collection('purchases').where('uid', '==', user.uid).limit(100).get(),
      user.email
        ? this.db
            .collection('purchases')
            .where('email', '==', user.email.toLowerCase())
            .limit(100)
            .get()
        : Promise.resolve(null),
    ]);
    return [...new Map([...owned.docs, ...(email?.docs || [])].map((d) => [d.id, d])).values()]
      .map((d) => {
        const p = purchaseSchema.parse(d.data());
        return {
          id: d.id,
          items: p.items.map(({ plan, quantity }) => ({ plan, quantity })),
          totalCents: p.totalCents,
          currency: p.currency,
          status: p.status,
          test: p.test,
          createdAt: p.createdAt,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async notify() {
    if (!this.mailer) return { sent: 0 };
    let sent = 0;
    const docs = await this.db
      .collection('purchases')
      .where('emailDueAt', '<=', Date.now())
      .limit(10)
      .get();
    for (const doc of docs.docs) {
      const lease = await this.db.runTransaction(async (t) => {
        const d = await t.get(doc.ref);
        if (d.get('emailSentAt') || d.get('emailLeaseUntil') > Date.now()) return false;
        t.update(doc.ref, { emailLeaseUntil: Date.now() + 60000 });
        return true;
      });
      if (!lease) continue;
      try {
        const p = purchaseSchema.parse(doc.data()),
          units = await this.db.collection('orders').where('parentOrderId', '==', doc.id).get();
        if (
          !units.size ||
          units.docs.some(
            (u) => !(p.test ? ['paid'] : ['ready', 'refunded']).includes(u.get('status')),
          )
        ) {
          await doc.ref.update({ emailDueAt: Date.now() + 60000, emailLeaseUntil: 0 });
          continue;
        }
        await this.mailer.send({
          id: doc.id,
          email: p.email,
          url: this.site + '/checkout/success?order=' + doc.id + '#access=' + this.token(doc.id),
        });
        await doc.ref.update({
          emailSentAt: new Date().toISOString(),
          emailDueAt: Date.now() + 315360000000,
          emailLeaseUntil: 0,
        });
        sent++;
      } catch {
        await doc.ref.update({ emailDueAt: Date.now() + 60000, emailLeaseUntil: 0 });
      }
    }
    return { sent };
  }
}
export function configuredCommerce() {
  const mode = process.env.PAYMENTS_MODE,
    key = process.env.STRIPE_SECRET_KEY,
    secret = process.env.STRIPE_WEBHOOK_SECRET,
    access = process.env.ORDER_ACCESS_SECRET,
    site = process.env.SITE_URL;
  if (
    (mode !== 'test' && mode !== 'live') ||
    !key?.startsWith(`sk_${mode}_`) ||
    !secret ||
    !access ||
    access.length < 32 ||
    !site
  )
    return null;
  if (
    mode === 'live' &&
    (process.env.DEMO_MODE !== 'false' ||
      process.env.FULFILLMENT_ENABLED !== 'true' ||
      !process.env.ESIM_ACCESS_CODE ||
      !process.env.ESIM_SECRET_KEY ||
      !process.env.RESEND_API_KEY ||
      !process.env.ORDER_EMAIL_FROM ||
      !process.env.FULFILLMENT_WORKER_AUDIENCE ||
      !process.env.FULFILLMENT_WORKER_SERVICE_ACCOUNT)
  )
    return null;
  return new CommerceService(
    new Stripe(key, { maxNetworkRetries: 2, timeout: 15000 }),
    mode,
    secret,
    access,
    site.replace(/\/$/, ''),
    currentCheckoutPlan,
    database(),
    process.env.RESEND_API_KEY && process.env.ORDER_EMAIL_FROM
      ? new ResendOrderMailer(process.env.RESEND_API_KEY, process.env.ORDER_EMAIL_FROM)
      : null,
  );
}
export async function cartView(
  repository: Repository,
  items: CartItem[],
  cached: Record<string, unknown> = {},
) {
  const plans = await repository.plans();
  return items.map((i) => {
    const plan = plans.find((p) => p.id === i.planId && !p.demo);
    if (plan) return { plan, quantity: i.quantity };
    const old = planSchema.safeParse(cached[i.planId]);
    if (old.success) return { plan: old.data, quantity: i.quantity, unavailable: true };
    throw new CommerceError('A cart plan is no longer available. Remove it before syncing.');
  });
}
