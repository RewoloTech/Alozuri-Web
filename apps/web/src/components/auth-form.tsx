'use client';
import { useState } from 'react';
import { authErrorMessage } from '@/lib/auth-errors';
import { GoogleIcon } from './google-icon';
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
import { accountName, safeAccountDestination } from '@voyaspan/shared';
import { authClient, firebaseConfigured } from '@/lib/firebase';
import { api } from '@/lib/api';
export function AuthForm({ mode }: { mode: 'login' | 'register' | 'reset' }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next');
  const destination = safeAccountDestination(next);
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
      setError(authErrorMessage(e));
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
          await api(
            '/v2/profile',
            {
              method: 'PATCH',
              body: JSON.stringify({
                firstName: String(data.get('firstName') ?? ''),
                lastName: String(data.get('lastName') ?? ''),
              }),
            },
            credential.user.uid,
          );
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
      setError(authErrorMessage(e));
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
        <p className="fine-print">
          Accounts and purchases are intended for adults aged 18 and over. Read our{' '}
          <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>. Signing
          in does not opt you into marketing or optional support tracking.
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
              <input type="checkbox" required />
              <span>
                I agree to the <Link href="/terms">Terms</Link> and{' '}
                <Link href="/privacy">Privacy Policy</Link>.
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
