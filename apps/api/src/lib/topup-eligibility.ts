import { z } from 'zod';
import type { StoredPlan } from '../../../../packages/shared/src/index.ts';

const identifier = z.string().min(1).max(200);
export const topupPackageSchema = z.object({
  packageCode: identifier,
  slug: identifier.optional(),
  name: z.string().min(1).max(1000),
  price: z.number().int().positive().safe(),
  currencyCode: z.literal('USD'),
  volume: z.number().int().nonnegative().safe(),
  duration: z.number().int().min(1).max(365),
  durationUnit: z.literal('DAY'),
  location: z.string().min(2),
  dataType: z.number().int().min(1).max(4),
  supportTopUpType: z.number().int().min(1).max(3),
  speed: z.string().min(1),
  fupPolicy: z.string().nullish(),
});
export type TopupPackage = z.infer<typeof topupPackageSchema>;
/** Preserve verified supplier characteristics at purchase time. Historical
 * products without this evidence remain eligible for a NEW eSIM, not a top-up. */
export function topupPackageSnapshot(plan: StoredPlan): TopupPackage | undefined {
  if (!plan.supplierComparison) return undefined;
  const parsed = topupPackageSchema.safeParse({
    ...plan.supplierComparison.attributes,
    packageCode: plan.supplierCode,
    name: plan.supplierName ?? plan.name,
    price: plan.wholesaleUnits,
    currencyCode: plan.currency,
    volume: plan.dataGb * 1024 ** 3,
    supportTopUpType: plan.supplierComparison.topupType,
    fupPolicy: plan.supplierComparison.fup,
  });
  return parsed.success ? parsed.data : undefined;
}
export const topupProfileSchema = z.object({
  esimTranNo: identifier,
  orderNo: identifier,
  iccid: z.string().regex(/^\d{10,25}$/),
  esimStatus: z.string(),
  smdpStatus: z.string(),
  expiredTime: z.string().nullish(),
  packageList: z
    .array(z.object({ packageCode: identifier }))
    .min(1)
    .max(100),
});
export type TopupProfile = z.infer<typeof topupProfileSchema>;
export type TopupDecision =
  | { eligible: false; reason: string }
  | { eligible: true; expiresAt: string; packageCode: string; price: number; periodNum?: number };
const coverage = (location: string) => {
  const countries = [...new Set(location.split(',').map((c) => c.trim().toUpperCase()))].sort();
  return countries.length && countries.every((c) => /^[A-Z]{2}$/.test(c))
    ? countries.join(',')
    : null;
};
/** Never infer compatibility from a marketing name, location alone or cached usage. */
export function compatibleTopup(original: TopupPackage, candidate: TopupPackage): boolean {
  const region = coverage(original.location);
  return (
    Boolean(region) &&
    region === coverage(candidate.location) &&
    original.dataType === candidate.dataType &&
    original.volume === candidate.volume &&
    original.duration === candidate.duration &&
    original.durationUnit === candidate.durationUnit &&
    original.speed === candidate.speed &&
    (original.fupPolicy ?? '') === (candidate.fupPolicy ?? '')
  );
}
export function topupEligibility(input: {
  profile: TopupProfile;
  original: TopupPackage;
  candidates: TopupPackage[];
  esimTranNo: string;
  orderNo: string;
  topUpCount: number | null;
  days: number;
  now?: number;
}): TopupDecision {
  const { profile, original } = input;
  if (
    profile.esimTranNo !== input.esimTranNo ||
    profile.orderNo !== input.orderNo ||
    !profile.packageList.some((p) => p.packageCode === original.packageCode)
  )
    return { eligible: false, reason: 'profile_mismatch' };
  if (
    !['GOT_RESOURCE', 'IN_USE', 'USED_UP'].includes(profile.esimStatus) ||
    !['RELEASED', 'ENABLED', 'DISABLED'].includes(profile.smdpStatus)
  )
    return { eligible: false, reason: 'profile_status' };
  // Require an explicit timezone: never interpret ambiguous dates in the host timezone.
  const expiry = profile.expiredTime;
  if (!expiry || !/(?:Z|[+-]\d{2}:?\d{2})$/.test(expiry) || !Number.isFinite(Date.parse(expiry)))
    return { eligible: false, reason: 'expiry_unverified' };
  if (Date.parse(expiry) <= (input.now ?? Date.now()))
    return { eligible: false, reason: 'expired' };
  if (input.topUpCount === null || !Number.isInteger(input.topUpCount) || input.topUpCount < 0)
    return { eligible: false, reason: 'topup_history_unverified' };
  if (input.topUpCount >= 9) return { eligible: false, reason: 'topup_limit' };
  if (original.supportTopUpType === 1) return { eligible: false, reason: 'unsupported' };
  if (original.supportTopUpType === 3) {
    if (
      original.dataType === 1 ||
      !Number.isInteger(input.days) ||
      input.days < 1 ||
      input.days > 365
    )
      return { eligible: false, reason: 'daily_variant_unverified' };
    return {
      eligible: true,
      expiresAt: new Date(expiry).toISOString(),
      packageCode: original.packageCode,
      periodNum: input.days,
      price: original.price * input.days,
    };
  }
  if (original.dataType !== 1) return { eligible: false, reason: 'unsupported_variant' };
  // This list comes from the supplier's profile-specific TOPUP catalogue. A refill
  // can report supportTopUpType=1: that describes the refill's own capability,
  // not whether it may be applied to the original, top-up-capable eSIM.
  const candidates = input.candidates.filter((p) => compatibleTopup(original, p));
  // Ambiguous variants are not silently chosen; a supplier mapping is needed.
  if (candidates.length !== 1) return { eligible: false, reason: 'compatible_package_unverified' };
  const candidate = candidates[0];
  return {
    eligible: true,
    expiresAt: new Date(expiry).toISOString(),
    packageCode: candidate.slug ?? candidate.packageCode,
    price: candidate.price,
  };
}
