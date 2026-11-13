import { z } from 'zod';
import type { UsageSnapshot } from '../../../../packages/shared/src/esim-usage.ts';

const bytes = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const usageSnapshotSchema = z
  .object({
    kind: z.enum(['fixed', 'daily', 'unlimited']),
    usedBytes: bytes.nullable(),
    totalBytes: bytes.positive().nullable(),
    remainingBytes: bytes.nullable(),
    profileStatus: z
      .string()
      .max(64)
      .regex(/^[A-Z_]+$/),
    smdpStatus: z
      .string()
      .max(64)
      .regex(/^[A-Z_]+$/)
      .nullable()
      .default(null),
    esimTranNo: z.string().min(1).max(200).optional(),
    expiresAt: z.iso.datetime().nullable(),
    checkedAt: z.iso.datetime(),
  })
  .refine(
    (snapshot) =>
      snapshot.kind === 'fixed'
        ? snapshot.remainingBytes ===
          (snapshot.totalBytes !== null && snapshot.usedBytes !== null
            ? Math.max(0, snapshot.totalBytes - snapshot.usedBytes)
            : null)
        : snapshot.totalBytes === null && snapshot.remainingBytes === null,
    'Inconsistent usage counters.',
  );
const reportedStatus = (value: unknown) =>
  typeof value === 'string' && /^[A-Z_]{1,64}$/.test(value) ? value : null;
const profileSchema = z.object({
  orderNo: z.string().min(1).max(200),
  esimTranNo: z.string().min(1).max(200),
  packageList: z.array(z.object({ packageCode: z.string().min(1).max(200) })).min(1),
  totalVolume: bytes.nullish(),
  orderUsage: bytes.nullish(),
  dataType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  esimStatus: z.unknown().transform((value) => reportedStatus(value) ?? 'UNKNOWN'),
  smdpStatus: z.unknown().transform(reportedStatus),
  expiredTime: z.string().max(100).nullish(),
});
export function parseSupplierUsage(
  input: unknown,
  reference: { orderNo: string; esimTranNo: string; packageCode: string },
  kind: UsageSnapshot['kind'],
  now = Date.now(),
): UsageSnapshot | null {
  const rows = z.object({ esimList: z.array(profileSchema).max(1) }).parse(input).esimList;
  if (!rows.length) return null;
  const p = rows[0];
  if (
    p.orderNo !== reference.orderNo ||
    p.esimTranNo !== reference.esimTranNo ||
    !p.packageList.some((row) => row.packageCode === reference.packageCode)
  )
    throw new Error('Supplier usage reference mismatch.');
  // The catalogue also recognises supplier type-1 packages explicitly sold as
  // unlimited. Never reinterpret their volume as a fixed remaining allowance.
  if (
    p.dataType !== undefined &&
    !(kind === 'fixed'
      ? p.dataType === 1
      : kind === 'daily'
        ? p.dataType === 2 || p.dataType === 3
        : p.dataType === 1 || p.dataType === 4)
  )
    throw new Error('Supplier usage plan type mismatch.');
  const totalBytes = kind === 'fixed' && p.totalVolume && p.totalVolume > 0 ? p.totalVolume : null;
  const usedBytes = p.orderUsage ?? null;
  let expiresAt: string | null = null;
  if (p.expiredTime) {
    const date = Date.parse(p.expiredTime);
    if (!Number.isFinite(date)) throw new Error('Invalid supplier expiry.');
    expiresAt = new Date(date).toISOString();
  }
  return usageSnapshotSchema.parse({
    kind,
    usedBytes,
    totalBytes,
    remainingBytes:
      totalBytes !== null && usedBytes !== null ? Math.max(0, totalBytes - usedBytes) : null,
    profileStatus: p.esimStatus,
    smdpStatus: p.smdpStatus ?? null,
    esimTranNo: p.esimTranNo,
    expiresAt,
    checkedAt: new Date(now).toISOString(),
  });
}
