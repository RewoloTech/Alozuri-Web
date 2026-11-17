import { LocalizedLoading } from '@/components/localized-loading';
import { privateMetadata } from '@/lib/server-translations';
import { Suspense } from 'react';
import { VerifyEmail } from '@/components/verify-email';
export async function generateMetadata() {
  return privateMetadata('site.verifyEmail');
}
export default function Page() {
  return (
    <Suspense fallback={<LocalizedLoading message="authUi.openingVerification" />}>
      <VerifyEmail />
    </Suspense>
  );
}
