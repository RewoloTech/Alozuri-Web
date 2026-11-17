'use client';
import Link from '@/components/localized-link';
import { useLocalizedRouter } from '@/lib/localized-router';
export default function LanguageNavigationFixture() {
  const router = useLocalizedRouter();
  return (
    <div>
      <Link href="/fr/e2e-fixtures/language-navigation?currency=EUR#links">French URL</Link>
      <Link href="/en/e2e-fixtures/language-navigation?currency=EUR">English URL</Link>
      <button
        onClick={() => router.push('/ja/e2e-fixtures/language-navigation?currency=EUR#links')}
      >
        Japanese URL
      </button>
      <Link href="/checkout">Checkout</Link>
    </div>
  );
}
