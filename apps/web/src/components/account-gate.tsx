'use client';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useLocalizedRouter as useRouter } from '@/lib/localized-router';
import { useAuth } from './auth-provider';
export function AccountGate({
  children,
  next = '/dashboard',
}: {
  children: React.ReactNode;
  next?: string;
}) {
  const t = useTranslations('authUi');
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
        {t('checkingAccess')}
      </div>
    );
  return children;
}
