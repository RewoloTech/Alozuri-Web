import type { MetadataRoute } from 'next';
import { BUSINESS } from '@alozuri/shared/legal';
import { INDEXABLE, PRIVATE_ROUTES } from '@/lib/seo';
export const dynamic = 'force-static';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: INDEXABLE
      ? [
          {
            userAgent: ['*', 'Googlebot', 'Bingbot', 'OAI-SearchBot'],
            allow: '/',
            disallow: [
              ...PRIVATE_ROUTES.map((p) => p + '/'),
              ...PRIVATE_ROUTES,
              '/legal/versions/',
              '/api/',
            ],
          },
          // Preserve the live site's existing training opt-out independently of search access.
          { userAgent: 'GPTBot', disallow: '/' },
        ]
      : { userAgent: '*', disallow: '/' },
    sitemap: BUSINESS.site + '/sitemap.xml',
    host: BUSINESS.site,
  };
}
