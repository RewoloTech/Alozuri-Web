export const BUSINESS = {
  brand: 'Alozuri',
  company: 'Rewolo Technologies Ltd',
  number: '16297656',
  jurisdiction: 'England and Wales',
  address: '124–128 City Road, London, EC1V 2NX, United Kingdom',
  email: 'info@alozuri.com',
  site: 'https://alozuri.com',
  identity:
    'Alozuri is a trading name of Rewolo Technologies Ltd, a company registered in England and Wales under company number 16297656.',
} as const;
export const LEGAL_VERSION = '2026-11-11.1';
export const LEGAL_EFFECTIVE_DATE = '2026-11-11';
export const EARLY_SUPPLY_REQUEST =
  'I expressly request immediate supply of my eSIM before the 14-day cancellation period ends.';
export const CANCELLATION_ACKNOWLEDGEMENT =
  'I understand that, where my purchase is digital content, my cancellation right ends when supply begins with my express consent and this acknowledgement. For a service, cancellation rights are affected only as the law permits, including proportionate charges for requested early performance and loss of the right after full performance with the required consent. My rights for faulty or misdescribed products are not waived.';
export type CheckoutLegalAcceptance = {
  version: typeof LEGAL_VERSION;
  termsAccepted: true;
  immediateSupplyRequested: true;
  cancellationAcknowledged: true;
};
export const CHECKOUT_LEGAL_ACCEPTANCE: CheckoutLegalAcceptance = {
  version: LEGAL_VERSION,
  termsAccepted: true,
  immediateSupplyRequested: true,
  cancellationAcknowledged: true,
};
