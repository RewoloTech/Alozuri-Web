export const BUSINESS = {
  brand: 'Alozuri',
  company: 'Rewolo Technologies Ltd',
  number: '16297656',
  jurisdiction: 'England and Wales',
  address: '124–128 City Road, London, EC1V 2NX, United Kingdom',
  email: 'support@alozuri.com',
  site: 'https://alozuri.com',
  identity:
    'Alozuri is a trading name of Rewolo Technologies Ltd, a company registered in England and Wales under company number 16297656.',
} as const;
export const LEGAL_VERSION = '2026-11-11.2';
export const LEGAL_EFFECTIVE_DATE = '2026-11-11';
export const CHECKOUT_NOTICE =
  'By placing your order, you agree to our Terms & Conditions and acknowledge our Refund Policy, Privacy Policy and eSIM Compatibility Requirements.';
export type CheckoutLegalAcceptance = {
  version: typeof LEGAL_VERSION;
  method: 'order_placement';
  noticeAcknowledged: true;
};
// Accepted only for an already-open checkout using the previous interface.
export type LegacyCheckoutLegalAcceptance = {
  version: '2026-11-11.1';
  termsAccepted: true;
  immediateSupplyRequested: true;
  cancellationAcknowledged: true;
};
export type CheckoutLegalInput = CheckoutLegalAcceptance | LegacyCheckoutLegalAcceptance;
export const CHECKOUT_LEGAL_ACCEPTANCE: CheckoutLegalAcceptance = {
  version: LEGAL_VERSION,
  method: 'order_placement',
  noticeAcknowledged: true,
};
