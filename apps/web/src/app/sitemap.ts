import { guides } from '@/lib/guides';
import type { MetadataRoute } from 'next';
import { BUSINESS, LEGAL_EFFECTIVE_DATE } from '@alozuri/shared/legal';
import { POLICIES } from '@alozuri/shared/policies';
import { getPublicCountries, getSitemapPlanIds } from '@/lib/catalogue-server';
import { INDEXABLE } from '@/lib/seo';
import { PUBLISHED_LOCALES, localePath } from '@alozuri/shared/i18n';
export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!INDEXABLE) return [];
  return [
    '',
    '/destinations',
    '/help',
    '/partners',
    '/destinations/europe',
    '/guides',
    ...guides.map((g) => '/guides/' + g.slug),
    ...Object.values(POLICIES).map((p) => p.path),
    ...(await getPublicCountries()).map((c) => '/destinations/' + c.code.toLowerCase()),
    ...(await getSitemapPlanIds()).map((id) => '/plans/' + id),
  ].flatMap((path) =>
    PUBLISHED_LOCALES.map((locale) => ({
      url: BUSINESS.site + (path === '' && locale === 'en' ? '' : localePath(path || '/', locale)),
      alternates: {
        languages: Object.fromEntries([
          ...PUBLISHED_LOCALES.map((language) => [
            language,
            BUSINESS.site + localePath(path || '/', language),
          ]),
          ['x-default', BUSINESS.site + localePath(path || '/', 'en')],
        ]),
      },
      ...(Object.values(POLICIES).some((p) => p.path === path)
        ? { lastModified: LEGAL_EFFECTIVE_DATE }
        : {}),
      changeFrequency: path.startsWith('/destinations/') ? 'daily' : 'monthly',
      priority: path === '' ? 1 : path.startsWith('/destinations') ? 0.8 : 0.5,
    })),
  );
}
