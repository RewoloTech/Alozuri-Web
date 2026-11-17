'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Link from '@/components/localized-link';
import { MessageCircle, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  privacyChoice,
  readPrivacyChoice,
  TAWK_CHAT_URL,
  type PrivacyChoice,
} from '@alozuri/shared/privacy';
import { localeDirection } from '@alozuri/shared/i18n';
import { BUSINESS } from '@alozuri/shared/legal';
const PrivacyContext = createContext({
  openChat: () => {},
  openSettings: () => {},
  marketingAllowed: false,
});
export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('privacyUi');
  const site = useTranslations('site');
  const legal = useTranslations('legal');
  const dir = localeDirection(useLocale());
  const [choice, setChoice] = useState<PrivacyChoice | null>(null),
    [ready, setReady] = useState(false),
    [settings, setSettings] = useState(false),
    [support, setSupport] = useState(false),
    [marketing, setMarketing] = useState(false),
    [storageError, setStorageError] = useState<'storageRefused' | 'storageFailed' | ''>(''),
    [chatOpen, setChatOpen] = useState(false);
  const chatDialog = useRef<HTMLDialogElement>(null),
    chatTrigger = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const read = () => {
      const raw = document.cookie
        .split('; ')
        .find((c) => c.startsWith(CONSENT_COOKIE + '='))
        ?.slice(CONSENT_COOKIE.length + 1);
      const value = readPrivacyChoice(raw);
      setChoice(value);
      setSupport(value?.support ?? false);
      setMarketing(value?.marketing ?? false);
      setReady(true);
    };
    read();
    const timer = setInterval(read, 60000);
    window.addEventListener('focus', read);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', read);
    };
  }, []);
  function openSettings() {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSupport(choice?.support ?? false);
    setMarketing(choice?.marketing ?? false);
    setSettings(true);
  }
  useEffect(() => {
    if (settings) dialog.current?.showModal();
    else trigger.current?.focus();
  }, [settings]);
  function close() {
    dialog.current?.close();
    setSettings(false);
    trigger.current?.focus();
  }
  function save(allowed: boolean, advertising = allowed) {
    const value = privacyChoice(allowed, Date.now(), advertising);
    try {
      document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      const stored = document.cookie
        .split('; ')
        .find((c) => c.startsWith(CONSENT_COOKIE + '='))
        ?.slice(CONSENT_COOKIE.length + 1);
      const saved = stored === encodeURIComponent(JSON.stringify(value));
      setStorageError(saved ? '' : 'storageRefused');
      setChoice(saved ? value : privacyChoice(false));
      setSupport(saved ? allowed : false);
      setMarketing(saved ? advertising : false);
    } catch {
      setChoice(privacyChoice(false));
      setSupport(false);
      setMarketing(false);
      setStorageError('storageFailed');
    }
    close();
  }
  function openChat() {
    chatTrigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setChatOpen(true);
  }
  function closeChat() {
    setChatOpen(false);
  }
  useEffect(() => {
    if (!chatOpen) {
      const previous = chatTrigger.current;
      if (previous) {
        const visible = previous.getClientRects().length
          ? previous
          : [...document.querySelectorAll<HTMLButtonElement>('.support-shortcut')].find(
              (button) => button.getClientRects().length > 0,
            );
        visible?.focus();
      }
      return;
    }
    const panel = chatDialog.current;
    const mobile = window.matchMedia('(max-width: 600px)');
    function resize() {
      if (!panel) return;
      panel.close();
      if (mobile.matches) panel.showModal();
      else panel.show();
    }
    resize();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !dialog.current?.open) {
        event.preventDefault();
        setChatOpen(false);
      }
    };
    mobile.addEventListener('change', resize);
    document.addEventListener('keydown', key);
    return () => {
      mobile.removeEventListener('change', resize);
      document.removeEventListener('keydown', key);
    };
  }, [chatOpen]);
  return (
    <PrivacyContext.Provider
      value={{ openChat, openSettings, marketingAllowed: ready && choice?.marketing === true }}
    >
      {children}
      {ready && !choice && (
        <section className="cookie-banner" dir="ltr" aria-label={t('choices')}>
          <div dir={dir}>
            <h2>{t('choices')}</h2>
            <p>
              {t('banner')} <Link href="/cookies">{legal('cookies')}</Link>
            </p>
          </div>
          <div className="cookie-actions" dir="ltr">
            <button className="button" onClick={() => save(true)}>
              {t('acceptAll')}
            </button>
            <button className="button" onClick={() => save(false)}>
              {t('reject')}
            </button>
            <button className="button" onClick={openSettings}>
              {t('customize')}
            </button>
          </div>
        </section>
      )}
      {storageError && (
        <p className="privacy-storage-message" role="status">
          {t(storageError)}
        </p>
      )}
      {settings && (
        <dialog
          ref={dialog}
          className="privacy-dialog"
          dir={dir}
          aria-labelledby="privacy-title"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClose={() => setSettings(false)}
        >
          <h2 id="privacy-title">{site('cookieSettings')}</h2>
          <p>{t('settingsHint')}</p>
          <p>
            <strong>{t('necessaryTitle')}</strong> {t('necessary')}
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={support}
              onChange={(e) => setSupport(e.target.checked)}
            />
            <span>
              <strong>{t('optionalSupportTitle')}</strong> {t('optionalSupport')}
            </span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
            />
            <span>
              <strong>{t('advertisingTitle')}</strong> {t('advertising')}
            </span>
          </label>
          <p>
            {t('measurement')} <Link href="/cookies">{t('inventory')}</Link>.
          </p>
          <div className="cookie-actions" dir="ltr">
            <button className="button" onClick={() => save(true)}>
              {t('acceptAll')}
            </button>
            <button className="button" onClick={() => save(false)}>
              {t('reject')}
            </button>
            <button className="button" onClick={() => save(support, marketing)}>
              {t('save')}
            </button>
            <button className="button" onClick={close}>
              {t('closeSettings')}
            </button>
          </div>
        </dialog>
      )}
      {chatOpen && (
        <dialog
          ref={chatDialog}
          className="chat-panel"
          dir={dir}
          aria-labelledby="chat-title"
          onCancel={(event) => {
            event.preventDefault();
            closeChat();
          }}
        >
          <header className="chat-panel-header" dir="ltr">
            <h2 id="chat-title">{t('chat')}</h2>
            <button type="button" onClick={closeChat} aria-label={t('closeChat')}>
              <X size={22} />
            </button>
          </header>
          {choice?.support ? (
            <iframe
              title={t('chatFrame')}
              src={TAWK_CHAT_URL}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="chat-permission">
              <MessageCircle size={32} aria-hidden="true" />
              <h3>{t('chatTitle')}</h3>
              <p>{t('chatPrivacy')}</p>
              <button
                type="button"
                className="button primary"
                onClick={() => save(true, choice?.marketing === true)}
              >
                {t('enableChat')}
              </button>
              <p>
                {t('preferEmail')}{' '}
                <a href={'mailto:' + BUSINESS.email}>
                  <bdi dir="ltr">{BUSINESS.email}</bdi>
                </a>
              </p>
              <Link href="/cookies" onClick={closeChat}>
                {t('privacyLink')}
              </Link>
            </div>
          )}
          {choice?.support && (
            <p className="chat-fallback">
              {t('chatLoading')} <a href={'mailto:' + BUSINESS.email}>{t('emailUs')}</a>.
            </p>
          )}
        </dialog>
      )}
      <button
        type="button"
        className="support-shortcut"
        aria-label={t('chat')}
        onClick={openChat}
        aria-haspopup="dialog"
        aria-expanded={chatOpen}
      >
        <MessageCircle size={20} aria-hidden="true" />
        <span className="support-shortcut-label">{t('chat')}</span>
      </button>
    </PrivacyContext.Provider>
  );
}
export function CookieSettingsButton() {
  const t = useTranslations('site');
  const { openSettings } = useContext(PrivacyContext);
  return (
    <button className="text-link" onClick={openSettings}>
      {t('cookieSettings')}
    </button>
  );
}
export function SupportChoices() {
  const t = useTranslations('privacyUi');
  const { openChat } = useContext(PrivacyContext);
  return (
    <div className="surface support-options">
      <h2>{t('contactTitle')}</h2>
      <p>
        <a href={'mailto:' + BUSINESS.email}>
          <bdi dir="ltr">{BUSINESS.email}</bdi>
        </a>{' '}
        {t('emailWithoutConsent')}
      </p>
      <button className="button" onClick={openChat}>
        {t('openChat')}
      </button>
      <p>{t('chatSafety')}</p>
    </div>
  );
}

export function useMarketingConsent() {
  return useContext(PrivacyContext).marketingAllowed;
}
