import type { Currency } from './index.ts';

// Retail preference policy, not tax residency or payment eligibility.
// Includes geographically European territories and transcontinental countries.
// XK is the commonly used Kosovo code, not an officially assigned ISO code.
const EURO_COUNTRIES = new Set([
  'AD',
  'AL',
  'AM',
  'AT',
  'AX',
  'AZ',
  'BA',
  'BE',
  'BG',
  'BY',
  'CH',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FO',
  'FR',
  'GE',
  'GI',
  'GR',
  'HR',
  'HU',
  'IE',
  'IS',
  'IT',
  'KZ',
  'LI',
  'LT',
  'LU',
  'LV',
  'MC',
  'MD',
  'ME',
  'MK',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'RS',
  'RU',
  'SE',
  'SI',
  'SJ',
  'SK',
  'SM',
  'TR',
  'UA',
  'VA',
  'XK',
]);
const STERLING_COUNTRIES = new Set(['GB', 'JE', 'GG', 'IM']);

export function currencyForCountry(country: string | null | undefined): Currency {
  const code = country?.trim().toUpperCase();
  if (code && STERLING_COUNTRIES.has(code)) return 'GBP';
  if (code && EURO_COUNTRIES.has(code)) return 'EUR';
  return 'USD';
}

export function preferredCurrency(
  saved: string | null,
  suggested: Currency,
  available: readonly Currency[],
): Currency {
  return available.find((c) => c === saved) ?? (available.includes(suggested) ? suggested : 'USD');
}
