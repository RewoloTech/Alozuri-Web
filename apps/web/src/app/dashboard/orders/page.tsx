import { LocalizedLoading } from '@/components/localized-loading';
import { privateMetadata } from '@/lib/server-translations';
import { Suspense } from 'react';
import { OrderLookup } from '@/components/order-lookup';
export async function generateMetadata() {
  return privateMetadata('orderUi.title');
}
export default function Page() {
  return (
    <Suspense fallback={<LocalizedLoading message="orderUi.confirming" />}>
      <OrderLookup />
    </Suspense>
  );
}
