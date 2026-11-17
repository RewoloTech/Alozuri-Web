import { LocalizedLoading } from '@/components/localized-loading';
import { privateMetadata } from '@/lib/server-translations';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
export async function generateMetadata() {
  return privateMetadata('navigation.login');
}
export default function Page() {
  return (
    <Suspense fallback={<LocalizedLoading message="authUi.wait" />}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
