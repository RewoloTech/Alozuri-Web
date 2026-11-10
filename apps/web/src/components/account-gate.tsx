'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
export function AccountGate({
  children,
  next = '/dashboard',
}: {
  children: React.ReactNode;
  next?: string;
}) {
  const { user, loading } = useAuth(),
    router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login?next=' + encodeURIComponent(next));
    else if (!user.emailVerified) router.replace('/verify-email?next=' + encodeURIComponent(next));
  }, [user, loading, next, router]);
  if (loading || !user?.emailVerified)
    return (
      <div className="loading-page" role="status">
        Checking account access…
      </div>
    );
  return children;
}
