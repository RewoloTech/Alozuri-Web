'use client';
import { useLocale, useTranslations } from 'next-intl';
import { localeDirection, localePath } from '@alozuri/shared/i18n';
import type { Messages } from '@alozuri/shared/i18n/messages';
import { LinkedMessage, MESSAGE_LINKS } from './linked-message';
import { useState } from 'react';
import { authErrorKey } from '@/lib/auth-errors';
import { GoogleIcon } from './google-icon';
import Link from '@/components/localized-link';
import { useSearchParams } from 'next/navigation';
import { useLocalizedRouter as useRouter } from '@/lib/localized-router';
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
import { accountName, safeAccountDestination } from '@alozuri/shared';
import { authClient, firebaseConfigured } from '@/lib/firebase';
import { api } from '@/lib/api';
export function AuthForm({ mode }: { mode: 'login' | 'register' | 'reset' }) {
  const t = useTranslations('authUi');
  const navigation = useTranslations('navigation');
  const site = useTranslations('site');
  const legal = useTranslations('legal');
  const locale = useLocale();
  const dir = localeDirection(locale);
  const agreementLinks = {
    terms: { href: '/terms', label: legal('terms') },
    privacy: { href: '/privacy', label: legal('privacy') },
  };
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next');
  const destination = safeAccountDestination(next);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<keyof Messages['authUi'] | ''>('');
  const [success, setSuccess] = useState(false);
  const [visible, setVisible] = useState(false);
  async function google() {
    setBusy(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      authClient().languageCode = locale === 'zh-Hans' ? 'zh-CN' : locale;
      await signInWithPopup(authClient(), provider);
      router.push(destination);
    } catch (e) {
      setError(authErrorKey(e));
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
      authClient().languageCode = locale === 'zh-Hans' ? 'zh-CN' : locale;
      if (mode === 'reset') {
        await sendPasswordResetEmail(authClient(), email, {
          url: window.location.origin + localePath('/login', locale),
        });
        setSuccess(true);
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
            url:
              window.location.origin +
              localePath('/verify-email?next=' + encodeURIComponent(destination), locale),
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
      setError(authErrorKey(e));
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === 'register' ? t('registerTitle') : mode === 'reset' ? t('resetTitle') : t('loginTitle');
  return (
    <div className="auth-page container" dir="ltr">
      <aside className="auth-art" dir={dir}>
        <span className="eyebrow">{t('artEyebrow')}</span>
        <h2>
          {t('artTitleA')}
          <br />
          <em>{t('artTitleB')}</em>
        </h2>
        <div className="auth-art-bottom">
          <Globe2 size={38} />
          <span>{t('artFooter')}</span>
        </div>
      </aside>
      <section className="auth-panel" dir={dir}>
        <span className="eyebrow">
          {mode === 'register'
            ? t('joinEyebrow')
            : mode === 'reset'
              ? t('resetEyebrow')
              : t('loginEyebrow')}
        </span>
        <h1>{title}</h1>
        <p>
          {mode === 'register'
            ? t('registerHint')
            : mode === 'reset'
              ? t('resetHint')
              : t('loginHint')}
        </p>
        {mode === 'register' && (
          <p className="fine-print">
            <LinkedMessage
              message={t('ageNotice', {
                terms: MESSAGE_LINKS.terms,
                privacy: MESSAGE_LINKS.privacy,
              })}
              links={agreementLinks}
            />
          </p>
        )}
        {!firebaseConfigured && <div className="notice">{t('unconfigured')}</div>}
        {mode !== 'reset' && (
          <>
            <button
              className="button google-button"
              onClick={google}
              disabled={busy || !firebaseConfigured}
            >
              <GoogleIcon />
              {busy ? t('wait') : t('google')}
            </button>
            <div className="divider">
              <span>{t('orEmail')}</span>
            </div>
          </>
        )}
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="name-fields" dir="ltr">
              <label dir={dir}>
                {t('first')}
                <input
                  name="firstName"
                  dir="auto"
                  autoComplete="given-name"
                  required
                  maxLength={50}
                  placeholder={t('first')}
                />
              </label>
              <label dir={dir}>
                {t('last')}
                <input
                  name="lastName"
                  dir="auto"
                  autoComplete="family-name"
                  required
                  maxLength={50}
                  placeholder={t('last')}
                />
              </label>
            </div>
          )}
          <label>
            {t('email')}
            <input
              name="email"
              dir="ltr"
              type="email"
              autoComplete="email"
              required
              placeholder={t('email')}
            />
          </label>
          {mode !== 'reset' && (
            <label>
              {t('password')}
              <div className="password-field">
                <input
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  maxLength={128}
                  placeholder={mode === 'register' ? t('passwordHint') : t('passwordPlaceholder')}
                />
                <button
                  type="button"
                  aria-label={visible ? t('hide') : t('show')}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}
          {mode === 'login' && (
            <Link className="forgot-link" href="/forgot-password">
              {t('forgot')}
            </Link>
          )}
          {mode === 'register' && (
            <label className="checkbox-label" dir="ltr">
              <input type="checkbox" required />
              <span dir={dir}>
                <LinkedMessage
                  message={t('registerAgreement', {
                    terms: MESSAGE_LINKS.terms,
                    privacy: MESSAGE_LINKS.privacy,
                  })}
                  links={agreementLinks}
                />
              </span>
            </label>
          )}
          <button className="button primary full-width" disabled={busy || !firebaseConfigured}>
            {busy
              ? t('wait')
              : mode === 'register'
                ? t('create')
                : mode === 'reset'
                  ? t('sendReset')
                  : navigation('login')}
            <ArrowRight size={17} />
          </button>
        </form>
        {error && (
          <p role="alert" className="error-message">
            {t(error)}
          </p>
        )}
        {success && (
          <p role="status" className="success-message">
            {t('resetSuccess')}
            {mode === 'register' && <Link href={destination}> {t('continueAccount')} →</Link>}
          </p>
        )}
        <p className="auth-switch">
          {mode === 'login' ? (
            <>
              {t('newHere')}{' '}
              <Link href={`/register${next ? `?next=${encodeURIComponent(destination)}` : ''}`}>
                {site('createAccount')}
              </Link>
            </>
          ) : mode === 'register' ? (
            <>
              {t('alreadyMember')}{' '}
              <Link href={`/login${next ? `?next=${encodeURIComponent(destination)}` : ''}`}>
                {navigation('login')}
              </Link>
            </>
          ) : (
            <Link href="/login">{t('backLogin')}</Link>
          )}
        </p>
        <div className="auth-secure">
          <ShieldCheck size={15} />
          {t('secure')}
        </div>
      </section>
    </div>
  );
}
