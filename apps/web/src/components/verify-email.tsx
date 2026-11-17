'use client';
import { useLocale, useTranslations } from 'next-intl';
import { localePath } from '@alozuri/shared/i18n';
import type { Messages } from '@alozuri/shared/i18n/messages';
import { authClient } from '@/lib/firebase';
import { safeAccountDestination } from '@alozuri/shared';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocalizedRouter as useRouter } from '@/lib/localized-router';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from './auth-provider';
export function VerifyEmail() {
  const t = useTranslations('authUi');
  const locale = useLocale();
  const { user, loading, logout } = useAuth(),
    router = useRouter(),
    search = useSearchParams();
  const destination = safeAccountDestination(search.get('next'));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<keyof Messages['authUi'] | ''>(''),
    [notice, setNotice] = useState<keyof Messages['authUi'] | ''>('');
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login?next=' + encodeURIComponent(destination));
    else if (user.emailVerified) router.replace(destination);
  }, [user, loading, router, destination]);
  useEffect(() => {
    if (!user || user.emailVerified) return;
    const check = () => {
      void user
        .reload()
        .then(() => user.getIdToken(true))
        .then(() => {
          if (user.emailVerified) router.replace(destination);
        })
        .catch(() => {});
    };
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [user, router, destination]);
  async function check() {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      await user.reload();
      await user.getIdToken(true);
      if (user.emailVerified) router.replace(destination);
      else setNotice('verifyNotYet');
    } catch {
      setError('verifyCheckError');
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      authClient().languageCode = locale === 'zh-Hans' ? 'zh-CN' : locale;
      await sendEmailVerification(user, {
        url:
          window.location.origin +
          localePath('/verify-email?next=' + encodeURIComponent(destination), locale),
      });
      setNotice('verifySent');
    } catch {
      setError('verifySendError');
    } finally {
      setBusy(false);
    }
  }
  if (loading || !user) return <div className="loading-page">{t('checkingAccess')}</div>;
  return (
    <section className="container section">
      <div className="surface" style={{ maxWidth: 600, margin: '0 auto' }}>
        <span className="eyebrow">{t('verifyEyebrow')}</span>
        <h1 className="compact-title">{t('verifyTitle')}</h1>
        <p>
          {t('verifyIntro', {
            email: locale === 'ar' ? '\u2066' + user.email + '\u2069' : (user.email ?? ''),
          })}
        </p>
        <p>{t('verifyDelay')}</p>
        <div className="inline-actions" dir="ltr">
          <button className="button primary" disabled={busy} onClick={check}>
            {t('verifiedButton')}
          </button>
          <button className="button" disabled={busy} onClick={resend}>
            {t('resend')}
          </button>
          <button
            className="text-link"
            disabled={busy}
            onClick={() => void logout().then(() => router.replace('/login'))}
          >
            {t('another')}
          </button>
        </div>
        {notice && (
          <p className="success-message" role="status">
            {t(notice)}
          </p>
        )}
        {error && (
          <p className="error-message" role="alert">
            {t(error)}
          </p>
        )}
      </div>
    </section>
  );
}
