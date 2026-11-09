import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
export const metadata = { title: 'Log in', robots: { index: false } };
export default function Page() {
  return (
    <Suspense fallback={<div className="loading-page">Getting your journey ready…</div>}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
