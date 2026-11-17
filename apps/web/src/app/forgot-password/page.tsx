import { privateMetadata } from '@/lib/server-translations';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
export async function generateMetadata() {
  return privateMetadata('authUi.resetEyebrow');
}
export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="reset" />
    </Suspense>
  );
}
