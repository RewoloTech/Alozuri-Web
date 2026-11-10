import { Suspense } from 'react';
import { Checkout } from '@/components/checkout';
export const metadata = { title: 'Checkout', robots: { index: false } };
export default function Page() {
  return (
    <Suspense fallback={<div className="loading-page">Opening checkout…</div>}>
      <Checkout />
    </Suspense>
  );
}
