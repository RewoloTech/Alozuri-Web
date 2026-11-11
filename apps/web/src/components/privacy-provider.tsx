'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  privacyChoice,
  readPrivacyChoice,
  TAWK_CHAT_URL,
  type PrivacyChoice,
} from '@voyaspan/shared/privacy';
import { BUSINESS } from '@voyaspan/shared/legal';
const PrivacyContext = createContext({ support: false, openSettings: () => {} });
export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoice] = useState<PrivacyChoice | null>(null),
    [ready, setReady] = useState(false),
    [settings, setSettings] = useState(false),
    [support, setSupport] = useState(false),
    [storageError, setStorageError] = useState('');
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
  function save(allowed: boolean) {
    const value = privacyChoice(allowed);
    try {
      document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      const saved = document.cookie.split('; ').find((c) => c.startsWith(CONSENT_COOKIE + '='));
      setStorageError(
        saved
          ? ''
          : 'Your browser did not save this choice. Optional support remains off; email support is available.',
      );
      setChoice(saved ? value : privacyChoice(false));
      setSupport(saved ? allowed : false);
    } catch {
      setChoice(privacyChoice(false));
      setSupport(false);
      setStorageError('Preferences could not be saved. Optional support remains off.');
    }
    close();
  }
  return (
    <PrivacyContext.Provider value={{ support: choice?.support ?? false, openSettings }}>
      {children}
      {ready && !choice && (
        <section className="cookie-banner" aria-label="Privacy choices">
          <div>
            <h2>Your privacy choices</h2>
            <p>
              Essential storage keeps sign-in, your basket and checkout working. Optional Tawk.to
              support is off until you choose it. We do not run analytics or advertising tags.{' '}
              <Link href="/cookies">Cookie Policy</Link>
            </p>
          </div>
          <div className="cookie-actions">
            <button className="button" onClick={() => save(true)}>
              Accept all
            </button>
            <button className="button" onClick={() => save(false)}>
              Reject optional
            </button>
            <button className="button" onClick={openSettings}>
              Customise choices
            </button>
          </div>
        </section>
      )}
      {storageError && (
        <p className="privacy-storage-message" role="status">
          {storageError}
        </p>
      )}
      {settings && (
        <dialog
          ref={dialog}
          className="privacy-dialog"
          aria-labelledby="privacy-title"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClose={() => setSettings(false)}
        >
          <h2 id="privacy-title">Cookie settings</h2>
          <p>
            Shopping and email support work without optional consent. Change your choice at any
            time.
          </p>
          <p>
            <strong>Necessary — always active.</strong> Account sessions, shopping basket, secure
            checkout, requested currency and these privacy choices.
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={support}
              onChange={(e) => setSupport(e.target.checked)}
            />
            <span>
              <strong>Optional support — Tawk.to.</strong> Enable the hosted chat link. Tawk is
              contacted only when you open chat; no widget code runs on Alozuri pages.
            </span>
          </label>
          <p>
            No analytics or advertising category is enabled because those tags are not installed.{' '}
            <Link href="/cookies">Read the cookie inventory</Link>.
          </p>
          <div className="cookie-actions">
            <button className="button" onClick={() => save(true)}>
              Accept all
            </button>
            <button className="button" onClick={() => save(false)}>
              Reject optional
            </button>
            <button className="button" onClick={() => save(support)}>
              Save choices
            </button>
            <button className="button" onClick={close}>
              Close settings
            </button>
          </div>
        </dialog>
      )}
      <Link className="support-shortcut" href="/contact" aria-label="Customer support">
        Help & chat
      </Link>
    </PrivacyContext.Provider>
  );
}
export function CookieSettingsButton() {
  const { openSettings } = useContext(PrivacyContext);
  return (
    <button className="text-link" onClick={openSettings}>
      Cookie settings
    </button>
  );
}
export function SupportChoices() {
  const { support, openSettings } = useContext(PrivacyContext);
  return (
    <div className="surface support-options">
      <h2>Choose how to contact us</h2>
      <p>
        <a href={'mailto:' + BUSINESS.email}>Email {BUSINESS.email}</a> without optional consent.
      </p>
      {support ? (
        <a
          className="button"
          href={TAWK_CHAT_URL}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          Open Tawk.to chat in a new tab
        </a>
      ) : (
        <button className="button" onClick={openSettings}>
          Choose optional chat
        </button>
      )}
      <p>
        Chat opens on Tawk.to’s separate site. Do not send passwords, full card details, QR codes or
        activation credentials. Agent availability is not guaranteed.
      </p>
    </div>
  );
}
