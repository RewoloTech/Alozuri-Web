import { guides } from '@/lib/guides';
import type { MetadataRoute } from 'next';
import { BUSINESS, LEGAL_EFFECTIVE_DATE } from '@alozuri/shared/legal';
import { POLICIES } from '@alozuri/shared/policies';
import { getPublicCountries, getSitemapPlanIds } from '@/lib/catalogue-server';
import { INDEXABLE } from '@/lib/seo';
export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!INDEXABLE) return [];
  return [
    '',
    '/destinations',
    '/help',
    '/destinations/europe',
    '/guides',
    ...guides.map((g) => '/guides/' + g.slug),
    ...Object.values(POLICIES).map((p) => p.path),
    ...(await getPublicCountries()).map((c) => '/destinations/' + c.code.toLowerCase()),
    ...(await getSitemapPlanIds()).map((id) => '/plans/' + id),
  ].map((path) => ({
    url: BUSINESS.site + path,
    ...(Object.values(POLICIES).some((p) => p.path === path)
      ? { lastModified: LEGAL_EFFECTIVE_DATE }
      : {}),
    changeFrequency: path.startsWith('/destinations/') ? 'daily' : 'monthly',
    priority: path === '' ? 1 : path.startsWith('/destinations') ? 0.8 : 0.5,
  }));
}
