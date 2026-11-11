import type { MetadataRoute } from 'next';
import { BUSINESS } from '@voyaspan/shared/legal';
import { INDEXABLE, PRIVATE_ROUTES } from '@/lib/seo';
export const dynamic = 'force-static';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      ...(INDEXABLE
        ? {
            allow: '/',
            disallow: [
              ...PRIVATE_ROUTES.map((p) => p + '/'),
              ...PRIVATE_ROUTES,
              '/legal/versions/',
              '/api/',
            ],
          }
        : { disallow: '/' }),
    },
    sitemap: BUSINESS.site + '/sitemap.xml',
    host: BUSINESS.site,
  };
}
