import { countryName } from '../index.ts';
import type { Locale } from './locales.ts';

/** Display only; supplier country codes and coverage matching remain unchanged. */
export function destinationName(code: string, locale: Locale): string {
  if (!/^[A-Z]{2}$/.test(code)) throw new Error('Invalid destination code.');
  if (locale === 'ro' && code === 'EG') return 'Egypt';
  if (locale === 'en') return countryName(code);
  return new Intl.DisplayNames([locale], { type: 'region', fallback: 'code' }).of(code) ?? code;
}

const middleEast: Record<Locale, string> = {
  en: 'Middle East',
  es: 'Oriente Medio',
  de: 'Naher Osten',
  fr: 'Moyen-Orient',
  it: 'Medio Oriente',
  'pt-BR': 'Oriente Médio',
  ro: 'Orientul Mijlociu',
  ja: '中東',
  ko: '중동',
  'zh-Hans': '中东',
  'zh-Hant': '中東',
  ar: 'الشرق الأوسط',
  nl: 'Midden-Oosten',
  pl: 'Bliski Wschód',
  tr: 'Orta Doğu',
  ru: 'Ближний Восток',
  vi: 'Trung Đông',
  id: 'Timur Tengah',
  hi: 'मध्य पूर्व',
  th: 'ตะวันออกกลาง',
  uk: 'Близький Схід',
};
/** Geographic display names only; no inference about supplier coverage. */
export function regionDisplayName(region: string, locale: Locale): string | undefined {
  if (region === 'Middle East') return middleEast[locale];
  const codes: Record<string, string> = {
    Europe: '150',
    Americas: '019',
    Asia: '142',
    Oceania: '009',
    Africa: '002',
    'North America': '003',
    'South America': '005',
    'Central America': '013',
    Caribbean: '029',
    'North Africa': '015',
  };
  const code = Object.hasOwn(codes, region) ? codes[region] : undefined;
  if (!code) return undefined;
  return locale === 'en' ? region : new Intl.DisplayNames([locale], { type: 'region' }).of(code);
}
