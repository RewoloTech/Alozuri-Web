'use client';
import { safeAccountDestination } from '@voyaspan/shared';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from './auth-provider';
export function VerifyEmail() {
  const { user, loading, logout } = useAuth(),
    router = useRouter(),
    search = useSearchParams();
  const destination = safeAccountDestination(search.get('next'));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
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
      else
        setNotice('Your email is not verified yet. Open the verification link, then check again.');
    } catch {
      setError('Could not check verification. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      await sendEmailVerification(user, {
        url: window.location.origin + '/verify-email?next=' + encodeURIComponent(destination),
      });
      setNotice('Verification email sent. Check your inbox and spam folder.');
    } catch {
      setError('Could not send the email. Please wait a moment and try again.');
    } finally {
      setBusy(false);
    }
  }
  if (loading || !user) return <div className="loading-page">Checking your account…</div>;
  return (
    <section className="container section">
      <div className="surface" style={{ maxWidth: 600, margin: '0 auto' }}>
        <span className="eyebrow">VERIFY YOUR EMAIL</span>
        <h1 className="compact-title">Check your inbox</h1>
        <p>
          Open the Firebase verification email sent to <strong>{user.email}</strong>. Verify your
          email before accessing your account or checking out.
        </p>
        <p>If you have just signed up, your email may take a moment to arrive. Check spam too.</p>
        <div className="inline-actions">
          <button className="button primary" disabled={busy} onClick={check}>
            I’ve verified my email
          </button>
          <button className="button" disabled={busy} onClick={resend}>
            Resend email
          </button>
          <button
            className="text-link"
            disabled={busy}
            onClick={() => void logout().then(() => router.replace('/login'))}
          >
            Use another account
          </button>
        </div>
        {notice && (
          <p className="success-message" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
