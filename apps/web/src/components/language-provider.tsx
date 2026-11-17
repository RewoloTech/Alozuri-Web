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
  unlocalizedPath,
  resolveLocale,
  type Locale,
} from '@alozuri/shared/i18n';
import { englishMessages, type Messages } from '@alozuri/shared/i18n/messages';
import { loadMessages } from '@alozuri/shared/i18n/catalogs';
import { useAuth } from './auth-provider';
import { api } from '@/lib/api';
// Keep related Chinese options together without changing the shared locale registry order.
const languageOptions = LOCALES.flatMap<Locale>((locale) =>
  locale === 'zh-Hans' ? [locale, 'zh-Hant'] : locale === 'zh-Hant' ? [] : [locale],
);
const LanguageContext = createContext<{
  locale: Locale;
  changeLanguage: (locale: Locale) => Promise<void>;
  prepareNavigation: (href: string, localizedHref: string) => void;
  error: 'languageUnsupported' | 'languageLoadError' | 'languageSaveError' | '';
}>({ locale: 'en', changeLanguage: async () => {}, prepareNavigation: () => {}, error: '' });
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
  const [error, setError] = useState<
    'languageUnsupported' | 'languageLoadError' | 'languageSaveError' | ''
  >('');
  const explicit = useRef<Locale | undefined>(undefined);
  const automatic = useRef<Locale | undefined>(undefined);
  const generation = useRef(0);
  const selectionVersion = useRef(0);
  const preferenceSave = useRef(Promise.resolve());
  const lastPath = useRef<string | undefined>(undefined);
  const ownNavigation = useRef<string | undefined>(undefined);
  const previousCookie = useRef<string | undefined>(undefined);
  const navigationTarget = useRef<{ href: string; explicit: boolean } | undefined>(undefined);
  function prepareNavigation(href: string, localizedHref: string) {
    navigationTarget.current =
      href.startsWith('/') && !href.startsWith('//') && !internalLocalePath(href)
        ? { href: localizedHref, explicit: isLocale(href.split(/[/?#]/)[1]) }
        : undefined;
    const requested = href.split(/[/?#]/)[1];
    if (navigationTarget.current?.explicit && isLocale(requested)) {
      explicit.current = requested;
      automatic.current = undefined;
      selectionVersion.current++;
      generation.current++;
    }
  }
  function remember(value: Locale, selected: boolean) {
    persistLanguage(value, selected);
    previousCookie.current = `${selected ? '1' : '0'}:${value}`;
  }
  useEffect(() => {
    const back = () => {
      if (internalLocalePath(window.location.pathname)) return;
      const first = window.location.pathname.split('/')[1];
      const next = isLocale(first) ? first : 'en';
      selectionVersion.current++;
      generation.current++;
      explicit.current = next;
      automatic.current = undefined;
      ownNavigation.current = undefined;
      navigationTarget.current = undefined;
      remember(next, true);
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
    const selectedCookie = document.cookie
      .split('; ')
      .some((cookie) => cookie === LOCALE_EXPLICIT_COOKIE + '=1');
    const cookie = `${selectedCookie ? '1' : '0'}:${raw ?? ''}`;
    const changedPath = lastPath.current !== path;
    const initialPath = lastPath.current === undefined;
    const ownPath = ownNavigation.current === path;
    const targetPath = navigationTarget.current?.href.split(/[?#]/)[0];
    const pendingPath =
      targetPath !== undefined &&
      (targetPath === path || (ownPath && unlocalizedPath(targetPath) === unlocalizedPath(path)));
    const automaticNavigation = pendingPath && !navigationTarget.current?.explicit;
    if (pendingPath) navigationTarget.current = undefined;
    lastPath.current = path;
    if (ownPath) ownNavigation.current = undefined;
    // A new requested language URL outranks previous choices. Our own locale
    // redirects and same-language automatic navigation are not new selections.
    if (
      changedPath &&
      !ownPath &&
      !automaticNavigation &&
      isLocale(first) &&
      first !== automatic.current &&
      !(initialPath && selectionVersion.current > 0)
    ) {
      explicit.current = first;
      automatic.current = undefined;
      selectionVersion.current++;
    } else if (
      selectedCookie &&
      isLocale(raw) &&
      previousCookie.current !== undefined &&
      previousCookie.current !== cookie
    ) {
      // The canonical /en redirect can update the cookie without leaving an
      // English prefix in the visible URL. Honour that new explicit request too.
      explicit.current = raw;
      automatic.current = undefined;
      selectionVersion.current++;
    }
    previousCookie.current = cookie;
    const preferred = resolveLocale({
      explicit: explicit.current ?? (selectedCookie ? raw : undefined),
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
          const selected = explicit.current !== undefined || selectedCookie;
          if (!selected) automatic.current = preferred;
          remember(preferred, selected);
          if (!internalLocalePath(path)) {
            // Preference loading can finish while login/checkout navigation is
            // in flight. Localize its destination rather than reopening this page.
            const current =
              window.location.pathname + window.location.search + window.location.hash;
            const url = localePath(navigationTarget.current?.href ?? current, preferred);
            if (url !== current) {
              ownNavigation.current = url.split(/[?#]/)[0];
              router.replace(url, { scroll: false });
            }
          }
        }
      })
      .catch(() => {
        if (active && request === generation.current) setError('languageLoadError');
      });
    return () => {
      active = false;
    };
  }, [profile, profileLoading, user, authLoading, pathname, router]);
  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en-GB' : locale;
    document.documentElement.dir = localeDirection(locale);
  }, [locale]);
  async function changeLanguage(next: Locale) {
    if (!isLocale(next)) {
      setError('languageUnsupported');
      return;
    }
    generation.current++;
    const selection = ++selectionVersion.current;
    // Capture the intent before loading its catalogue. An account response that
    // arrives during this await must resolve to the customer's new choice.
    explicit.current = next;
    automatic.current = undefined;
    let translated: Messages;
    try {
      translated = await loadMessages(next);
    } catch {
      if (selection === selectionVersion.current) setError('languageLoadError');
      return;
    }
    if (selection !== selectionVersion.current) return;
    generation.current++;
    setMessages(translated);
    setLocale(next);
    setError('');
    remember(next, true);
    if (!internalLocalePath(window.location.pathname)) {
      const current = window.location.pathname + window.location.search + window.location.hash;
      const url = localePath(navigationTarget.current?.href ?? current, next);
      if (url !== current) {
        ownNavigation.current = url.split(/[?#]/)[0];
        router.replace(url, { scroll: false });
      }
    }
    if (user) {
      // Serialise preference writes so a slow earlier request cannot overwrite
      // the customer's most recent selection.
      preferenceSave.current = preferenceSave.current.then(async () => {
        try {
          await api(
            '/v2/profile/language',
            { method: 'PATCH', body: JSON.stringify({ locale: next }) },
            user.uid,
          );
          if (selection === selectionVersion.current) refreshProfile();
        } catch {
          if (selection === selectionVersion.current) setError('languageSaveError');
        }
      });
      await preferenceSave.current;
    }
  }
  return (
    <LanguageContext.Provider value={{ locale, changeLanguage, prepareNavigation, error }}>
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
  const site = useTranslations('site');
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
          {languageOptions.map((value) => (
            <option key={value} value={value}>
              {LOCALE_NAMES[value]}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <span className="language-selector-error" role="status">
          {site(error)}
        </span>
      )}
    </span>
  );
}
