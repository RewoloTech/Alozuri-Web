import { BUSINESS } from '@voyaspan/shared/legal';
export const INDEXABLE =
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_DEMO_MODE === 'false' &&
  process.env.NEXT_PUBLIC_PAYMENT_MODE === 'live' &&
  (process.env.NEXT_PUBLIC_SITE_URL || BUSINESS.site) === BUSINESS.site;
export function publicMetadata(title: string, description: string, path: string) {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: INDEXABLE, follow: true },
    openGraph: {
      title,
      description,
      url: path,
      type: 'website' as const,
      siteName: BUSINESS.brand,
      locale: 'en_GB',
      images: [
        {
          url: '/og-alozuri.png',
          width: 1200,
          height: 630,
          alt: 'Alozuri — One eSIM. Every stop.',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: ['/og-alozuri.png'],
    },
  };
}
export const PRIVATE_ROUTES = [
  '/account',
  '/dashboard',
  '/admin',
  '/checkout',
  '/cart',
  '/login',
  '/register',
  '/forgot-password',
  '/verify-email',
];
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
export function breadcrumbs(name: string, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Alozuri', item: BUSINESS.site },
      { '@type': 'ListItem', position: 2, name, item: BUSINESS.site + path },
    ],
  };
}
