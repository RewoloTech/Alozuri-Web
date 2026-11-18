import {
  promotionExtensions,
  promotionConfigHash,
  matchesPromotion,
  discountedUnit,
  promotionMarginAllowed,
} from './promotion-policy.js';
import type { Plan } from '../../../../packages/shared/src/index.ts';
import type { PriceExchange } from './exchange-rates.js';
import { campaignSchema, activeWindow } from './marketing-policy.js';
import { randomUUID } from 'node:crypto';
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
    ...promotionExtensions,
    code: promoCode,
    discountPercent: z.number().int().min(1).max(50),
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
  discountPercent: z.number().int().min(1).max(50),
  discount: promotionExtensions.discount,
  campaignId: promotionExtensions.campaignId,
  configHash: z.string().optional(),
  priceCuts: z
    .record(
      z.string(),
      z.object({ original: z.number().int().positive(), final: z.number().int().positive() }),
    )
    .optional(),
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
  z.number().int().min(1).max(50).parse(percent);
  return Number((BigInt(amount) * BigInt(percent)) / 100n);
};
export function eligibility(p: z.infer<typeof stored>, now = new Date().toISOString()) {
  if (!p.active)
    throw new OperationsError('Promotion is inactive.', 400, 'PROMO_CODE_NOT_APPLICABLE');
  if (Date.parse(now) < Date.parse(p.startsAt))
    throw new OperationsError('Promotion has not started.', 400, 'PROMO_CODE_NOT_APPLICABLE');
  if (Date.parse(now) >= Date.parse(p.expiresAt))
    throw new OperationsError('Promotion has expired.', 400, 'PROMO_CODE_EXPIRED');
  if (p.maxUses !== null && p.redemptionCount + Object.keys(p.holds).length >= p.maxUses)
    throw new OperationsError('Promotion usage limit reached or reserved by another checkout.');
}
export class Promotions {
  constructor(private db: Firestore) {}
  async get(code: string) {
    const id = promoCode.parse(code),
      doc = await this.db.doc('promotions/' + id).get();
    if (!doc.exists)
      throw new OperationsError('Invalid promotion code.', 400, 'PROMO_CODE_INVALID');
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
  async save(input: unknown, create: boolean, actor = 'system') {
    const p = promotionInput.parse(input),
      ref = this.db.doc('promotions/' + p.code);
    if (p.automatic && (p.maxUses !== null || (p.minimumOrderUsdCents ?? 0) > 0))
      throw new OperationsError(
        'Automatic catalogue discounts cannot have usage or basket minimums. Use a code for these restrictions.',
        400,
      );
    await this.db.runTransaction(async (t) => {
      const old = await t.get(ref);
      if (create === old.exists)
        throw new OperationsError(create ? 'Code already exists.' : 'Promotion not found.', 409);
      const targets = [
        ...new Set([
          ...(p.scope?.kind === 'products' ? p.scope.values : []),
          ...(p.scope?.excludedProducts ?? []),
        ]),
      ];
      if (
        targets.length &&
        (await t.getAll(...targets.map((id) => this.db.doc('packages/' + id)))).some(
          (d) => !d.exists,
        )
      )
        throw new OperationsError('Select existing internal product IDs.', 400);
      if (p.campaignId && !(await t.get(this.db.doc('marketingCampaigns/' + p.campaignId))).exists)
        throw new OperationsError('Campaign not found.', 400);
      const previous = old.exists ? stored.parse(old.data()) : null;
      if (
        p.maxUses !== null &&
        previous &&
        p.maxUses < previous.redemptionCount + Object.keys(previous.holds).length
      )
        throw new OperationsError('Limit cannot be below completed and reserved uses.');
      const now = new Date().toISOString();
      t.create(this.db.collection('marketingAudit').doc(), {
        actor,
        action: create ? 'create_discount' : 'update_discount',
        target: p.code,
        at: now,
        previous: old.data() ?? null,
        value: p,
      });
      t.set(this.db.doc('marketingState/current'), { revision: randomUUID() });
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
  async setActive(code: string, active: boolean, actor = 'system') {
    const id = promoCode.parse(code);
    z.boolean().parse(active);
    const ref = this.db.doc('promotions/' + id);
    await this.db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (!doc.exists) throw new OperationsError('Promotion not found.', 404);
      stored.parse(doc.data());
      t.create(this.db.collection('marketingAudit').doc(), {
        actor,
        action: 'discount_status',
        target: id,
        active,
        at: new Date().toISOString(),
      });
      t.set(this.db.doc('marketingState/current'), { revision: randomUUID() });
      t.update(ref, { active, updatedAt: new Date().toISOString() });
    });
  }
  async deleteUnused(code: string, actor = 'system') {
    const id = promoCode.parse(code),
      ref = this.db.doc('promotions/' + id);
    await this.db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (!doc.exists) throw new OperationsError('Promotion not found.', 404);
      const p = stored.parse(doc.data());
      if (
        p.redemptionCount ||
        Object.keys(p.holds).length ||
        Object.values(p.totals).some((total) => total.revenueMinor || total.discountMinor)
      )
        throw new OperationsError(
          'Used or reserved codes cannot be deleted. Pause this code instead.',
          409,
        );
      // Guard older/imported order snapshots as well as the promotion counters.
      const references = await Promise.all(
        ['purchases', 'orders'].flatMap((collection) =>
          ['promotion.id', 'financial.promotion.id'].map((field) =>
            t.get(this.db.collection(collection).where(field, '==', id).limit(1)),
          ),
        ),
      );
      const automaticReference = await t.get(
        this.db
          .collection('purchases')
          .where('automaticPromotionIds', 'array-contains', id)
          .limit(1),
      );
      if (!automaticReference.empty || references.some((page) => !page.empty))
        throw new OperationsError(
          'This code is referenced by an order. Pause it to preserve its history.',
          409,
        );
      t.create(this.db.collection('marketingAudit').doc(), {
        actor,
        action: 'delete_discount',
        target: id,
        at: new Date().toISOString(),
        previous: p,
      });
      t.set(this.db.doc('marketingState/current'), { revision: randomUUID() });
      t.delete(ref);
    });
  }
  async validate(code: string, own?: string): Promise<z.infer<typeof promotionSnapshot>> {
    const p = await this.get(code);
    eligibility({
      ...p,
      holds: Object.fromEntries(Object.entries(p.holds).filter(([id]) => id !== own)),
    });
    if (p.campaignId) {
      const campaign = await this.db.doc('marketingCampaigns/' + p.campaignId).get();
      if (!campaign.exists || !activeWindow(campaignSchema.parse(campaign.data())))
        throw new OperationsError('Campaign is not active.', 400);
    }
    return {
      ...(p.campaignId ? { campaignId: p.campaignId } : {}),
      id: p.code,
      code: p.code,
      discountPercent: p.discountPercent,
      ...(p.discount ? { discount: p.discount } : {}),
      ...(p.scope || p.discount || p.automatic || p.minimumOrderUsdCents || p.campaignId
        ? { configHash: promotionConfigHash(p) }
        : {}),
    };
  }
  async reserve(t: Transaction, id: string, snapshot: z.infer<typeof promotionSnapshot>) {
    const ref = this.db.doc('promotions/' + snapshot.id),
      doc = await t.get(ref);
    if (!doc.exists)
      throw new OperationsError('Promotion is unavailable.', 400, 'PROMO_CODE_INVALID');
    const p = stored.parse(doc.data());
    eligibility(p);
    if (p.campaignId) {
      const campaign = await t.get(this.db.doc('marketingCampaigns/' + p.campaignId));
      if (!campaign.exists || !activeWindow(campaignSchema.parse(campaign.data())))
        throw new OperationsError('Campaign is not active.', 409);
    }
    if (
      p.discountPercent !== snapshot.discountPercent ||
      (snapshot.configHash && snapshot.configHash !== promotionConfigHash(p))
    )
      throw new OperationsError('Promotion changed. Apply it again.', 409);
    if (Object.keys(p.holds).length >= 100)
      throw new OperationsError('Promotion checkout capacity reached. Try again shortly.', 409);
    t.update(ref, { holds: { ...p.holds, [id]: { at: Date.now() } } });
  }
  async automatic() {
    if (process.env.MARKETING_ENABLED !== 'true') return [];
    const docs = await this.db
      .collection('promotions')
      .where('automatic', '==', true)
      .limit(501)
      .get();
    if (docs.size > 500) throw new OperationsError('Promotion configuration requires review.', 503);
    const now = Date.now();
    const result = [];
    for (const doc of docs.docs) {
      const p = stored.parse(doc.data());
      if (!p.active || Date.parse(p.startsAt) > now || Date.parse(p.expiresAt) <= now) continue;
      if (p.maxUses !== null)
        throw new OperationsError('Automatic promotions cannot have redemption caps.', 503);
      if (p.campaignId) {
        const campaign = await this.db.doc('marketingCampaigns/' + p.campaignId).get();
        if (!campaign.exists || !activeWindow(campaignSchema.parse(campaign.data()), now)) continue;
        p.expiresAt = new Date(
          Math.min(Date.parse(p.expiresAt), Date.parse(campaign.get('expiresAt'))),
        ).toISOString();
      }
      result.push(p);
    }
    return result.sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.code.localeCompare(b.code),
    );
  }
  async automaticView(plans: Plan[], fx: PriceExchange): Promise<Plan[]> {
    const configs = (await this.automatic()).filter((p) => !(p.minimumOrderUsdCents ?? 0));
    if (!configs.length) return plans;
    const records = plans.length
      ? await this.db.getAll(...plans.map((p) => this.db.doc('packages/' + p.id)))
      : [];
    return plans.flatMap((input, i) => {
      const tags = z.array(z.string().max(100)).max(50).safeParse(records[i].get('tags'));
      const plan = tags.success ? { ...input, tags: tags.data } : input;
      const p = configs.find((p) => matchesPromotion(p, plan));
      if (!p) return [plan];
      try {
        const units = z.number().int().positive().safe().parse(records[i].get('wholesaleUnits'));
        const discounted = this.apply(plan, units, p, fx);
        return [
          {
            ...discounted,
            promotionPrice: {
              originalPriceCents: plan.priceCents,
              discountPercent:
                Math.floor(((plan.priceCents - discounted.priceCents) * 10000) / plan.priceCents) /
                100,
              campaign: p.code,
              expiresAt: p.expiresAt,
            },
          },
        ];
      } catch {
        return [];
      }
    });
  }
  async validateAutomatic(
    t: Transaction,
    snapshots: { automaticPromotion?: z.infer<typeof promotionSnapshot> }[],
  ) {
    const values = [
      ...new Map(
        snapshots.flatMap((l) =>
          l.automaticPromotion ? [[l.automaticPromotion.id, l.automaticPromotion] as const] : [],
        ),
      ).values(),
    ];
    const docs = values.length
      ? await t.getAll(...values.map((p) => this.db.doc('promotions/' + p.id)))
      : [];
    for (let i = 0; i < values.length; i++) {
      const p = stored.parse(docs[i].data());
      eligibility(p);
      if (p.campaignId) {
        const campaign = await t.get(this.db.doc('marketingCampaigns/' + p.campaignId));
        if (!campaign.exists || !activeWindow(campaignSchema.parse(campaign.data())))
          throw new OperationsError('Campaign is not active.', 409);
      }
      if (promotionConfigHash(p) !== values[i].configHash)
        throw new OperationsError('Promotion changed. Review checkout.', 409);
    }
  }
  async settleAutomatic(
    t: Transaction,
    lines: {
      automaticPromotion?: z.infer<typeof promotionSnapshot>;
      originalPriceCents?: number;
      quantity: number;
      plan: Plan;
    }[],
    currency: string,
  ) {
    const codes = [
      ...new Set(lines.flatMap((l) => (l.automaticPromotion ? [l.automaticPromotion.id] : []))),
    ];
    const docs = codes.length
      ? await t.getAll(...codes.map((code) => this.db.doc('promotions/' + code)))
      : [];
    docs.forEach((doc, index) => {
      const p = stored.parse(doc.data()),
        selected = lines.filter((l) => l.automaticPromotion?.id === codes[index]);
      const previous = p.totals[currency] ?? { revenueMinor: 0, discountMinor: 0 };
      t.update(doc.ref, {
        redemptionCount: p.redemptionCount + 1,
        totals: {
          ...p.totals,
          [currency]: {
            revenueMinor:
              previous.revenueMinor +
              selected.reduce((n, l) => n + l.plan.priceCents * l.quantity, 0),
            discountMinor:
              previous.discountMinor +
              selected.reduce(
                (n, l) =>
                  n +
                  ((l.originalPriceCents ?? l.plan.priceCents) - l.plan.priceCents) * l.quantity,
                0,
              ),
          },
        },
      });
    });
  }
  async applicable(code: string, plans: Plan[], subtotalUsd: number, own?: string) {
    const snapshot = await this.validate(code, own);
    const config = await this.get(code);
    if (subtotalUsd < (config.minimumOrderUsdCents ?? 0))
      throw new OperationsError('Minimum order value not met.', 400);
    if (!plans.some((plan) => matchesPromotion(config, plan)))
      throw new OperationsError('This promotion does not apply to these packages.', 400);
    return { snapshot, config };
  }
  apply(plan: Plan, units: number, p: z.infer<typeof stored>, fx: PriceExchange) {
    if (!matchesPromotion(p, plan)) return plan;
    let final: number;
    try {
      final = discountedUnit(plan.priceCents, p, fx);
    } catch {
      throw new OperationsError('This promotion must reduce the price by no more than 50%.', 409);
    }
    if (!promotionMarginAllowed(final, plan.currency, units, fx))
      throw new OperationsError(
        'This promotion does not meet the minimum contribution margin.',
        409,
      );
    return {
      ...plan,
      priceCents: final,
      promotionPrice: {
        originalPriceCents: plan.priceCents,
        discountPercent: Math.floor(((plan.priceCents - final) * 10000) / plan.priceCents) / 100,
        campaign: p.code,
        expiresAt: p.expiresAt,
      },
    };
  }
  async bind(code: string, id: string, intent: string) {
    await this.db.runTransaction(async (t) => {
      const ref = this.db.doc('promotions/' + code),
        d = await t.get(ref),
        p = stored.parse(d.data());
      if (!p.holds[id])
        throw new OperationsError(
          'Promotion reservation expired. Start a new checkout.',
          409,
          'PROMO_RESERVATION_EXPIRED',
        );
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
