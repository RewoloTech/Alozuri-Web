import Stripe from 'stripe';
import { z } from 'zod';
import type { Firestore, DocumentReference } from 'firebase-admin/firestore';
import { database } from './firebase.js';
import { STRIPE_APP_INFO } from './stripe-attribution.js';
import {
  calculateFinancial,
  financialSchema,
  financialSourceSchema,
  initialFinancial,
  safeInteger,
} from './financial-calculations.js';

/** Use only immutable order data; never read catalogue prices here. */
export async function refreshSupplierFinancial(db: Firestore, ref: DocumentReference) {
  await db.runTransaction(async (t) => {
    const parent = await t.get(ref);
    if (!parent.exists || parent.get('test') !== false) return;
    const parsed = financialSourceSchema.safeParse(parent.data());
    if (!parsed.success) throw new Error('Historical financial record needs review.');
    const p = parsed.data;
    const row = parent.get('financial')
      ? financialSchema.parse(parent.get('financial'))
      : initialFinancial(parent.id, ref.parent.id === 'purchases' ? 'purchases' : 'orders', p);
    const units =
      ref.parent.id === 'purchases'
        ? (await t.get(db.collection('orders').where('parentOrderId', '==', parent.id).limit(11)))
            .docs
        : [parent];
    if (units.length > 10) throw new Error('Invalid financial unit count.');
    const expected = row.packages.reduce((n, i) => n + i.quantity, 0);
    let known = units.length === expected;
    let cost = 0n;
    const states: string[] = [];
    for (const unit of units) {
      const u = financialSourceSchema.safeParse(unit.data());
      if (!u.success) {
        known = false;
        continue;
      }
      states.push(u.data.status);
      if (u.data.supplierOrderNo) {
        if (u.data.wholesaleUnits === undefined) known = false;
        else cost += BigInt(u.data.wholesaleUnits);
      } else if (
        !u.data.supplierRejected &&
        !(u.data.supplierAttempted === false && ['refunded', 'cancelled'].includes(u.data.status))
      )
        known = false;
    }
    row.supplier.purchasedUnits = known ? safeInteger(cost) : null;
    row.paid = Boolean(p.paidAt);
    row.paymentStatus =
      p.status === 'attention'
        ? p.status
        : row.selling.refundedMinor !== null && row.selling.refundedMinor > 0
          ? row.selling.refundedMinor === row.selling.amountMinor
            ? 'refunded'
            : 'partially_refunded'
          : p.status;
    row.fulfilmentStatus =
      states.length && states.every((s) => s === 'ready')
        ? 'fulfilled'
        : states.some((s) => ['provision_error', 'refund_pending'].includes(s))
          ? 'needs_attention'
          : states.length && states.every((s) => s === 'refunded')
            ? 'refunded'
            : states.length && states.every((s) => ['ready', 'refunded'].includes(s))
              ? 'partially_refunded'
              : 'pending';
    t.update(ref, { financial: financialSchema.parse(calculateFinancial(row)) });
  });
}
export class FinancialLedger {
  constructor(
    private db: Firestore,
    private stripe: Stripe,
    private secret: string,
    private live: boolean,
  ) {}
  async sync(ref: DocumentReference) {
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.get('test') !== !this.live) return;
    const p = financialSourceSchema.parse(snapshot.data());
    if (!p.paymentIntentId) {
      await refreshSupplierFinancial(this.db, ref);
      return;
    }
    const observedAt = new Date().toISOString();
    const intent = await this.stripe.paymentIntents.retrieve(p.paymentIntentId);
    const amount = p.totalCents ?? p.amountCents;
    if (
      intent.livemode !== this.live ||
      intent.amount !== amount ||
      intent.currency !== p.currency.toLowerCase()
    )
      throw new Error('Financial payment mismatch.');
    if (ref.parent.id === 'purchases' && intent.metadata.alozuriPurchaseId !== ref.id)
      throw new Error('Financial purchase mismatch.');
    const chargeId =
      typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
    if (!chargeId) {
      await refreshSupplierFinancial(this.db, ref);
      return;
    }
    const charge = await this.stripe.charges.retrieve(chargeId, {
      expand: ['balance_transaction'],
    });
    if (
      charge.payment_intent !== intent.id &&
      (typeof charge.payment_intent !== 'object' || charge.payment_intent?.id !== intent.id)
    )
      throw new Error('Financial charge mismatch.');
    const refunds = await this.stripe.refunds
      .list({ charge: charge.id, limit: 100, expand: ['data.balance_transaction'] })
      .autoPagingToArray({ limit: 10000 });
    const settled = refunds.filter((r) => r.status === 'succeeded');
    const refunded = safeInteger(settled.reduce((n, r) => n + BigInt(r.amount), 0n));
    if (refunded > charge.amount) throw new Error('Invalid refund total.');
    const chargeBt =
      typeof charge.balance_transaction === 'object' ? charge.balance_transaction : null;
    const refundBts = settled.map((r) =>
      typeof r.balance_transaction === 'object' ? r.balance_transaction : null,
    );
    const bts = [chargeBt, ...refundBts].filter((b): b is Stripe.BalanceTransaction => Boolean(b));
    const complete = Boolean(chargeBt) && refundBts.every(Boolean);
    const gbp = complete && bts.every((b) => b.currency === 'gbp');
    const sameCurrency = complete && bts.every((b) => b.currency === chargeBt?.currency);
    const pending =
      refunds.some((r) => r.status === 'pending' || r.status === 'requires_action') ||
      !complete ||
      charge.disputed;
    await this.db.runTransaction(async (t) => {
      const current = await t.get(ref);
      if (!current.exists) return;
      const latest = financialSourceSchema.parse(current.data());
      const row = current.get('financial')
        ? financialSchema.parse(current.get('financial'))
        : initialFinancial(ref.id, ref.parent.id === 'purchases' ? 'purchases' : 'orders', latest);
      if (row.stripe.observedAt && row.stripe.observedAt > observedAt) return;
      if (
        !row.usdGbp &&
        row.selling.currency === 'USD' &&
        chargeBt?.currency === 'gbp' &&
        chargeBt.amount > 0 &&
        charge.amount > 0
      ) {
        row.usdGbp = {
          numerator: String(chargeBt.amount),
          denominator: String(charge.amount),
          source: 'stripe-settlement:' + chargeBt.id,
          asOf: new Date(charge.created * 1000).toISOString(),
        };
      }
      row.selling.refundedMinor = refunded;
      row.paid = Boolean(latest.paidAt);
      row.paymentStatus = latest.status;
      row.stripe = {
        currency: chargeBt?.currency ?? null,
        feeMinor: sameCurrency ? safeInteger(bts.reduce((n, b) => n + BigInt(b.fee), 0n)) : null,
        balanceTransactions: bts.map((b) => b.id),
        exchangeRates: bts.map((b) => b.exchange_rate),
        observedAt,
        revenueGbp: gbp ? safeInteger(bts.reduce((n, b) => n + BigInt(b.amount), 0n)) : null,
        feesGbp: gbp ? safeInteger(bts.reduce((n, b) => n + BigInt(b.fee), 0n)) : null,
        refundsPending: pending,
      };
      t.update(ref, {
        financial: financialSchema.parse(calculateFinancial(row)),
        financialReconciliationPending: false,
      });
    });
    await refreshSupplierFinancial(this.db, ref);
  }
  async webhook(body: Buffer, signature: string) {
    const event = this.stripe.webhooks.constructEvent(body, signature, this.secret);
    if (event.livemode !== this.live) throw new Error('Financial webhook environment mismatch.');
    const relevant =
      event.type.startsWith('payment_intent.') ||
      event.type.startsWith('checkout.session.') ||
      [
        'charge.succeeded',
        'charge.updated',
        'charge.refunded',
        'refund.created',
        'refund.updated',
        'refund.failed',
        'charge.dispute.created',
        'charge.dispute.closed',
      ].includes(event.type);
    if (!relevant) return;
    let intentId: string | undefined;
    const object = z
      .object({
        id: z.string(),
        payment_intent: z.union([z.string(), z.object({ id: z.string() })]).nullish(),
        charge: z.union([z.string(), z.object({ id: z.string() })]).nullish(),
      })
      .parse(event.data.object);
    if (event.type.startsWith('payment_intent.')) intentId = object.id;
    else if (
      [
        'charge.succeeded',
        'charge.updated',
        'charge.refunded',
        'refund.created',
        'refund.updated',
        'refund.failed',
        'charge.dispute.created',
        'charge.dispute.closed',
      ].includes(event.type)
    ) {
      const pi = object.payment_intent;
      intentId = typeof pi === 'string' ? pi : pi?.id;
      if (!intentId && object.charge) {
        const id = typeof object.charge === 'string' ? object.charge : object.charge.id;
        const charge = await this.stripe.charges.retrieve(id);
        const pi = charge.payment_intent;
        intentId = typeof pi === 'string' ? pi : pi?.id;
      }
    } else if (event.type.startsWith('checkout.session.')) {
      const pi = object.payment_intent;
      intentId = typeof pi === 'string' ? pi : pi?.id;
    }
    if (!intentId) return;
    const intent = await this.stripe.paymentIntents.retrieve(intentId);
    const id = intent.metadata.alozuriPurchaseId;
    if (id && /^purchase_[a-f0-9]{48}$/.test(id)) {
      await this.sync(this.db.collection('purchases').doc(id));
      return;
    }
    // Legacy Checkout orders belong to this app only when a matching stored order exists.
    const legacy = await this.db
      .collection('orders')
      .where('paymentIntentId', '==', intentId)
      .limit(11)
      .get();
    for (const doc of legacy.docs) if (!doc.get('parentOrderId')) await this.sync(doc.ref);
  }
}
export function configuredFinancialLedger(db?: Firestore): FinancialLedger | null {
  const key = process.env.STRIPE_SECRET_KEY,
    secret = process.env.STRIPE_WEBHOOK_SECRET,
    mode = process.env.PAYMENTS_MODE;
  if (!key || !secret || !['live', 'test'].includes(mode ?? '') || !key.startsWith(`sk_${mode}_`))
    return null;
  return new FinancialLedger(
    db ?? database(),
    new Stripe(key, { timeout: 15000, maxNetworkRetries: 2, appInfo: STRIPE_APP_INFO }),
    secret,
    mode === 'live',
  );
}
