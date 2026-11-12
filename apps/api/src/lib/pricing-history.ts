import type { Firestore, DocumentData, Query } from 'firebase-admin/firestore';
import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { database } from './firebase.js';
import { documentId } from './validation.js';
import { londonBounds, rounded } from './financial-calculations.js';
import { OperationsError } from './operations-error.js';
import type {
  PricingHistoryRow,
  PricingHistoryReport,
} from '../../../../packages/shared/src/pricing-history.ts';
const positive = z.number().int().positive().safe();
const identitySchema = z.object({
  id: documentId,
  name: z.string().trim().min(1).max(1000),
  countries: z
    .array(z.string().regex(/^[A-Z]{2}$/))
    .min(1)
    .max(250),
});
const decision = z.object({
  wholesaleUnits: z.unknown().optional(),
  priceCents: z.unknown().optional(),
  active: z.unknown().optional(),
});
const safeRound = (n: bigint, d: bigint) => {
  try {
    return rounded(n, d);
  } catch {
    return null;
  }
};
const percentage = (before: number | null, after: number | null) =>
  before === null || after === null
    ? null
    : safeRound((BigInt(after) - BigInt(before)) * 10000n, BigInt(before));
function margin(units: number | null, price: number | null) {
  if (units === null || price === null) return null;
  const retail = BigInt(price) * 100n;
  return safeRound((retail - BigInt(units)) * 10000n, retail);
}
export function pricingMovement(before: unknown, after: unknown) {
  const old = decision.parse(before),
    current = decision.parse(after);
  const amount = (value: unknown) => {
    const parsed = positive.safeParse(value);
    return parsed.success ? parsed.data : null;
  };
  const previousSupplierUnits = amount(old.wholesaleUnits),
    currentSupplierUnits = amount(current.wholesaleUnits),
    previousSellingMinor = amount(old.priceCents),
    currentSellingMinor = amount(current.priceCents);
  const direction: PricingHistoryRow['direction'] =
    currentSupplierUnits === null
      ? 'unavailable'
      : previousSupplierUnits === null
        ? 'baseline'
        : currentSupplierUnits > previousSupplierUnits
          ? 'increased'
          : currentSupplierUnits < previousSupplierUnits
            ? 'decreased'
            : 'unchanged';
  const previousMarginBps = margin(previousSupplierUnits, previousSellingMinor),
    currentMarginBps = margin(currentSupplierUnits, currentSellingMinor);
  return {
    previousSupplierUnits,
    currentSupplierUnits,
    previousSellingMinor,
    currentSellingMinor,
    direction,
    changeBps: percentage(previousSupplierUnits, currentSupplierUnits),
    previousMarginBps,
    currentMarginBps,
    marginChangeBps:
      previousMarginBps !== null && currentMarginBps !== null
        ? safeRound(BigInt(currentMarginBps) - BigInt(previousMarginBps), 1n)
        : null,
    active: typeof current.active === 'boolean' ? current.active : null,
  };
}
/** Enrich the EXISTING audit record; never create a parallel price-history store. */
export function pricingHistoryMetadata(packageData: unknown, before: unknown, after: unknown) {
  const identity = identitySchema.safeParse(packageData);
  return {
    historyVersion: 1,
    ...(identity.success ? { package: identity.data } : {}),
    supplierCurrency: 'USD',
    supplierScale: 10000,
    sellingCurrency: 'USD',
    ...pricingMovement(before, after),
  };
}
export const pricingHistoryQuery = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    packageId: documentId.optional(),
    cursor: z.string().max(1500).optional(),
  })
  .strict();
const cursorSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    packageId: z.string().nullable(),
    seconds: z.number().int().min(-62135596800).max(253402300799),
    nanoseconds: z.number().int().min(0).max(999999999),
    path: z
      .string()
      .regex(/^packages\/[a-zA-Z0-9_-]{1,100}\/pricingHistory\/[a-zA-Z0-9_-]{1,100}$/),
  })
  .strict();
