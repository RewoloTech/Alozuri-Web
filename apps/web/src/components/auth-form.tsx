'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Globe2, ShieldCheck } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { accountName } from '@voyaspan/shared';
import { authClient, firebaseConfigured } from '@/lib/firebase';
const errors: Record<string, string> = {
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/email-already-in-use': 'This email already has an account. Log in or reset your password.',
  'auth/weak-password': 'Please choose a password of at least 8 characters.',
  'auth/popup-blocked': 'Your browser blocked Google sign-in. Allow popups and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was closed. Try again when you’re ready.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/unauthorized-domain': 'Sign-in is not available on this domain yet.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled yet.',
};
function message(error: unknown) {
  const e = error as { code?: string; message?: string };
  return errors[e.code || ''] || e.message || 'Unable to sign in. Please try again.';
}
export function AuthForm({ mode }: { mode: 'login' | 'register' | 'reset' }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next');
  const destination =
    next?.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/dashboard';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [visible, setVisible] = useState(false);
  async function google() {
    setBusy(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(authClient(), provider);
      router.push(destination);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email')).trim();
    const password = String(data.get('password') || '');
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(authClient(), email, {
          url: window.location.origin + '/login',
        });
        setSuccess('If an account exists for that email, you’ll receive a password reset link.');
      } else if (mode === 'register') {
        const displayName = accountName(data.get('firstName'), data.get('lastName'));
        const credential = await createUserWithEmailAndPassword(authClient(), email, password);

        try {
          await updateProfile(credential.user, { displayName });
        } catch {
          /* Account details can be completed after verification. */
        }
        try {
          await sendEmailVerification(credential.user, {
            url: window.location.origin + '/verify-email?next=' + encodeURIComponent(destination),
          });
        } catch {
          /* Dashboard offers resend if delivery fails. */
        }
        router.push('/verify-email?next=' + encodeURIComponent(destination));
      } else {
        const credential = await signInWithEmailAndPassword(authClient(), email, password);
        router.push(
          credential.user.emailVerified
            ? destination
            : '/verify-email?next=' + encodeURIComponent(destination),
        );
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === 'register'
      ? 'Your next adventure starts here.'
      : mode === 'reset'
        ? 'A fresh start.'
        : 'Welcome back, wanderer.';
  return (
    <div className="auth-page container">
      <aside className="auth-art">
        <span className="eyebrow">YOUR WORLD. CONNECTED.</span>
        <h2>
          Less searching
          <br />
          for Wi-Fi.
          <br />
          <em>More being there.</em>
        </h2>
        <div className="auth-art-bottom">
          <Globe2 size={38} />
          <span>
            One account.
            <br />
            Every adventure.
          </span>
        </div>
      </aside>
      <section className="auth-panel">
        <span className="eyebrow">
          {mode === 'register'
            ? 'JOIN THE JOURNEY'
            : mode === 'reset'
              ? 'RESET YOUR PASSWORD'
              : 'GOOD TO SEE YOU'}
        </span>
        <h1>{title}</h1>
        <p>
          {mode === 'register'
            ? 'Keep all your eSIMs, plans and adventures in one place.'
            : mode === 'reset'
              ? 'Enter your email and we’ll send you a reset link.'
              : 'Log in to find your eSIMs and pick up where you left off.'}
        </p>
        {!firebaseConfigured && (
          <div className="notice">
            Account access will be available when Firebase Authentication is connected. You can
            explore the storefront in the meantime.
          </div>
        )}
        {mode !== 'reset' && (
          <>
            <button
              className="button google-button"
              onClick={google}
              disabled={busy || !firebaseConfigured}
            >
              <GoogleIcon />
              {busy ? 'Please wait…' : 'Continue with Google'}
            </button>
            <div className="divider">
              <span>or continue with email</span>
            </div>
          </>
        )}
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="name-fields">
              <label>
                First name
                <input
                  name="firstName"
                  autoComplete="given-name"
                  required
                  maxLength={50}
                  placeholder="First name"
                />
              </label>
              <label>
                Last name
                <input
                  name="lastName"
                  autoComplete="family-name"
                  required
                  maxLength={50}
                  placeholder="Last name"
                />
              </label>
            </div>
          )}
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </label>
          {mode !== 'reset' && (
            <label>
              Password
              <div className="password-field">
                <input
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  maxLength={128}
                  placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
                />
                <button
                  type="button"
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}
          {mode === 'login' && (
            <Link className="forgot-link" href="/forgot-password">
              Forgot password?
            </Link>
          )}
          {mode === 'register' && (
            <label className="checkbox-label">
              <input type="checkbox" required />{' '}
              <span>
                I agree to the <Link href="/legal/terms">Terms</Link> and{' '}
                <Link href="/legal/privacy">Privacy Policy</Link>.
              </span>
            </label>
          )}
          <button className="button primary full-width" disabled={busy || !firebaseConfigured}>
            {busy
              ? 'Please wait…'
              : mode === 'register'
                ? 'Create my account'
                : mode === 'reset'
                  ? 'Send reset link'
                  : 'Log in'}
            <ArrowRight size={17} />
          </button>
        </form>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="success-message">
            {success}
            {mode === 'register' && <Link href={destination}> Continue to your account →</Link>}
          </p>
        )}
        <p className="auth-switch">
          {mode === 'login' ? (
            <>
              New around here?{' '}
              <Link href={`/register${next ? `?next=${encodeURIComponent(destination)}` : ''}`}>
                Create an account
              </Link>
            </>
          ) : mode === 'register' ? (
            <>
              Already part of the journey?{' '}
              <Link href={`/login${next ? `?next=${encodeURIComponent(destination)}` : ''}`}>
                Log in
              </Link>
            </>
          ) : (
            <Link href="/login">Back to log in</Link>
          )}
        </p>
        <div className="auth-secure">
          <ShieldCheck size={15} />
          Your next adventure, securely connected.
        </div>
      </section>
    </div>
  );
}
function GoogleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.06 46.98 31.92 46.98 24.55z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.41 14.41 0 010-9.18l-7.98-6.19a23.9 23.9 0 000 21.56l7.98-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
