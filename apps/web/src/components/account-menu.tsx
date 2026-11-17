'use client';
import Link from '@/components/localized-link';
import { ChevronDown, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

export function AccountMenu({
  verified,
  admin = false,
  onLogout,
}: {
  verified: boolean;
  admin?: boolean;
  onLogout: () => Promise<void>;
}) {
  const t = useTranslations('site');
  const nav = useTranslations('navigation');
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await onLogout();
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="account-menu"
      dir="ltr"
      ref={root}
      onBlur={(event) => {
        // Disabling the logout button may blur it without a new focus target.
        // Keep errors visible; real focus moves outside still close the panel.
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        type="button"
        className="nav-login"
        aria-label={t(verified ? 'myAccount' : 'verifyEmail')}
        title={t(verified ? 'myAccount' : 'verifyEmail')}
        ref={trigger}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <UserRound size={20} className="account-mobile-icon" aria-hidden="true" />
        <span className="account-trigger-label" dir="auto">
          {t(verified ? 'myAccount' : 'verifyEmail')}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <nav className="account-menu-panel" id={id} aria-label={t('accountNav')}>
          <Link href={verified ? '/account/esims' : '/verify-email'} onClick={() => setOpen(false)}>
            {t(verified ? 'myEsims' : 'verifyEmail')}
          </Link>
          {verified && (
            <>
              <Link href="/account/usage" onClick={() => setOpen(false)}>
                {t('usage')}
              </Link>
              <Link href="/account/orders" onClick={() => setOpen(false)}>
                {t('orders')}
              </Link>
            </>
          )}
          {verified && admin && (
            <Link href="/operations" onClick={() => setOpen(false)}>
              {t('operations')}
            </Link>
          )}
          <Link href="/dashboard#account-settings" onClick={() => setOpen(false)}>
            {t('settings')}
          </Link>
          <button type="button" onClick={() => void signOut()} disabled={busy}>
            {busy ? t('loggingOut') : nav('logout')}
          </button>
          {error && <p role="alert">{t('logoutError')}</p>}
        </nav>
      )}
    </div>
  );
}
