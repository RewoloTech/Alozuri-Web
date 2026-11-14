import { isCountryCode } from '../../../../packages/shared/src/index.ts';
/** Country supplied on Stripe's verified charge; never infer it from currency or coverage. */
export function billingCountryCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return isCountryCode(code) ? code : null;
}
