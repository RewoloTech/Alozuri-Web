/** Presentation only. Never derive a locale from a currency, country or IP. */
export const LOCALES = [
  'en',
  'es',
  'de',
  'fr',
  'it',
  'pt-BR',
  'ro',
  'ja',
  'ko',
  'zh-Hans',
  'ar',
  'nl',
  'pl',
] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'alozuri_locale';
export const LOCALE_EXPLICIT_COOKIE = 'alozuri_locale_explicit';
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  'pt-BR': 'Português (Brasil)',
  ro: 'Română',
  ja: '日本語',
  ko: '한국어',
  'zh-Hans': '简体中文',
  ar: 'العربية',
  nl: 'Nederlands',
  pl: 'Polski',
};
export type ReviewStatus = 'draft' | 'reviewed' | 'published' | 'missing';
export const REQUIRED_DOMAINS = [
  'website',
  'checkout',
  'errors',
  'installation',
  'email',
  'legal',
  'documents',
] as const;
export type ContentDomain = (typeof REQUIRED_DOMAINS)[number];
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.some((locale) => locale === value);
}
export function localeReview(locale: Locale): Record<ContentDomain, ReviewStatus> {
  if (!isLocale(locale)) throw new LocaleUnavailableError();
  // Complete content is enabled in this build. Deployment and professional
  // legal approval are separate; see POLICY_TRANSLATION_REVIEW.
  return {
    website: 'published',
    checkout: 'published',
    errors: 'published',
    installation: 'published',
    email: 'published',
    legal: 'published',
    documents: 'published',
  };
}
export function isPublishedLocale(value: unknown): value is Locale {
  return (
    isLocale(value) &&
    REQUIRED_DOMAINS.every((domain) => localeReview(value)[domain] === 'published')
  );
}
export const PUBLISHED_LOCALES = LOCALES.filter(isPublishedLocale);
/** Website preference and transaction readiness are deliberately separate. */
export const INTERFACE_LOCALES = LOCALES;
export function requireInterfaceLocale(value: unknown): Locale {
  if (!isLocale(value)) throw new LocaleUnavailableError();
  return value;
}
export const localeDirection = (locale: Locale): 'ltr' | 'rtl' => (locale === 'ar' ? 'rtl' : 'ltr');
export const stripeElementsLocale = (locale: Locale) => (locale === 'zh-Hans' ? 'zh' : locale);
export class LocaleUnavailableError extends Error {
  readonly code = 'LOCALE_NOT_READY';
  readonly statusCode = 409;
  constructor() {
    super('This language is not available for checkout. Please select a published language.');
  }
}
export function requirePublishedLocale(value: unknown): Locale {
  if (!isPublishedLocale(value)) throw new LocaleUnavailableError();
  return value;
}
/** Absence means a historical English order. Invalid/present values never fall back. */
export function orderLocale(value: unknown): Locale {
  if (value === undefined) return 'en';
  if (!isLocale(value)) throw new LocaleUnavailableError();
  return value;
}
export function negotiateLocale(
  values: readonly string[],
  available: readonly Locale[] = INTERFACE_LOCALES,
): Locale {
  for (const raw of values) {
    const value = raw.trim().toLowerCase();
    const exact = LOCALES.find((locale) => locale.toLowerCase() === value);
    const alias = /^pt(?:-|$)/.test(value)
      ? 'pt-BR'
      : /^zh(?:-|$)/.test(value) && !/^zh-(?:hant|tw|hk|mo)(?:-|$)/.test(value)
        ? 'zh-Hans'
        : LOCALES.find((locale) => locale === value.split('-')[0]);
    const candidate = exact ?? alias;
    if (candidate && available.includes(candidate)) return candidate;
  }
  return 'en';
}
export function resolveLocale(
  input: { explicit?: unknown; account?: unknown; guest?: unknown; browser?: readonly string[] },
  available: readonly Locale[] = INTERFACE_LOCALES,
): Locale {
  for (const candidate of [input.explicit, input.account, input.guest])
    if (isLocale(candidate) && available.includes(candidate)) return candidate;
  return negotiateLocale(input.browser ?? [], available);
}
export function localePath(path: string, locale: Locale): string {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid local path.');
  const first = path.split(/[/?#]/)[1];
  const stripped = isLocale(first) ? path.slice(first.length + 1) || '/' : path;
  const clean = /^[?#]/.test(stripped) ? '/' + stripped : stripped;
  if (/^\/(?:api|operations|admin|_next)(?:[/?#]|$)/.test(clean)) return clean;
  return locale === 'en' ? clean : '/' + locale + (clean === '/' ? '' : clean);
}
/** An explicitly language-prefixed link keeps the language requested by its author. */
export function navigationLocalePath(path: string, locale: Locale): string {
  const first = path.split(/[/?#]/)[1];
  return isLocale(first) ? path : localePath(path, locale);
}
export function unlocalizedPath(path: string): string {
  const first = path.split('/')[1];
  return isLocale(first) ? path.slice(first.length + 1) || '/' : path;
}
export function internalLocalePath(path: string): boolean {
  return /^\/(?:api|operations|admin|_next|__)(?:[/?#]|$)/.test(unlocalizedPath(path));
}
export function privateLocalePath(path: string): boolean {
  return /^\/(?:account|dashboard|checkout|cart|login|register|forgot-password|verify-email|operations|admin)(?:[/?#]|$)/.test(
    unlocalizedPath(path),
  );
}
