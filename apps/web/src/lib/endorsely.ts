declare global {
  interface Window {
    endorsely_referral?: unknown;
  }
}

// Optional attribution must never prevent a customer from checking out.
export function endorselyReferral(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const referral = window.endorsely_referral;
  return typeof referral === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(referral)
    ? referral
    : undefined;
}
