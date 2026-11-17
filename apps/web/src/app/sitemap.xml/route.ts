import { BUSINESS } from '@alozuri/shared/legal';
import { INDEXABLE } from '@/lib/seo';
import { sitemapIds } from '@/lib/sitemap';
import { sitemapPaths } from '@/lib/sitemap-source';
export const revalidate = 3600;
export async function GET() {
  const ids = INDEXABLE ? sitemapIds((await sitemapPaths()).length) : [];
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      ids
        .map((id) => `<sitemap><loc>${BUSINESS.site}/sitemaps/sitemap/${id}.xml</loc></sitemap>`)
        .join('') +
      '</sitemapindex>',
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
