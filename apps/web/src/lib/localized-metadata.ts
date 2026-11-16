import { headers } from 'next/headers';
import { isLocale, isPublishedLocale, localePath, PUBLISHED_LOCALES } from '@alozuri/shared/i18n';
import { publicMetadata } from './seo';

export async function requestLocale() {
  const value = (await headers()).get('x-alozuri-locale');
  return isLocale(value) ? value : 'en';
}
export async function localizedMetadata(title: string, description: string, path: string) {
  const locale = await requestLocale();
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
      locale: locale === 'en' ? 'en_GB' : locale.replace('-', '_'),
    },
    robots: { ...metadata.robots, index: metadata.robots.index && isPublishedLocale(locale) },
  };
}
