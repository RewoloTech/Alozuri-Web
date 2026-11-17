import type { MetadataRoute } from 'next';
import { notFound } from 'next/navigation';
import { INDEXABLE } from '@/lib/seo';
import { parseSitemapId, sitemapEntries, sitemapIds } from '@/lib/sitemap';
import { sitemapPaths } from '@/lib/sitemap-source';
export const revalidate = 3600;
export async function generateSitemaps() {
  return INDEXABLE ? sitemapIds((await sitemapPaths()).length).map((id) => ({ id })) : [];
}
export default async function sitemap({
  id,
}: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const parsed = parseSitemapId(await id);
  if (!INDEXABLE || !parsed) notFound();
  const entries = sitemapEntries(await sitemapPaths(), parsed.locale, parsed.page);
  if (!entries.length) notFound();
  return entries;
}
