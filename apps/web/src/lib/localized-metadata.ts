import { requestLocale } from './request-locale';
export { requestLocale } from './request-locale';
import { serverTranslations } from './server-translations';
import type { Locale } from '@alozuri/shared/i18n';
const openGraphLocale: Record<Locale, string> = {
  en: 'en_GB',
  es: 'es_ES',
  de: 'de_DE',
  fr: 'fr_FR',
  it: 'it_IT',
  'pt-BR': 'pt_BR',
  ro: 'ro_RO',
  ja: 'ja_JP',
  ko: 'ko_KR',
  'zh-Hans': 'zh_CN',
  'zh-Hant': 'zh_TW',
  ar: 'ar_AR',
  nl: 'nl_NL',
  pl: 'pl_PL',
  tr: 'tr_TR',
  ru: 'ru_RU',
  vi: 'vi_VN',
  id: 'id_ID',
  hi: 'hi_IN',
  th: 'th_TH',
  uk: 'uk_UA',
};
import { isPublishedLocale, localePath, PUBLISHED_LOCALES } from '@alozuri/shared/i18n';
import { publicMetadata } from './seo';

export async function localizedMetadata(title: string, description: string, path: string) {
  const locale = await requestLocale();
  const { t } = await serverTranslations();
  const metadata = publicMetadata(title, description, path);
  const canonical = localePath(path, locale);
  return {
    ...metadata,
    alternates: {
      canonical,
      languages: Object.fromEntries([
        ...PUBLISHED_LOCALES.map((language) => [language, localePath(path, language)]),
        ['x-default', localePath(path, 'en')],
      ]),
    },
    openGraph: {
      ...metadata.openGraph,
      url: canonical,
      locale: openGraphLocale[locale],
      alternateLocale: PUBLISHED_LOCALES.filter((candidate) => candidate !== locale).map(
        (candidate) => openGraphLocale[candidate],
      ),
      images: metadata.openGraph.images.map((image) => ({ ...image, alt: t('seoUi.tagline') })),
    },
    robots: { ...metadata.robots, index: metadata.robots.index && isPublishedLocale(locale) },
  };
}
