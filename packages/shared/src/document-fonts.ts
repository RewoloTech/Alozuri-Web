import type { Locale } from './i18n/locales.ts';
/** Complete regional fonts load only for an authorised PDF request, never normal page loads. */
export function documentFontFiles(locale: Locale): Record<string, string> {
  const family =
    locale === 'ja'
      ? 'NotoSansJP'
      : locale === 'ko'
        ? 'NotoSansKR'
        : locale === 'zh-Hans'
          ? 'NotoSansSC'
          : undefined;
  return {
    Latin: 'Inter-400.ttf',
    LatinBold: 'Inter-700.ttf',
    Inter: family ? `${family}-Regular.woff2` : 'Inter-400.ttf',
    InterBold: family ? `${family}-Bold.woff2` : 'Inter-700.ttf',
    ...(locale === 'ar'
      ? { Arabic: 'NotoSansArabic-Regular.ttf', ArabicBold: 'NotoSansArabic-Bold.ttf' }
      : {}),
  };
}
