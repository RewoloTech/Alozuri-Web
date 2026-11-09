import { Suspense } from 'react';
import { OrderLookup } from '@/components/order-lookup';
export const metadata = { title: 'Your eSIM', robots: { index: false } };
export default function Page() {
  return (
    <Suspense fallback={<div className="loading-page">Opening your order…</div>}>
      <OrderLookup />
    </Suspense>
  );
}