export class PricingHistoryReports {
  constructor(private db: Firestore = database()) {}
  async report(input: z.infer<typeof pricingHistoryQuery>): Promise<PricingHistoryReport> {
    let bounds: ReturnType<typeof londonBounds>;
    try {
      bounds = londonBounds(input.from, input.to);
    } catch {
      throw new OperationsError('Choose a valid pricing date range.');
    }
    let query: Query<DocumentData> = input.packageId
      ? this.db.collection('packages').doc(input.packageId).collection('pricingHistory')
      : this.db.collectionGroup('pricingHistory');
    query = query
      .where('recordedAt', '>=', Timestamp.fromDate(new Date(bounds.start)))
      .where('recordedAt', '<', Timestamp.fromDate(new Date(bounds.end)))
      .orderBy('recordedAt', 'desc')
      .orderBy(FieldPath.documentId(), 'desc');
    if (input.cursor) {
      let cursor: z.infer<typeof cursorSchema>;
      try {
        cursor = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString()));
      } catch {
        throw new OperationsError('Invalid pricing history cursor.');
      }
      if (
        cursor.from !== input.from ||
        cursor.to !== input.to ||
        cursor.packageId !== (input.packageId ?? null) ||
        (input.packageId && cursor.path.split('/')[1] !== input.packageId)
      )
        throw new OperationsError('Pricing history selection changed.');
      query = query.startAfter(
        new Timestamp(cursor.seconds, cursor.nanoseconds),
        this.db.doc(cursor.path),
      );
    }
    const snapshot = await query.limit(26).get(),
      page = snapshot.docs.slice(0, 25);
    const historical = z.object({
      before: decision,
      after: decision,
      package: identitySchema.optional(),
      kind: z.string().max(100).optional(),
    });
    const parsed = page.map((doc) => {
      if (
        !/^packages\/[a-zA-Z0-9_-]{1,100}\/pricingHistory\/[a-zA-Z0-9_-]{1,100}$/.test(doc.ref.path)
      )
        throw new OperationsError('Unexpected pricing history record requires review.', 409);
      const record = historical.safeParse(doc.data());
      if (!record.success)
        throw new OperationsError('Historical pricing record requires review.', 409);
      const at = doc.get('recordedAt');
      if (!(at instanceof Timestamp))
        throw new OperationsError('Invalid pricing history date.', 409);
      const packageId = doc.ref.path.split('/')[1];
      if (record.data.package && record.data.package.id !== packageId)
        throw new OperationsError('Pricing history identity mismatch.', 409);
      return { doc, record: record.data, at, packageId };
    });
    const missing = [...new Set(parsed.filter((p) => !p.record.package).map((p) => p.packageId))];
    const parents = missing.length
      ? await this.db.getAll(...missing.map((id) => this.db.collection('packages').doc(id)))
      : [];
    const labels = new Map(
      parents.map((doc) => [doc.id, identitySchema.safeParse({ ...doc.data(), id: doc.id })]),
    );
    const rows: PricingHistoryRow[] = parsed.map((p) => {
      const fallback = labels.get(p.packageId);
      const identity = p.record.package ?? (fallback?.success ? fallback.data : null);
      return {
        id: p.doc.id,
        packageId: p.packageId,
        name: identity?.name ?? p.packageId,
        countries: identity?.countries ?? [],
        identitySource: p.record.package
          ? 'snapshot'
          : identity
            ? 'current_catalogue'
            : 'unavailable',
        recordedAt: p.at.toDate().toISOString(),
        kind: p.record.kind ?? 'catalogue_sync',
        supplierCurrency: 'USD',
        supplierScale: 10000,
        sellingCurrency: 'USD',
        ...pricingMovement(p.record.before, p.record.after),
      };
    });
    const last = parsed.at(-1);
    return {
      from: input.from,
      to: input.to,
      timezone: 'Europe/London',
      packageId: input.packageId ?? null,
      rows,
      nextCursor:
        snapshot.size > 25 && last
          ? Buffer.from(
              JSON.stringify({
                from: input.from,
                to: input.to,
                packageId: input.packageId ?? null,
                seconds: last.at.seconds,
                nanoseconds: last.at.nanoseconds,
                path: last.doc.ref.path,
              }),
            ).toString('base64url')
          : null,
    };
  }
}
