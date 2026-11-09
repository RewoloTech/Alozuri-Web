import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { StoreProvider } from '@/components/store-provider';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://voyaspan.com'),
  title: { default: 'VoyaSpan — One eSIM. Every stop.', template: '%s | VoyaSpan' },
  description:
    'Find a travel eSIM for your whole itinerary. Choose your countries, compare coverage and stay connected along the way.',
  robots: { index: process.env.VOYASPAN_STATIC_EXPORT !== 'true', follow: true },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <StoreProvider>
          <AuthProvider>
            <a className="skip-link" href="#main">
              Skip to content
            </a>
            <Header />
            <main id="main">{children}</main>
            <Footer />
          </AuthProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
