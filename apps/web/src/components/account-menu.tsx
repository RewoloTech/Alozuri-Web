'use client';
import Link from 'next/link';
import { ChevronDown, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export function AccountMenu({
  verified,
  onLogout,
}: {
  verified: boolean;
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
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
    setError('');
    try {
      await onLogout();
      setOpen(false);
    } catch {
      setError('Could not log out. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="account-menu"
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
        aria-label={verified ? 'My account' : 'Verify email'}
        title={verified ? 'My account' : 'Verify email'}
        ref={trigger}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <UserRound size={20} className="account-mobile-icon" aria-hidden="true" />
        <span className="account-trigger-label">{verified ? 'My account' : 'Verify email'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <nav className="account-menu-panel" id={id} aria-label="Account navigation">
          <Link href={verified ? '/account/esims' : '/verify-email'} onClick={() => setOpen(false)}>
            {verified ? 'My eSIMs' : 'Verify email'}
          </Link>
          <Link href="/dashboard#account-settings" onClick={() => setOpen(false)}>
            Account settings
          </Link>
          <button type="button" onClick={() => void signOut()} disabled={busy}>
            {busy ? 'Logging out…' : 'Log out'}
          </button>
          {error && <p role="alert">{error}</p>}
        </nav>
      )}
    </div>
  );
}
