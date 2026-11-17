import { LocalizedLoading } from '@/components/localized-loading';
import { privateMetadata } from '@/lib/server-translations';
import { Suspense } from 'react';
import { Checkout } from '@/components/checkout';
export async function generateMetadata() {
  return privateMetadata('checkout.title');
}
export default function Page() {
  return (
    <Suspense fallback={<LocalizedLoading message="paymentUi.loadingCheckout" />}>
      <Checkout />
    </Suspense>
  );
}
