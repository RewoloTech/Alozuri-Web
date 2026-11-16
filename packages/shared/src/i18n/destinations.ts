import { countryName } from '../index.ts';
import type { Locale } from './locales.ts';

/** Display only; supplier country codes and coverage matching remain unchanged. */
export function destinationName(code: string, locale: Locale): string {
  if (!/^[A-Z]{2}$/.test(code)) throw new Error('Invalid destination code.');
  if (locale === 'en') return countryName(code);
  return new Intl.DisplayNames([locale], { type: 'region', fallback: 'code' }).of(code) ?? code;
}
