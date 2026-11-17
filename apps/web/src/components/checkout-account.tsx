'use client';

import { useLocale, useTranslations } from 'next-intl';
import { firebaseAuthLocale } from '@alozuri/shared/i18n';
import type { Messages } from '@alozuri/shared/i18n/messages';
import { LinkedMessage, MESSAGE_LINKS } from './linked-message';
import { useId, useRef, useState } from 'react';
import Link from '@/components/localized-link';
import { Eye, EyeOff } from 'lucide-react';
import { authErrorKey } from '@/lib/auth-errors';
import { firebaseConfigured, authClient } from '@/lib/firebase';
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
  const t = useTranslations('authUi');
  const locale = useLocale();
  const navigation = useTranslations('navigation');
  const site = useTranslations('site');
  const legal = useTranslations('legal');
  const [mode, setMode] = useState<'register' | 'login' | null>(null);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<keyof Messages['authUi'] | ''>('');
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
        setError(mode === 'register' ? 'passwordLength' : 'passwordRequired');
        return;
      }
    }
    running.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      if (actions === checkoutAccountActions)
        authClient().languageCode = firebaseAuthLocale(locale);
      if (method === 'google') await actions.google();
      else if (mode) await actions.email(mode, email.trim(), password);
      setPassword('');
      setMode(null);
    } catch (e) {
      setError(authErrorKey(e));
    } finally {
      running.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <div className="checkout-account stack" aria-busy={busy} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {!user && (
        <>
          <button
            type="button"
            className="button google-button"
            disabled={disabled || busy || !configured}
            onClick={() => void authenticate('google')}
          >
            <GoogleIcon />
            {busy ? t('wait') : t('google')}
          </button>
          <p className="checkout-guest-intro">
            <strong>{t('guestTitle')}</strong>
            <span>{t('guestHint')}</span>
          </p>
        </>
      )}
      <label htmlFor={id + '-email'}>
        {t('email')}
        <input
          id={id + '-email'}
          ref={emailInput}
          className="commerce-input"
          type="email"
          dir="ltr"
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
            <LinkedMessage
              message={t('verifyNotice', { verify: MESSAGE_LINKS.verify })}
              links={{
                verify: {
                  href: '/verify-email?next=' + encodeURIComponent(returnTo),
                  label: site('verifyEmail'),
                },
              }}
            />
          </p>
        )
      ) : (
        <>
          {!configured && <p className="fine-print">{t('guestUnconfigured')}</p>}
          <div className="checkout-account-options" dir="ltr">
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
              {site('createAccount')}
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
              {navigation('login')}
            </button>
          </div>
          <div id={id + '-password'} hidden={!mode} className="stack">
            {mode && (
              <>
                <label>
                  {t('password')}
                  <div className="password-field" dir="ltr">
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
                      aria-label={visible ? t('hide') : t('show')}
                      onClick={() => setVisible(!visible)}
                    >
                      <span>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</span>
                    </button>
                  </div>
                </label>
                {mode === 'register' ? (
                  <p className="fine-print">
                    <LinkedMessage
                      message={t('checkoutRegisterAgreement', {
                        terms: MESSAGE_LINKS.terms,
                        privacy: MESSAGE_LINKS.privacy,
                      })}
                      links={{
                        terms: { href: '/terms', label: legal('terms') },
                        privacy: { href: '/privacy', label: legal('privacy') },
                      }}
                    />
                  </p>
                ) : (
                  <Link className="text-link" href="/forgot-password">
                    {t('forgot')}
                  </Link>
                )}
                <button
                  type="button"
                  className="button"
                  disabled={disabled || busy}
                  onClick={() => void authenticate('email')}
                >
                  {busy
                    ? t('wait')
                    : mode === 'register'
                      ? t('createCheckout')
                      : t('loginCheckout')}
                </button>
              </>
            )}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="error-message">
          {t(error)} {t('guestAlternative')}
        </p>
      )}
    </div>
  );
}
