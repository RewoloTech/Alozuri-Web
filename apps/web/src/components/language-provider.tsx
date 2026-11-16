'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { Globe2, ChevronDown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LOCALE_COOKIE,
  LOCALE_EXPLICIT_COOKIE,
  LOCALES,
  LOCALE_NAMES,
  isLocale,
  localeDirection,
  localePath,
  internalLocalePath,
  resolveLocale,
  type Locale,
} from '@alozuri/shared/i18n';
import { englishMessages, type Messages } from '@alozuri/shared/i18n/messages';
import { loadMessages } from '@alozuri/shared/i18n/catalogs';
import { useAuth } from './auth-provider';
import { api } from '@/lib/api';
const LanguageContext = createContext<{
  locale: Locale;
  changeLanguage: (locale: Locale) => Promise<void>;
  error: string;
}>({ locale: 'en', changeLanguage: async () => {}, error: '' });
function persistLanguage(value: Locale, selected: boolean) {
  const options = `; Path=/; Max-Age=15552000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  document.cookie = `${LOCALE_COOKIE}=${value}${options}`;
  document.cookie = `${LOCALE_EXPLICIT_COOKIE}=${selected ? '1' : '0'}${options}`;
}
export function LanguageProvider({
  children,
  initialLocale = 'en',
  initialMessages = englishMessages,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
  initialMessages?: Messages;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, refreshProfile, loading: authLoading, profileLoading } = useAuth();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [messages, setMessages] = useState<Messages>(initialMessages);
  const [error, setError] = useState('');
  const explicit = useRef<Locale | undefined>(undefined);
  const automatic = useRef<Locale | undefined>(undefined);
  const generation = useRef(0);
  useEffect(() => {
    const back = () => {
      if (internalLocalePath(window.location.pathname)) return;
      const first = window.location.pathname.split('/')[1];
      const next = isLocale(first) ? first : 'en';
      explicit.current = next;
      automatic.current = undefined;
      persistLanguage(next, true);
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  useEffect(() => {
    if (authLoading || (user && profileLoading && !profile)) return;
    const raw = document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith(LOCALE_COOKIE + '='))
      ?.slice(LOCALE_COOKIE.length + 1);
    const path = window.location.pathname;
    const first = path.split('/')[1];
    const pathLocale = isLocale(first) && first !== automatic.current ? first : undefined;
    const selectedCookie = document.cookie
      .split('; ')
      .some((cookie) => cookie === LOCALE_EXPLICIT_COOKIE + '=1');
    const preferred = resolveLocale({
      explicit: explicit.current ?? pathLocale ?? (selectedCookie ? raw : undefined),
      account: profile?.locale,
      guest: raw,
      browser: navigator.languages,
    });
    const request = ++generation.current;
    let active = true;
    void loadMessages(preferred)
      .then((value) => {
        if (active && request === generation.current) {
          setLocale(preferred);
          setMessages(value);
          const selected =
            explicit.current !== undefined || pathLocale !== undefined || selectedCookie;
          if (!selected) automatic.current = preferred;
          persistLanguage(preferred, selected);
          if (!internalLocalePath(path)) {
            const url = localePath(path + window.location.search + window.location.hash, preferred);
            if (url !== path + window.location.search + window.location.hash)
              window.history.replaceState(window.history.state, '', url);
          }
        }
      })
      .catch(() => {
        if (active) setError('Your language could not be loaded. Please try again.');
      });
    return () => {
      active = false;
    };
  }, [profile, profileLoading, user, authLoading, pathname]);
  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en-GB' : locale;
    document.documentElement.dir = localeDirection(locale);
  }, [locale]);
  async function changeLanguage(next: Locale) {
    if (!isLocale(next)) {
      setError('This language is not supported.');
      return;
    }
    const request = ++generation.current;
    let translated: Messages;
    try {
      translated = await loadMessages(next);
    } catch {
      setError('Your language could not be loaded. Please try again.');
      return;
    }
    if (request !== generation.current) return;
    explicit.current = next;
    automatic.current = undefined;
    setMessages(translated);
    setLocale(next);
    setError('');
    persistLanguage(next, true);
    if (!internalLocalePath(window.location.pathname))
      window.history.replaceState(
        window.history.state,
        '',
        localePath(window.location.pathname + window.location.search + window.location.hash, next),
      );
    router.refresh();
    if (user) {
      try {
        await api(
          '/v2/profile/language',
          { method: 'PATCH', body: JSON.stringify({ locale: next }) },
          user.uid,
        );
        refreshProfile();
      } catch {
        setError(
          'Your language changed on this device, but your account preference could not be saved.',
        );
      }
    }
  }
  return (
    <LanguageContext.Provider value={{ locale, changeLanguage, error }}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/London">
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  return useContext(LanguageContext);
}
export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, changeLanguage, error } = useLanguage();
  const t = useTranslations('common');
  return (
    <span className={compact ? 'language-selector language-selector-compact' : 'language-selector'}>
      <label
        className="language-selector-control"
        title={`${t('language')}: ${LOCALE_NAMES[locale]}`}
      >
        <span className="sr-only">{t('language')}</span>
        {compact && (
          <>
            <Globe2 size={20} aria-hidden="true" />
            <ChevronDown size={12} aria-hidden="true" />
          </>
        )}
        <select
          aria-label={t('language')}
          value={locale}
          onChange={(event) => {
            const value = event.target.value;
            if (isLocale(value)) void changeLanguage(value);
          }}
        >
          {LOCALES.map((value) => (
            <option key={value} value={value}>
              {LOCALE_NAMES[value]}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <span className="language-selector-error" role="status">
          {error}
        </span>
      )}
    </span>
  );
}
