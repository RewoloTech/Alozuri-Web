import { ownsPurchase, purchaseOwnerUid } from './purchase-ownership.js';
import { activationSchema } from './supplier.js';
import {
  orderTaskConfig,
  configuredOrderTaskQueue,
  recordOrderWork,
  dispatchOrderWork,
  type OrderTaskQueue,
} from './order-task-queue.js';
import { legalSnapshot, legalSnapshotSchema } from './legal.js';
import { ResendOrderMailer, type OrderMailer } from './order-email.js';
import { OrderConfirmations } from './order-confirmations.js';
import {
  CONFIRMATION_VERSION,
  confirmationVersionSchema,
  orderReference,
} from './confirmation-order.js';
import { confirmationOrderSchema } from './confirmation-order.js';
export { ResendOrderMailer, type OrderMailer } from './order-email.js';
import { type CheckoutLegalInput } from '../../../../packages/shared/src/legal.ts';
import {
  ExchangeRates,
  currencySchema,
  convertedPlan,
  priceExchange,
  type PriceExchange,
} from './exchange-rates.js';
import { validPackagePricing, currentCatalogueDate } from './package-pricing.js';
import { checkedMoney } from './pricing.js';
import type { Currency } from '../../../../packages/shared/src/index.ts';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import Stripe from 'stripe';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import { database } from './firebase.js';
import { SupplierClient } from './supplier.js';
import { EsimUsageService, UsageError } from './usage.js';
import type { EsimUsage } from '../../../../packages/shared/src/esim-usage.ts';
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
  baseSellingPriceUsdCents: z.number().int().positive().optional(),
  pricingVersion: z.string().optional(),
  exchange: z
    .object({
      source: z.string(),
      asOf: z.string(),
      fetchedAt: z.string(),
      numerator: z.string(),
      denominator: z.string(),
    })
    .optional(),
  quantity: z.number().int().min(1).max(5),
  supplierCode: z.string().min(1),
  wholesaleUnits: z.number().int().positive(),
});
const purchaseSchema = z
  .object({
    uid: z.string().nullable(),
    email: z.email(),
    items: z.array(snapshotSchema).min(1).max(10),
    currency: currencySchema,
    totalCents: z.number().int().positive(),
    subtotalCents: z.number().int().nonnegative().optional(),
    taxCents: z.number().int().nonnegative().optional(),
    confirmationVersion: confirmationVersionSchema.optional(),
    orderReference: z.string().optional(),
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
    legal: legalSnapshotSchema.optional(),
  })
  .refine(
    (p) =>
      p.items.every((i) => i.plan.currency === p.currency) &&
      p.items.reduce((n, i) => n + BigInt(i.plan.priceCents) * BigInt(i.quantity), 0n) ===
        BigInt(p.totalCents),
    'Stored payment amount or currency mismatch.',
  );
