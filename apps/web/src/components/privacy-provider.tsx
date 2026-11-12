'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, X } from 'lucide-react';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  privacyChoice,
  readPrivacyChoice,
  TAWK_CHAT_URL,
  type PrivacyChoice,
} from '@alozuri/shared/privacy';
import { BUSINESS } from '@alozuri/shared/legal';
const PrivacyContext = createContext({ openChat: () => {}, openSettings: () => {} });
export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoice] = useState<PrivacyChoice | null>(null),
    [ready, setReady] = useState(false),
    [settings, setSettings] = useState(false),
    [support, setSupport] = useState(false),
    [storageError, setStorageError] = useState(''),
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
    <PrivacyContext.Provider value={{ openChat, openSettings }}>
      {children}
      {ready && !choice && (
        <section className="cookie-banner" aria-label="Privacy choices">
          <div>
            <h2>Your privacy choices</h2>
            <p>
              Essential storage keeps sign-in, your basket and checkout working. Optional Tawk.to
              chat and its service providers, including Cloudflare, stay off until you allow and
              open chat. <Link href="/cookies">Cookie Policy</Link>
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
              <strong>Optional support — Tawk.to.</strong> Allow live chat when you choose to open
              it, including the provider’s service analytics and security technologies. We do not
              automatically share your account or order details with chat.
            </span>
          </label>
          <p>
            Alozuri has no separate advertising or audience-analytics tools. The optional chat
            provider may use its own service analytics and security providers.{' '}
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
      {chatOpen && (
        <dialog
          ref={chatDialog}
          className="chat-panel"
          aria-labelledby="chat-title"
          onCancel={(event) => {
            event.preventDefault();
            closeChat();
          }}
        >
          <header className="chat-panel-header">
            <h2 id="chat-title">Chat</h2>
            <button type="button" onClick={closeChat} aria-label="Close chat">
              <X size={22} />
            </button>
          </header>
          {choice?.support ? (
            <iframe
              title="Alozuri customer chat"
              src={TAWK_CHAT_URL}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="chat-permission">
              <MessageCircle size={32} aria-hidden="true" />
              <h3>Chat with Alozuri</h3>
              <p>
                Chat is provided by Tawk.to and may use its cookies and storage. Enable optional
                support to start. We do not share your account, order or installation details
                automatically.
              </p>
              <button type="button" className="button primary" onClick={() => save(true)}>
                Enable chat
              </button>
              <p>
                Prefer email? <a href={'mailto:' + BUSINESS.email}>{BUSINESS.email}</a>
              </p>
              <Link href="/cookies" onClick={closeChat}>
                Privacy and cookie choices
              </Link>
            </div>
          )}
          {choice?.support && (
            <p className="chat-fallback">
              Chat not loading? <a href={'mailto:' + BUSINESS.email}>Email us</a>.
            </p>
          )}
        </dialog>
      )}
      <button
        type="button"
        className="support-shortcut"
        onClick={openChat}
        aria-haspopup="dialog"
        aria-expanded={chatOpen}
      >
        <MessageCircle size={20} aria-hidden="true" /> Chat
      </button>
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
  const { openChat } = useContext(PrivacyContext);
  return (
    <div className="surface support-options">
      <h2>Choose how to contact us</h2>
      <p>
        <a href={'mailto:' + BUSINESS.email}>Email {BUSINESS.email}</a> without optional consent.
      </p>
      <button className="button" onClick={openChat}>
        Open chat
      </button>
      <p>
        Chat opens in the corner on desktop and full screen on mobile. Do not send passwords, full
        card details, QR codes or activation credentials. Agent availability is not guaranteed.
      </p>
    </div>
  );
}
