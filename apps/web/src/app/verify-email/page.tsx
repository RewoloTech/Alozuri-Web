import { Suspense } from 'react';
import { VerifyEmail } from '@/components/verify-email';
export const metadata = { title: 'Verify your email', robots: { index: false } };
export default function Page() {
  return (
    <Suspense fallback={<div className="loading-page">Opening verification…</div>}>
      <VerifyEmail />
    </Suspense>
  );
}
