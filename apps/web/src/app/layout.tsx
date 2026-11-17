import { LanguageProvider } from '@/components/language-provider';
import { Suspense } from 'react';
import { MetaTracking } from '@/components/meta-tracking';
import type { Metadata } from 'next';
import { PrivacyProvider } from '@/components/privacy-provider';
import { BUSINESS } from '@alozuri/shared/legal';
import { INDEXABLE, jsonLd } from '@/lib/seo';
import { AuthProvider } from '@/components/auth-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { CartSync } from '@/components/cart-sync';
import { StoreProvider } from '@/components/store-provider';
import './globals.css';
import { headers } from 'next/headers';
import { isLocale, localeDirection } from '@alozuri/shared/i18n';
import { loadMessages } from '@alozuri/shared/i18n/catalogs';
import { createTranslator } from 'use-intl/core';
import { serverTranslations } from '@/lib/server-translations';
const baseMetadata: Metadata = {
  metadataBase: new URL(BUSINESS.site),
  title: { default: 'Alozuri — One eSIM. Every stop.', template: '%s | Alozuri' },
  description:
    'Find a travel eSIM for your whole itinerary. Choose your countries, compare coverage and stay connected along the way.',
  robots: { index: INDEXABLE, follow: true },
  openGraph: {
    type: 'website',
    siteName: BUSINESS.brand,
    locale: 'en_GB',
    images: [{ url: '/og-alozuri.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: ['/og-alozuri.png'] },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION
      ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION }
      : {},
  },
};
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverTranslations();
  return {
    ...baseMetadata,
    title: { default: t('seoUi.tagline'), template: '%s | Alozuri' },
    description: t('seoUi.homeDescription'),
  };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestLocale = (await headers()).get('x-alozuri-locale');
  const locale = isLocale(requestLocale) ? requestLocale : 'en';
  const messages = await loadMessages(locale);
  const t = createTranslator({ locale, messages });
  // Extensions such as ColorZilla can add body attributes before React hydrates.
  // Suppression is limited to this element; descendant checks stay enabled.
  return (
    <html
      lang={locale === 'en' ? 'en-GB' : locale}
      dir={localeDirection(locale)}
      data-scroll-behavior="smooth"
    >
      <head>
        <script
          async
          src="https://assets.endorsely.com/endorsely.js"
          data-endorsely="fee2398b-3a49-474c-b549-4e770fc0b679"
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <LanguageProvider initialLocale={locale} initialMessages={messages}>
            <PrivacyProvider>
              <Suspense fallback={null}>
                <MetaTracking />
              </Suspense>
              <StoreProvider>
                <CartSync />
                <a className="skip-link" href="#main">
                  {t('site.skip')}
                </a>
                <Header />
                <main id="main">{children}</main>
                <Footer />
              </StoreProvider>
            </PrivacyProvider>
          </LanguageProvider>
        </AuthProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': BUSINESS.site + '/#organization',
                  name: BUSINESS.brand,
                  legalName: BUSINESS.company,
                  url: BUSINESS.site,
                  logo: BUSINESS.site + '/images/alozuri-email-logo.png',
                  email: BUSINESS.email,
                  identifier: {
                    '@type': 'PropertyValue',
                    propertyID: 'Companies House',
                    value: BUSINESS.number,
                  },
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: '124–128 City Road',
                    addressLocality: 'London',
                    postalCode: 'EC1V 2NX',
                    addressCountry: 'GB',
                  },
                },
                {
                  '@type': 'WebSite',
                  url: BUSINESS.site,
                  name: BUSINESS.brand,
                  publisher: { '@id': BUSINESS.site + '/#organization' },
                },
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}
