'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { authErrorMessage } from '@/lib/auth-errors';
import { firebaseConfigured } from '@/lib/firebase';
import { checkoutAccountActions, type CheckoutAccountActions } from '@/lib/checkout-account';
import { GoogleIcon } from './google-icon';

export function CheckoutAccount({
  email,
  onEmailChange,
  user,
  disabled = false,
  onBusyChange,
  actions = checkoutAccountActions,
  configured = firebaseConfigured,
  returnTo = '/checkout',
}: {
  email: string;
  onEmailChange: (email: string) => void;
  user: { email: string | null; emailVerified: boolean } | null;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
  actions?: CheckoutAccountActions;
  configured?: boolean;
  returnTo?: string;
}) {
  const [mode, setMode] = useState<'register' | 'login' | null>(null);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const emailInput = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const id = useId();
  async function authenticate(method: 'google' | 'email') {
    if (running.current || disabled || !configured) return;
    setError('');
    if (method === 'email') {
      if (!mode) return;
      if (!emailInput.current?.reportValidity()) return;
      if (!password || (mode === 'register' && password.length < 8)) {
        setError(
          mode === 'register'
            ? 'Choose a password of at least 8 characters.'
            : 'Enter your password.',
        );
        return;
      }
    }
    running.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      if (method === 'google') await actions.google();
      else if (mode) await actions.email(mode, email.trim(), password);
      setPassword('');
      setMode(null);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      running.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <div className="checkout-account stack" aria-busy={busy}>
      {!user && (
        <>
          <button
            type="button"
            className="button google-button"
            disabled={disabled || busy || !configured}
            onClick={() => void authenticate('google')}
          >
            <GoogleIcon />
            {busy ? 'Please wait…' : 'Continue with Google'}
          </button>
          <p className="checkout-guest-intro">
            <strong>Or check out as a guest</strong>
            <span>No account needed.</span>
          </p>
        </>
      )}
      <label htmlFor={id + '-email'}>
        Email address
        <input
          id={id + '-email'}
          ref={emailInput}
          className="commerce-input"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          value={email}
          disabled={disabled || busy}
          onChange={(event) => onEmailChange(event.target.value)}
        />
      </label>
      {user ? (
        !user.emailVerified && (
          <p className="fine-print" role="status">
            You can pay now.{' '}
            <Link href={'/verify-email?next=' + encodeURIComponent(returnTo)}>
              Verify your email
            </Link>{' '}
            to access your orders in My eSIMs.
          </p>
        )
      ) : (
        <>
          {!configured && (
            <p className="fine-print">
              Account sign-in is unavailable here. You can continue as a guest.
            </p>
          )}
          <div className="checkout-account-options">
            <button
              type="button"
              className="text-link"
              aria-expanded={mode === 'register'}
              aria-controls={id + '-password'}
              disabled={disabled || busy || !configured}
              onClick={() => {
                setMode(mode === 'register' ? null : 'register');
                setPassword('');
                setError('');
              }}
            >
              Create an account
            </button>
            <button
              type="button"
              className="text-link"
              aria-expanded={mode === 'login'}
              aria-controls={id + '-password'}
              disabled={disabled || busy || !configured}
              onClick={() => {
                setMode(mode === 'login' ? null : 'login');
                setPassword('');
                setError('');
              }}
            >
              Log in
            </button>
          </div>
          <div id={id + '-password'} hidden={!mode} className="stack">
            {mode && (
              <>
                <label>
                  Password
                  <div className="password-field">
                    <input
                      className="commerce-input"
                      type={visible ? 'text' : 'password'}
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      maxLength={128}
                      value={password}
                      disabled={disabled || busy}
                      onChange={(event) => setPassword(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void authenticate('email');
                        }
                      }}
                    />
                    <button
                      type="button"
                      aria-label={visible ? 'Hide password' : 'Show password'}
                      onClick={() => setVisible(!visible)}
                    >
                      <span>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</span>
                    </button>
                  </div>
                </label>
                {mode === 'register' ? (
                  <p className="fine-print">
                    By creating an account, you agree to our <Link href="/terms">Terms</Link> and{' '}
                    <Link href="/privacy">Privacy Policy</Link>. Accounts are for adults aged 18 and
                    over.
                  </p>
                ) : (
                  <Link className="text-link" href="/forgot-password">
                    Forgot password?
                  </Link>
                )}
                <button
                  type="button"
                  className="button"
                  disabled={disabled || busy}
                  onClick={() => void authenticate('email')}
                >
                  {busy
                    ? 'Please wait…'
                    : mode === 'register'
                      ? 'Create account and stay at checkout'
                      : 'Log in and stay at checkout'}
                </button>
              </>
            )}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error} You can also continue as a guest.
        </p>
      )}
    </div>
  );
}
