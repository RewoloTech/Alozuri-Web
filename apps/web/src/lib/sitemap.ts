import { BUSINESS, LEGAL_EFFECTIVE_DATE } from '@alozuri/shared/legal';
import { POLICIES } from '@alozuri/shared/policies';
import {
  isPublishedLocale,
  localePath,
  PUBLISHED_LOCALES,
  type Locale,
} from '@alozuri/shared/i18n';

// Every hreflang alternative per URL also counts towards the XML byte limit.
export const SITEMAP_PATHS_PER_SHARD = 5000;
type SitemapEntry = {
  url: string;
  alternates: { languages: Record<string, string> };
  lastModified?: string;
  changeFrequency: 'daily' | 'monthly';
  priority: number;
};
export function sitemapIds(pathCount: number): string[] {
  return PUBLISHED_LOCALES.flatMap((locale) =>
    Array.from(
      { length: Math.ceil(pathCount / SITEMAP_PATHS_PER_SHARD) },
      (_, page) => `${locale}-${page}`,
    ),
  );
}
export function parseSitemapId(id: string): { locale: Locale; page: number } | null {
  const match = /^([A-Za-z-]+)-(0|[1-9]\d{0,6})$/.exec(id);
  return match && isPublishedLocale(match[1]) ? { locale: match[1], page: Number(match[2]) } : null;
}
export function sitemapEntries(
  paths: readonly string[],
  locale: Locale,
  page: number,
): SitemapEntry[] {
  return paths
    .slice(page * SITEMAP_PATHS_PER_SHARD, (page + 1) * SITEMAP_PATHS_PER_SHARD)
    .map((path) => ({
      url: BUSINESS.site + (path === '/' && locale === 'en' ? '' : localePath(path, locale)),
      alternates: {
        languages: Object.fromEntries([
          ...PUBLISHED_LOCALES.map((language) => [
            language,
            BUSINESS.site + localePath(path, language),
          ]),
          ['x-default', BUSINESS.site + localePath(path, 'en')],
        ]),
      },
      ...(Object.values(POLICIES).some((policy) => policy.path === path)
        ? { lastModified: LEGAL_EFFECTIVE_DATE }
        : {}),
      changeFrequency: path.startsWith('/destinations/') ? 'daily' : 'monthly',
      priority: path === '/' ? 1 : path.startsWith('/destinations') ? 0.8 : 0.5,
    }));
}