type Purchase = z.infer<typeof purchaseSchema>;
export type Quote = {
  items: { plan: Plan; quantity: number }[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: Currency;
};
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export async function priceCart(
  items: CartItem[],
  loadPlan: (id: string) => Promise<StoredPlan>,
  currency: Currency = 'USD',
  exchange: PriceExchange = priceExchange('USD'),
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
      p.catalogueVisibility === 'hidden' ||
      !validPackagePricing(p) ||
      !currentCatalogueDate(p.catalogueDate) ||
      !Number.isSafeInteger(p.priceCents) ||
      !p.supplierCode ||
      !Number.isSafeInteger(p.wholesaleUnits) ||
      p.wholesaleUnits <= 0
    )
      throw new CommerceError('A plan is unavailable. Update your cart.');
    snapshots.push({
      plan: convertedPlan(planSchema.parse(p), currency, exchange),
      baseSellingPriceUsdCents: p.priceCents,
      pricingVersion: p.pricingVersion,
      exchange,
      quantity: item.quantity,
      supplierCode: p.supplierCode,
      wholesaleUnits: p.wholesaleUnits,
    });
  }
  const total = checkedMoney(
    snapshots.reduce((n, i) => n + BigInt(i.plan.priceCents) * BigInt(i.quantity), 0n),
  );
  if (!Number.isSafeInteger(total) || total > 99999999)
    throw new CommerceError('Order amount is outside the supported range.');
  return {
    snapshots,
    quote: {
      items: snapshots.map(({ plan, quantity }) => ({ plan, quantity })),
      subtotalCents: total,
      taxCents: 0,
      totalCents: total,
      currency,
    },
  };
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
    private capacity:
      ((items: { wholesaleUnits: number; quantity: number }[]) => Promise<void>) | null = null,
    private rates: Pick<ExchangeRates, 'current'> = new ExchangeRates(),
    private usageReader = new EsimUsageService(db, new SupplierClient()),
    private taskQueue: OrderTaskQueue | null = configuredOrderTaskQueue(),
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
  private async priced(items: CartItem[], currency: Currency) {
    const fx = priceExchange(currency, currency === 'USD' ? undefined : await this.rates.current());
    return priceCart(items, this.loadPlan, currency, fx);
  }
  quote(items: CartItem[], currency: Currency = 'USD') {
    if (process.env.CHECKOUT_PAUSED === 'true')
      throw new CommerceError('Checkout is temporarily paused for catalogue maintenance.', 503);
    return this.priced(items, currency).then((r) => r.quote);
  }
  private token(id: string) {
    return createHmac('sha256', this.accessSecret)
      .update('guest-order:' + id)
      .digest('base64url');
  }
  private authorized(p: Purchase, user: Principal | null, access: string | undefined) {
    if (ownsPurchase(p, user)) return true;
    if (!access) return false;
    const actual = Buffer.from(hash(access)),
      expected = Buffer.from(p.accessHash);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  async checkout(
    input: {
      items: CartItem[];
      email: string;
      emailConfirmation?: string;
      requestId: string;
      compatible: true;
      legal: CheckoutLegalInput;
      currency: Currency;
      expectedTotalCents: number;
    },
    user: Principal | null,
  ) {
    if (process.env.CHECKOUT_PAUSED === 'true')
      throw new CommerceError('Checkout is temporarily paused for catalogue maintenance.', 503);
    if (
      input.emailConfirmation !== undefined &&
      input.email.toLowerCase() !== input.emailConfirmation.toLowerCase()
    )
      throw new CommerceError('Email addresses do not match.');
    const acceptance = legalSnapshot(input.legal);
    const email = input.email.toLowerCase(),
      owner = user?.verified ? user.uid : 'guest',
      id = 'purchase_' + hash(this.mode + ':' + owner + ':' + input.requestId).slice(0, 48),
      ref = this.db.collection('purchases').doc(id),
      accessToken = this.token(id);
    const { quote, snapshots } = await this.priced(input.items, input.currency);
    await this.capacity?.(snapshots);
    if (input.expectedTotalCents !== quote.totalCents)
      throw new CommerceError('The price changed. Review the updated total before paying.', 409);
    const proposed = {
      uid: user?.verified ? user.uid : null,
      email,
      items: snapshots,
      currency: input.currency,
      totalCents: quote.totalCents,
      subtotalCents: quote.subtotalCents,
      taxCents: quote.taxCents,
      confirmationVersion: CONFIRMATION_VERSION,
      orderReference: orderReference(id),
      status: 'pending_payment' as const,
      test: this.mode === 'test',
      createdAt: new Date().toISOString(),
      accessHash: hash(accessToken),
      legal: acceptance,
    };
    const purchase = await this.db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (doc.exists) {
        const p = purchaseSchema.parse(doc.data());
        if (
          p.legal?.version !== acceptance.version ||
          p.email !== email ||
          p.totalCents !== proposed.totalCents ||
          p.currency !== proposed.currency ||
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
            currency: purchase.currency.toLowerCase(),
            // Alozuri sends the complete confirmation; do not force a second Stripe receipt.
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
      intent.currency !== p.currency.toLowerCase() ||
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
            own.some(
              (r) =>
                r.status === 'succeeded' &&
                r.amount === unit.get('amountCents') &&
                r.currency === p.currency.toLowerCase(),
            );
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
                  r.amount === u.get('amountCents') &&
                  r.currency === p.currency.toLowerCase(),
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
        const paidAt = new Date(
          z.number().int().positive().parse(event.created) * 1000,
        ).toISOString();
        let index = 0;
        for (const line of p.items)
          for (let unit = 0; unit < line.quantity; unit++) {
            const childId = 'order_' + hash(id + ':' + index++).slice(0, 48),
              childRef = this.db.collection('orders').doc(childId);
            t.create(childRef, {
              uid: purchaseOwnerUid(id, p.uid),
              plan: line.plan,
              amountCents: line.plan.priceCents,
              currency: p.currency,
              legalVersion: p.legal?.version ?? null,
              baseSellingPriceUsdCents: line.baseSellingPriceUsdCents ?? line.plan.priceCents,
              pricingVersion: line.pricingVersion ?? 'legacy',
              exchange: line.exchange ?? null,
              status: 'paid',
              test: p.test,
              createdAt: p.createdAt,
              paidAt,
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
        if (!p.test && this.taskQueue)
          recordOrderWork(t, this.db, { kind: 'purchase', id, generation: 1 });
        t.update(ref, {
          status: 'paid',
          paidAt,
          paymentIntentId: intent.id,
          ...(!p.test && p.legal
            ? {
                confirmationVersion: CONFIRMATION_VERSION,
                confirmationDueAt: Date.now(),
                confirmationStatus: 'pending',
              }
            : {}),
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
    // Even a duplicate event must repair a committed payment whose queue write failed.
    if (this.taskQueue && this.mode === 'live')
      await dispatchOrderWork(this.db, this.taskQueue, id);
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
      reference: p.orderReference ?? orderReference(id),
      ...(doc.get('confirmationStatus') === 'attention' ||
      doc.get('confirmationDeliveryStatus') === 'failed'
        ? { confirmationNeedsSupport: true }
        : {}),
      email: p.email,
      items: p.items.map(({ plan, quantity }) => ({ plan, quantity })),
      totalCents: p.totalCents,
      currency: p.currency,
      status: p.status,
      test: p.test,
      createdAt: p.createdAt,
      contractDownloadAvailable: Boolean(p.paidAt && p.legal),
      ...(p.paidAt ? { paidAt: p.paidAt } : {}),
      allocations,
      ...(p.legal ? { legal: p.legal } : {}),
    };
  }
  async contractPdf(id: string, user: Principal | null, access: string | undefined) {
    const doc = await this.db.collection('purchases').doc(id).get();
    if (!doc.exists) throw new CommerceError('Order not found.', 404);
    const purchase = purchaseSchema.parse(doc.data());
    if (!this.authorized(purchase, user, access)) throw new CommerceError('Order not found.', 404);
    if (!purchase.paidAt || !purchase.legal)
      throw new CommerceError('Your contract is available after payment is confirmed.', 409);
    const order = confirmationOrderSchema.parse({ ...doc.data(), id });
    const { renderContractPdf } = await import('./contract-pdf.js');
    return renderContractPdf(order);
  }
  async activation(id: string, unitId: string, user: Principal | null, access: string | undefined) {
    await this.order(id, user, access);
    return this.db.runTransaction(async (t) => {
      const [parent, unit, a] = await Promise.all([
        t.get(this.db.collection('purchases').doc(id)),
        t.get(this.db.collection('orders').doc(unitId)),
        t.get(this.db.collection('orderActivations').doc(unitId)),
      ]);
      if (!parent.exists) throw new CommerceError('Order not found.', 404);
      const purchase = purchaseSchema.parse(parent.data());
      if (!this.authorized(purchase, user, access))
        throw new CommerceError('Order not found.', 404);
      if (
        purchase.status !== 'paid' ||
        !purchase.paidAt ||
        purchase.test ||
        unit.get('uid') !== purchaseOwnerUid(id, purchase.uid) ||
        unit.get('parentOrderId') !== id ||
        unit.get('test') !== false ||
        unit.get('status') !== 'ready' ||
        unit.get('paymentBlocked') === true ||
        !a.exists ||
        a.get('uid') !== unit.get('uid')
      )
        throw new CommerceError('Installation details are not ready.', 404);
      const activation = activationSchema.safeParse(a.data());
      if (!activation.success) throw new CommerceError('Installation details are not ready.', 404);
      return activation.data;
    });
  }
  async usage(
    id: string,
    unitId: string,
    user: Principal | null,
    access: string | undefined,
  ): Promise<EsimUsage> {
    const purchase = await this.order(id, user, access);
    if (!purchase.allocations.some((unit) => unit.id === unitId))
      throw new CommerceError('Usage is not available for this eSIM.', 404);
    if (this.mode !== 'live' || purchase.test)
      return { state: 'unavailable', snapshot: null, stale: false };
    try {
      const usage = await this.usageReader.get(id, unitId);
      await this.order(id, user, access); // Ownership may change while the supplier is responding.
      return usage;
    } catch (error) {
      if (error instanceof UsageError) throw new CommerceError(error.message, error.statusCode);
      throw error;
    }
  }
  async history(user: Principal) {
    if (!user.verified) throw new CommerceError('Sign in with a verified account.', 401);
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
    const purchases = [
      ...new Map(
        [...owned.docs, ...(email?.docs.filter((doc) => doc.get('uid') === null) || [])].map(
          (d) => [d.id, d],
        ),
      ).values(),
    ];
    const allocations = new Map<string, { id: string; status: string; plan: Plan }[]>();
    const chunks: string[][] = [];
    for (let i = 0; i < purchases.length; i += 10)
      chunks.push(purchases.slice(i, i + 10).map((d) => d.id));
    const groups = await Promise.all(
      chunks.map((ids) => this.db.collection('orders').where('parentOrderId', 'in', ids).get()),
    );
    for (const group of groups)
      for (const doc of group.docs) {
        const parentId = String(doc.get('parentOrderId'));
        const list = allocations.get(parentId) ?? [];
        list.push({
          id: doc.id,
          status: String(doc.get('status')),
          plan: planSchema.parse(doc.get('plan')),
        });
        allocations.set(parentId, list);
      }
    return purchases
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
          allocations: allocations.get(d.id) ?? [],
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async notify(purchaseId?: string) {
    if (!this.mailer) return { sent: 0, failed: 0, attention: 0 };
    return new OrderConfirmations(this.db, this.mailer, this.site, (id) => this.token(id)).run(
      purchaseId,
    );
  }
}
export async function checkSupplierCapacity(
  items: { wholesaleUnits: number; quantity: number }[],
  getBalance = () => new SupplierClient().balance(),
) {
  let balance: number;
  try {
    balance = await getBalance();
  } catch {
    throw new CommerceError('Purchases are temporarily unavailable. Please try again later.', 503);
  }
  const required = items.reduce((sum, line) => sum + line.wholesaleUnits * line.quantity, 0);
  if (!Number.isSafeInteger(balance) || balance < required)
    throw new CommerceError(
      'This plan is temporarily unavailable for purchase. Please try again later.',
      503,
    );
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
      (!orderTaskConfig() &&
        (!process.env.FULFILLMENT_WORKER_AUDIENCE ||
          !process.env.FULFILLMENT_WORKER_SERVICE_ACCOUNT)))
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
    process.env.RESEND_API_KEY ? new ResendOrderMailer(process.env.RESEND_API_KEY) : null,
    mode === 'live' ? checkSupplierCapacity : null,
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
