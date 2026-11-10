import { Suspense } from 'react';
import { PurchaseStatus } from '@/components/purchase-status';
export const metadata = { title: 'Your order', robots: { index: false } };
export default function Page() {
  return (
    <Suspense fallback={<div className="loading-page">Opening your order…</div>}>
      <PurchaseStatus />
    </Suspense>
  );
}
