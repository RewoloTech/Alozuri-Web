import { purchaseOwnerUid } from './purchase-ownership.js';
import { createHash, randomUUID } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { EsimUsage, UsageSnapshot } from '../../../../packages/shared/src/esim-usage.ts';
import { usageSnapshotSchema } from './usage-data.js';

export const USAGE_CACHE_MS = 15 * 60 * 1000;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;
export class UsageError extends Error {
  readonly statusCode = 404;
}
export interface UsageSupplier {
  usage(
    orderNo: string,
    esimTranNo: string,
    packageCode: string,
    kind: UsageSnapshot['kind'],
  ): Promise<UsageSnapshot | null>;
}
const referenceSchema = z.object({
  supplierOrderNo: z.string().min(1).max(200),
  supplierCode: z.string().min(1).max(200),
  esimTranNo: z.string().min(1).max(200),
  kind: z.enum(['fixed', 'daily', 'unlimited']),
});
type Reference = z.infer<typeof referenceSchema>;
const fingerprint = (r: Reference) => createHash('sha256').update(JSON.stringify(r)).digest('hex');

export class EsimUsageService {
  constructor(
    private db: Firestore,
    private supplier: UsageSupplier,
    private now = Date.now,
  ) {}
  private async context(t: Transaction, purchaseId: string, unitId: string, operations = false) {
    const [parent, unit, activation] = await t.getAll(
      this.db.doc('purchases/' + purchaseId),
      this.db.doc('orders/' + unitId),
      this.db.doc('orderActivations/' + unitId),
    );
    if (!parent.exists || !unit.exists || unit.get('parentOrderId') !== purchaseId)
      throw new UsageError('Usage is not available for this eSIM.');
    if (
      parent.get('test') !== false ||
      unit.get('test') !== false ||
      (!operations &&
        (unit.get('paymentBlocked') === true ||
          parent.get('status') !== 'paid' ||
          ['refunded', 'refund_pending', 'cancelled', 'provision_error'].includes(
            unit.get('status'),
          )))
    )
      return null;
    if (typeof parent.get('paidAt') !== 'string' || (!operations && unit.get('status') !== 'ready'))
      return undefined;
    const uid = purchaseOwnerUid(purchaseId, parent.get('uid') ?? null);
    if (!activation.exists || unit.get('uid') !== uid || activation.get('uid') !== uid)
      return undefined;
    const parsed = referenceSchema.safeParse({
      supplierOrderNo: unit.get('supplierOrderNo'),
      supplierCode: unit.get('supplierCode'),
      esimTranNo: activation.get('esimTranNo'),
      kind: unit.get('plan')?.dataType,
    });
    return parsed.success ? parsed.data : undefined;
  }
  private cached(
    data: FirebaseFirestore.DocumentData | undefined,
    hash: string,
    now: number,
  ): UsageSnapshot | null {
    if (data?.referenceHash !== hash) return null;
    const parsed = usageSnapshotSchema.safeParse(data.snapshot);
    if (!parsed.success) return null;
    const age = now - Date.parse(parsed.data.checkedAt);
    return age >= 0 && age <= MAX_STALE_MS ? parsed.data : null;
  }
  private result(
    snapshot: UsageSnapshot | null,
    now: number,
    state: 'pending' | 'unavailable' = 'pending',
  ): EsimUsage {
    return snapshot
      ? {
          state: 'available',
          snapshot,
          stale: now - Date.parse(snapshot.checkedAt) >= USAGE_CACHE_MS,
        }
      : { state, snapshot: null, stale: false };
  }
  // Caller must authorize the purchase before invoking this service. Recheck
  // payment/ownership linkage even for cache hits and after slow supplier calls.
  async get(purchaseId: string, unitId: string): Promise<EsimUsage> {
    return this.read(purchaseId, unitId, false);
  }
  // Only the independently administrator-authorized Operations route may use this.
  async getForOperations(purchaseId: string, unitId: string): Promise<EsimUsage> {
    return this.read(purchaseId, unitId, true);
  }
  private async read(purchaseId: string, unitId: string, operations: boolean): Promise<EsimUsage> {
    const ref = this.db.doc('esimUsage/' + unitId),
      budgetRef = this.db.doc('supplierLimits/esim-usage');
    const lease = randomUUID(),
      now = this.now();
    const claim = await this.db.runTransaction(async (t) => {
      const reference = await this.context(t, purchaseId, unitId, operations);
      if (!reference)
        return { response: this.result(null, now, reference === null ? 'unavailable' : 'pending') };
      const [cache, budget] = await t.getAll(ref, budgetRef);
      const hash = fingerprint(reference),
        snapshot = this.cached(cache.data(), hash, now);
      if (
        snapshot &&
        cache.get('schemaVersion') === 2 &&
        now - Date.parse(snapshot.checkedAt) < USAGE_CACHE_MS
      )
        return { response: this.result(snapshot, now) };
      if (cache.get('leaseUntil') > now) return { response: this.result(snapshot, now) };
      if (cache.get('nextAttemptAt') > now)
        return {
          response: this.result(
            snapshot,
            now,
            cache.get('lastFailure') === true ? 'unavailable' : 'pending',
          ),
        };
      const windowStart =
        typeof budget.get('windowStart') === 'number' ? budget.get('windowStart') : 0;
      const count = now - windowStart >= 1000 ? 0 : Number(budget.get('count') || 0);
      // Leave supplier capacity for fulfilment and catalogue operations.
      if (count >= 4) return { response: this.result(snapshot, now) };
      t.set(budgetRef, { windowStart: count === 0 ? now : windowStart, count: count + 1 });
      t.set(ref, { lease, leaseUntil: now + 60000 }, { merge: true });
      return { reference };
    });
    if (claim.response) return claim.response;
    const reference = claim.reference;
    if (!reference) return this.result(null, now);
    let snapshot: UsageSnapshot | null = null,
      failed = false;
    try {
      const value = await this.supplier.usage(
        reference.supplierOrderNo,
        reference.esimTranNo,
        reference.supplierCode,
        reference.kind,
      );
      if (value) {
        snapshot = usageSnapshotSchema.parse({
          ...value,
          checkedAt: new Date(this.now()).toISOString(),
        });
        if (snapshot.kind !== reference.kind) throw new Error('Usage plan type mismatch.');
      }
    } catch {
      failed = true;
      snapshot = null;
    }
    return this.db.runTransaction(async (t) => {
      const current = await this.context(t, purchaseId, unitId, operations);
      const cache = await t.get(ref),
        at = this.now();
      if (!current || fingerprint(current) !== fingerprint(reference)) {
        if (cache.get('lease') === lease) t.set(ref, { leaseUntil: 0 }, { merge: true });
        return this.result(null, at, 'unavailable');
      }
      if (cache.get('lease') !== lease)
        return this.result(this.cached(cache.data(), fingerprint(current), at), at);
      if (snapshot) {
        t.set(ref, {
          snapshot,
          referenceHash: fingerprint(current),
          schemaVersion: 2,
          leaseUntil: 0,
          nextAttemptAt: 0,
        });
        return this.result(snapshot, at);
      }
      t.set(
        ref,
        { leaseUntil: 0, nextAttemptAt: at + 60000, lastFailure: failed },
        { merge: true },
      );
      return this.result(
        this.cached(cache.data(), fingerprint(current), at),
        at,
        failed ? 'unavailable' : 'pending',
      );
    });
  }
}
