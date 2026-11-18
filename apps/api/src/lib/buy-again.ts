import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { SupplierClient, activationSchema } from './supplier.js';
import { topupEligibility, topupPackageSchema, compatibleTopup } from './topup-eligibility.js';

export function repeatProductIdentity(value: unknown): string {
  const p = z
    .object({
      countries: z.array(z.string()),
      dataGb: z.number(),
      days: z.number(),
      dataType: z.string(),
      dailyPolicy: z.string().optional(),
      fairUse: z.string().default(''),
    })
    .parse(value);
  return JSON.stringify({ ...p, countries: [...p.countries].sort() });
}
export const repeatDecisionSchema = z.object({
  originalPackage: topupPackageSchema.optional(),
  productIdentity: z.string(),
  method: z.enum(['TOPUP', 'NEW_ESIM']),
  sourceOrderId: z.string(),
  profileOrderId: z.string().optional(),
  productId: z.string(),
  supplierCode: z.string(),
  supplierCost: z.number().int().positive().safe(),
  newSupplierCost: z.number().int().positive().safe(),
  periodNum: z.number().int().min(1).max(365).optional(),
  expiresAt: z.number(),
  createdAt: z.number(),
  uid: z.string(),
});
export type RepeatDecision = z.infer<typeof repeatDecisionSchema>;
export class BuyAgainError extends Error {
  readonly statusCode = 409;
}
/** Uses existing orders and private activations; never exposes a supplier payload. */
export class BuyAgainService {
  constructor(
    private db: Firestore,
    private supplier: Pick<
      SupplierClient,
      'packages' | 'topupProfile' | 'topupPackages' | 'topup'
    > = new SupplierClient(),
    private now = Date.now,
  ) {}
  private async owned(uid: string, id: string) {
    const order = await this.db.doc('orders/' + id).get();
    if (
      !order.exists ||
      order.get('uid') !== uid ||
      order.get('test') !== false ||
      order.get('status') !== 'ready' ||
      order.get('paymentBlocked')
    )
      throw new BuyAgainError('Previous order unavailable.');
    return order;
  }
  private async canonicalSource(uid: string, sourceOrderId: string) {
    const source = await this.owned(uid, sourceOrderId);
    return source.get('repeatDecision.method') === 'TOPUP'
      ? this.owned(uid, z.string().parse(source.get('repeatDecision.sourceOrderId')))
      : source;
  }
  async options(uid: string, sourceOrderId: string) {
    const original = await this.canonicalSource(uid, sourceOrderId);
    const productId = z.string().parse(original.get('plan.id'));
    const candidates = await this.db.collection('orders').where('uid', '==', uid).limit(101).get();
    if (candidates.size > 100) throw new BuyAgainError('Please contact support to select an eSIM.');
    const profiles: {
      id: string;
      maskedIccid: string;
      expiresAt: string;
      purchasedAt: string;
      packageName: string;
      packageType: 'fixed' | 'daily' | 'unlimited';
    }[] = [];
    const seenProfiles = new Set<string>();
    for (const order of candidates.docs) {
      if (
        order.get('plan.id') !== productId ||
        order.get('repeatDecision.method') === 'TOPUP' ||
        order.get('status') !== 'ready' ||
        order.get('test') !== false ||
        order.get('paymentBlocked')
      )
        continue;
      const checked = await this.check(uid, sourceOrderId, order.id);
      if (checked?.decision.eligible && !seenProfiles.has(checked.profile.esimTranNo)) {
        seenProfiles.add(checked.profile.esimTranNo);
        profiles.push({
          id: order.id,
          maskedIccid: '•••• ' + checked.profile.iccid.slice(-4),
          expiresAt: checked.decision.expiresAt,
          purchasedAt: order.get('createdAt'),
          packageName: order.get('plan.name'),
          packageType: z.enum(['fixed', 'daily', 'unlimited']).parse(order.get('plan.dataType')),
        });
      }
    }
    return { productId, profiles };
  }
  private async check(uid: string, sourceId: string, profileId: string) {
    const source = await this.canonicalSource(uid, sourceId),
      order = await this.owned(uid, profileId);
    if (
      order.get('plan.id') !== source.get('plan.id') ||
      order.get('supplierCode') !== source.get('supplierCode')
    )
      throw new BuyAgainError('Package mismatch.');
    const record = await this.db.doc('orderActivations/' + profileId).get();
    if (record.get('uid') !== uid || record.get('topupLockOrderId')) return null;
    const purchased = topupPackageSchema.safeParse(order.get('originalSupplierPackage'));
    if (!purchased.success || purchased.data.packageCode !== order.get('supplierCode')) return null;
    const activation = activationSchema.parse(record.data());
    const raw = await this.supplier.packages({ packageCode: order.get('supplierCode') });
    const packages = raw
      .map((value) => topupPackageSchema.safeParse(value))
      .filter((p) => p.success)
      .map((p) => p.data!);
    const original = packages.find((p) => p.packageCode === order.get('supplierCode'));
    if (
      !original ||
      !compatibleTopup(purchased.data, original) ||
      original.supportTopUpType !== purchased.data.supportTopUpType
    )
      return null;
    const plan = source.get('plan');
    if (
      original.duration !== (plan.dataType === 'daily' ? 1 : plan.days) ||
      original.volume !== plan.dataGb * 1024 ** 3 ||
      original.location
        .split(',')
        .map((c) => c.trim())
        .sort()
        .join(',') !== [...plan.countries].sort().join(',')
    )
      return null;
    const shared = await this.db
      .doc('serviceLocks/topup_' + createHash('sha256').update(activation.esimTranNo).digest('hex'))
      .get();
    if (shared.get('orderId') || (shared.exists && shared.get('uid') !== uid)) return null;
    const profile = await this.supplier.topupProfile(activation.esimTranNo);
    if (profile.iccid !== activation.iccid) return null;
    const available =
      original.supportTopUpType === 2 ? await this.supplier.topupPackages(profile.iccid) : [];
    const decision = topupEligibility({
      profile,
      original,
      candidates: available,
      esimTranNo: activation.esimTranNo,
      orderNo: order.get('supplierOrderNo'),
      topUpCount:
        record.get('topUpHistoryKnown') === true
          ? Math.max(record.get('topUpCount'), shared.get('count') ?? 0)
          : null,
      days: plan.days,
      now: this.now(),
    });
    return { decision, profile, activation, original };
  }
  async quote(uid: string, sourceOrderId: string, profileOrderId?: string) {
    const source = await this.canonicalSource(uid, sourceOrderId);
    sourceOrderId = source.id;
    const checked = profileOrderId ? await this.check(uid, sourceOrderId, profileOrderId) : null;
    if (profileOrderId && !checked?.decision.eligible)
      throw new BuyAgainError('This eSIM is no longer eligible. Check again.');
    const decision = checked?.decision;
    const value = repeatDecisionSchema.parse({
      method: decision?.eligible ? 'TOPUP' : 'NEW_ESIM',
      uid,
      sourceOrderId,
      ...(decision?.eligible
        ? {
            profileOrderId,
            originalPackage: checked!.original,
            supplierCode: decision.packageCode,
            supplierCost: decision.price,
            ...(decision.periodNum ? { periodNum: decision.periodNum } : {}),
          }
        : { supplierCode: source.get('supplierCode'), supplierCost: source.get('wholesaleUnits') }),
      productIdentity: repeatProductIdentity(source.get('plan')),
      productId: source.get('plan.id'),
      newSupplierCost: source.get('wholesaleUnits'),
      createdAt: this.now(),
      expiresAt: this.now() + 10 * 60_000,
    });
    const id = randomUUID();
    await this.db.doc('buyAgainQuotes/' + id).create(value);
    return { id, decision: value.method, productId: value.productId, expiresAt: value.expiresAt };
  }
  async decision(uid: string, quoteId: string) {
    if (process.env.BUY_AGAIN_ENABLED !== 'true') throw new BuyAgainError('Buy Again disabled.');
    const data = await this.db.doc('buyAgainQuotes/' + z.uuid().parse(quoteId)).get();
    const decision = repeatDecisionSchema.parse(data.data());
    if (decision.uid !== uid || decision.expiresAt <= this.now())
      throw new BuyAgainError('Buy Again quote expired.');
    return decision;
  }
  /** Called only after the existing fulfilment service verifies the Stripe payment. */
  async fulfill(orderId: string, uid: string, decision: RepeatDecision): Promise<boolean> {
    if (decision.method !== 'TOPUP') return false;
    const orderRef = this.db.doc('orders/' + orderId);
    const profileRef = this.db.doc('orderActivations/' + decision.profileOrderId!);
    const existing = await orderRef.get();
    if (existing.get('topupReceipt')) return true;
    if (existing.get('topupAttempted')) throw new BuyAgainError('TOPUP_PENDING_RECONCILIATION');
    const checked = await this.check(uid, decision.sourceOrderId, decision.profileOrderId!);
    if (
      checked &&
      !checked.decision.eligible &&
      checked.decision.reason === 'expired' &&
      decision.originalPackage &&
      compatibleTopup(decision.originalPackage, checked.original) &&
      checked.original.packageCode === decision.originalPackage.packageCode &&
      checked.original.price <= decision.newSupplierCost
    ) {
      await this.db.runTransaction(async (t) => {
        const current = await t.get(orderRef);
        if (
          current.get('uid') !== uid ||
          current.get('status') !== 'paid' ||
          current.get('paymentBlocked') === true ||
          current.get('topupAttempted')
        )
          throw new BuyAgainError('Replacement requires review.');
        t.update(orderRef, {
          supplierCode: checked.original.packageCode,
          wholesaleUnits: checked.original.price,
          repeatDecision: { ...decision, method: 'NEW_ESIM' },
          topupState: 'NEW_ESIM_REPLACEMENT',
        });
      });
      return false;
    }
    if (
      !checked?.decision.eligible ||
      checked.decision.packageCode !== decision.supplierCode ||
      checked.decision.price !== decision.supplierCost ||
      !decision.originalPackage ||
      !compatibleTopup(decision.originalPackage, checked.original)
    )
      throw new BuyAgainError('Eligibility or supplier price changed; manual review required.');
    const sharedRef = this.db.doc(
      'serviceLocks/topup_' + createHash('sha256').update(checked.profile.esimTranNo).digest('hex'),
    );
    const transactionId = 'tu_' + createHash('sha256').update(orderId).digest('hex').slice(0, 40);
    await this.db.runTransaction(async (t) => {
      const [order, profile, shared] = await t.getAll(orderRef, profileRef, sharedRef);
      if (
        order.get('uid') !== uid ||
        order.get('status') !== 'paid' ||
        order.get('paymentBlocked') === true ||
        !order.get('paidAt') ||
        order.get('topupAttempted') ||
        profile.get('uid') !== uid ||
        profile.get('topupLockOrderId') ||
        profile.get('topUpHistoryKnown') !== true ||
        profile.get('topUpCount') >= 9 ||
        shared.get('orderId') ||
        (shared.get('count') ?? 0) >= 9 ||
        (shared.exists && shared.get('uid') !== uid)
      )
        throw new BuyAgainError('Concurrent top-up or order needs review.');
      const reservedCount = z
        .number()
        .int()
        .min(0)
        .max(8)
        .parse(Math.max(profile.get('topUpCount'), shared.get('count') ?? 0));
      t.set(sharedRef, { uid, orderId, count: reservedCount });
      t.update(profileRef, { topupLockOrderId: orderId });
      t.update(orderRef, {
        topupAttempted: true,
        supplierAttempted: true,
        supplierTransactionId: transactionId,
        topupState: 'TOPUP_PENDING_RECONCILIATION',
        status: 'fulfilling',
      });
    });
    // No retry, no replacement purchase and no lock expiry after sending this mutation.
    const response = await this.supplier.topup({
      esimTranNo: checked.profile.esimTranNo,
      packageCode: decision.supplierCode,
      amount: decision.supplierCost,
      transactionId,
      ...(decision.periodNum ? { periodNum: decision.periodNum } : {}),
    });
    if (response.iccid !== checked.profile.iccid)
      throw new BuyAgainError('TOPUP_PENDING_RECONCILIATION');
    await this.db.runTransaction(async (t) => {
      const [order, profile, shared] = await t.getAll(orderRef, profileRef, sharedRef);
      if (order.get('topupReceipt')) return;
      if (
        shared.get('orderId') !== orderId ||
        profile.get('topupLockOrderId') !== orderId ||
        order.get('supplierTransactionId') !== response.transactionId
      )
        throw new BuyAgainError('Top-up lock requires reconciliation.');
      const { topupLockOrderId: _lock, ...data } = profile.data()!;
      void _lock;
      const count = z.number().int().min(0).max(8).parse(shared.get('count')) + 1;
      t.set(sharedRef, { uid, count });
      t.set(profileRef, {
        ...data,
        topUpCount: count,
        expiresAt: new Date(response.expiredTime).toISOString(),
        lastSupplierSyncAt: this.now(),
      });
      t.set(this.db.doc('orderActivations/' + orderId), { ...checked.activation, uid });
      t.update(orderRef, {
        topupReceipt: {
          transactionId: response.transactionId,
          supplierReference: response.topUpEsimTranNo,
          expiresAt: new Date(response.expiredTime).toISOString(),
        },
        supplierOrderNo: checked.profile.orderNo,
        status:
          order.get('paymentBlocked') ||
          ['refunded', 'refund_pending', 'cancelled'].includes(order.get('status'))
            ? order.get('status')
            : 'ready',
        topupState: 'TOPUP_SUCCESSFUL',
        readyAt: new Date(this.now()).toISOString(),
      });
      t.delete(this.db.doc('fulfillmentJobs/' + orderId));
    });
    return true;
  }
}
