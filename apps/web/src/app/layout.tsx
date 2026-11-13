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
export const metadata: Metadata = {
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
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Extensions such as ColorZilla can add body attributes before React hydrates.
  // Suppression is limited to this element; descendant checks stay enabled.
  return (
    <html lang="en-GB" data-scroll-behavior="smooth">
      <body suppressHydrationWarning>
        <PrivacyProvider>
          <StoreProvider>
            <AuthProvider>
              <CartSync />
              <a className="skip-link" href="#main">
                Skip to content
              </a>
              <Header />
              <main id="main">{children}</main>
              <Footer />
            </AuthProvider>
          </StoreProvider>
        </PrivacyProvider>
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
