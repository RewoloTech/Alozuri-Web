import { z } from 'zod';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type Stripe from 'stripe';
import { OperationsError } from './operations-error.js';
export const promoCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,32}$/);
export const promotionInput = z
  .object({
    code: promoCode,
    discountPercent: z.number().int().min(1).max(30),
    active: z.boolean(),
    startsAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    maxUses: z.number().int().positive().safe().nullable(),
  })
  .strict()
  .refine(
    (p) => Date.parse(p.startsAt) < Date.parse(p.expiresAt),
    'Expiry must follow start date.',
  );
export const promotionSnapshot = z.object({
  id: promoCode,
  code: promoCode,
  discountPercent: z.number().int().min(1).max(30),
});
const holdSchema = z.object({
  at: z.number().int().nonnegative().safe(),
  intent: z.string().optional(),
});
const stored = z.object({
  ...promotionInput.shape,
  redemptionCount: z.number().int().nonnegative().safe(),
  holds: z.record(z.string(), holdSchema),
  totals: z.record(
    z.string(),
    z.object({
      revenueMinor: z.number().int().nonnegative().safe(),
      discountMinor: z.number().int().nonnegative().safe(),
    }),
  ),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const discountUnit = (amount: number, percent: number) => {
  z.number().int().positive().safe().parse(amount);
  z.number().int().min(1).max(30).parse(percent);
  return Number((BigInt(amount) * BigInt(percent)) / 100n);
};
export function eligibility(p: z.infer<typeof stored>, now = new Date().toISOString()) {
  if (!p.active) throw new OperationsError('Promotion is inactive.');
  if (Date.parse(now) < Date.parse(p.startsAt))
    throw new OperationsError('Promotion has not started.');
  if (Date.parse(now) >= Date.parse(p.expiresAt))
    throw new OperationsError('Promotion has expired.');
  if (p.maxUses !== null && p.redemptionCount + Object.keys(p.holds).length >= p.maxUses)
    throw new OperationsError('Promotion usage limit reached or reserved by another checkout.');
}
export class Promotions {
  constructor(private db: Firestore) {}
  async get(code: string) {
    const id = promoCode.parse(code),
      doc = await this.db.doc('promotions/' + id).get();
    if (!doc.exists) throw new OperationsError('Invalid promotion code.');
    return stored.parse(doc.data());
  }
  async list(after?: string, prefix = '', active?: boolean) {
    let query = this.db.collection('promotions').orderBy('code').limit(21);
    if (prefix) query = query.where('code', '>=', prefix).where('code', '<=', prefix + '\uf8ff');
    if (active !== undefined) query = query.where('active', '==', active);
    if (after) query = query.startAfter(promoCode.parse(after));
    const page = await query.get();
    return {
      rows: page.docs.slice(0, 20).map((d) => {
        const { holds, ...p } = stored.parse(d.data());
        return { ...p, reservedCount: Object.keys(holds).length };
      }),
      nextCursor: page.size > 20 ? page.docs[19].id : null,
    };
  }
  async save(input: unknown, create: boolean) {
    const p = promotionInput.parse(input),
      ref = this.db.doc('promotions/' + p.code);
    await this.db.runTransaction(async (t) => {
      const old = await t.get(ref);
      if (create === old.exists)
        throw new OperationsError(create ? 'Code already exists.' : 'Promotion not found.', 409);
      const previous = old.exists ? stored.parse(old.data()) : null;
      if (
        p.maxUses !== null &&
        previous &&
        p.maxUses < previous.redemptionCount + Object.keys(previous.holds).length
      )
        throw new OperationsError('Limit cannot be below completed and reserved uses.');
      const now = new Date().toISOString();
      t.set(ref, {
        ...p,
        startsAt: new Date(p.startsAt).toISOString(),
        expiresAt: new Date(p.expiresAt).toISOString(),
        redemptionCount: previous?.redemptionCount ?? 0,
        holds: previous?.holds ?? {},
        totals: previous?.totals ?? {},
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      });
    });
  }
  async validate(code: string, own?: string) {
    const p = await this.get(code);
    eligibility({
      ...p,
      holds: Object.fromEntries(Object.entries(p.holds).filter(([id]) => id !== own)),
    });
    return { id: p.code, code: p.code, discountPercent: p.discountPercent };
  }
  async reserve(t: Transaction, id: string, snapshot: z.infer<typeof promotionSnapshot>) {
    const ref = this.db.doc('promotions/' + snapshot.id),
      doc = await t.get(ref);
    if (!doc.exists) throw new OperationsError('Promotion is unavailable.');
    const p = stored.parse(doc.data());
    eligibility(p);
    if (p.discountPercent !== snapshot.discountPercent)
      throw new OperationsError('Promotion changed. Apply it again.', 409);
    if (Object.keys(p.holds).length >= 100)
      throw new OperationsError('Promotion checkout capacity reached. Try again shortly.', 409);
    t.update(ref, { holds: { ...p.holds, [id]: { at: Date.now() } } });
  }
  async bind(code: string, id: string, intent: string) {
    await this.db.runTransaction(async (t) => {
      const ref = this.db.doc('promotions/' + code),
        d = await t.get(ref),
        p = stored.parse(d.data());
      if (!p.holds[id])
        throw new OperationsError('Promotion reservation expired. Start a new checkout.', 409);
      t.update(ref, { holds: { ...p.holds, [id]: { ...p.holds[id], intent } } });
    });
  }
  async settle(
    t: Transaction,
    code: string,
    id: string,
    paid: boolean,
    currency: string,
    amount: number,
    discount: number,
  ) {
    const ref = this.db.doc('promotions/' + code),
      d = await t.get(ref),
      p = stored.parse(d.data());
    if (!p.holds[id]) {
      if (!paid) return;
      throw new OperationsError('Promotion reservation requires review.', 409);
    }
    const holds = { ...p.holds };
    delete holds[id];
    const totals = { ...p.totals };
    if (paid) {
      const old = totals[currency] ?? { revenueMinor: 0, discountMinor: 0 };
      totals[currency] = {
        revenueMinor: old.revenueMinor + amount,
        discountMinor: old.discountMinor + discount,
      };
    }
    const next = stored.parse({
      ...p,
      holds,
      totals,
      redemptionCount: p.redemptionCount + (paid ? 1 : 0),
    });
    t.update(ref, {
      holds: next.holds,
      totals: next.totals,
      redemptionCount: next.redemptionCount,
    });
  }
  async releaseExpired(code: string, stripe: Stripe) {
    const p = await this.get(code);
    for (const [id, hold] of Object.entries(p.holds)
      .filter(([, h]) => h.at <= Date.now() - 30 * 60 * 1000)
      .slice(0, 10)) {
      if (hold.at > Date.now() - 30 * 60 * 1000) continue;
      const purchase = await this.db.doc('purchases/' + id).get();
      if (purchase.get('paidAt') || purchase.get('promotion.id') !== p.code) continue;
      const intentId = hold.intent ?? purchase.get('paymentIntentId');
      if (intentId) {
        const intent = await stripe.paymentIntents.retrieve(intentId);
        if (intent.metadata.alozuriPurchaseId !== id) continue;
        if (intent.status === 'succeeded' || intent.status === 'processing') continue;
        if (
          intent.status !== 'canceled' &&
          (await stripe.paymentIntents.cancel(intentId)).status !== 'canceled'
        )
          continue;
      }
      await this.db.runTransaction(async (t) => {
        const ref = this.db.doc('promotions/' + code),
          [doc, order] = await Promise.all([t.get(ref), t.get(this.db.doc('purchases/' + id))]);
        const current = stored.parse(doc.data());
        if (order.get('paidAt') || !current.holds[id] || current.holds[id].at !== hold.at) return;
        // Binding may race with cleanup. Never free a slot for a different, still-payable intent.
        if (
          (current.holds[id].intent && current.holds[id].intent !== intentId) ||
          (order.get('paymentIntentId') && order.get('paymentIntentId') !== intentId)
        )
          return;
        const holds = { ...current.holds };
        delete holds[id];
        t.update(ref, { holds });
      });
    }
  }
}
