'use client';
import Link from '@/components/localized-link';
import { useTranslations } from 'next-intl';
import { LanguageSelector } from './language-provider';
import { ArrowUpRight, Globe2, Menu, X, ShoppingBag } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/lib/store';
import { useId, useState } from 'react';
import { useLocalizedRouter as useRouter } from '@/lib/localized-router';
import { AccountMenu } from './account-menu';
import { SUPPORTED_CURRENCIES } from '@alozuri/shared';
import { useCurrency } from './currency-provider';
import { useAuth } from './auth-provider';
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Alozuri home" dir="ltr">
      <span className="brand-icon">
        <Globe2 size={22} />
      </span>
      alo<span className="brand-span">zuri</span>
    </Link>
  );
}
export function Header() {
  const t = useTranslations('navigation');
  const { user, logout, admin } = useAuth();
  const router = useRouter();
  const { currency, ready, setCurrency, available, locked } = useCurrency();
  const quantity = useSelector((s: RootState) => s.cart.items.reduce((n, i) => n + i.quantity, 0));
  const [open, setOpen] = useState(false);
  const navigationId = useId();
  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Brand />
        <nav
          id={navigationId}
          className={open ? 'main-nav is-open' : 'main-nav'}
          aria-label="Main navigation"
        >
          <Link href="/destinations" onClick={() => setOpen(false)}>
            {t('destinations')}
          </Link>
          <Link href="/#how-it-works" onClick={() => setOpen(false)}>
            {t('howItWorks')}
          </Link>
          <Link href="/help" onClick={() => setOpen(false)}>
            {t('help')}
          </Link>
          {!user && (
            <div className="mobile-menu-auth">
              <Link
                href="/login"
                className="button mobile-menu-login"
                onClick={() => setOpen(false)}
              >
                Log in
              </Link>
              <Link href="/register" className="button primary" onClick={() => setOpen(false)}>
                Sign up
              </Link>
            </div>
          )}
        </nav>
        <div className="nav-actions">
          <Link
            href="/cart"
            className="header-cart"
            aria-label={`Shopping cart, ${quantity} ${quantity === 1 ? 'item' : 'items'}`}
          >
            <ShoppingBag size={21} />
            {quantity > 0 && (
              <span className="cart-badge" aria-live="polite" aria-atomic="true">
                {quantity}
              </span>
            )}
          </Link>
          <select
            className="currency-select"
            dir="ltr"
            aria-label="Currency"
            disabled={locked}
            value={ready ? currency : ''}
            aria-busy={!ready}
            onChange={(e) => {
              const value = SUPPORTED_CURRENCIES.find((c) => c === e.target.value);
              if (value) setCurrency(value);
            }}
          >
            {!ready && <option value="">…</option>}
            {available.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <LanguageSelector compact />
          {user ? (
            <AccountMenu
              key={user.uid}
              verified={user.emailVerified}
              admin={admin}
              onLogout={async () => {
                await logout();
                setOpen(false);
                router.replace('/');
              }}
            />
          ) : (
            <Link href="/login" className="nav-login header-login">
              Log in <ArrowUpRight size={16} />
            </Link>
          )}
          {!user && (
            <Link href="/register" className="nav-login nav-signup">
              Sign up
            </Link>
          )}
          <button
            className="mobile-toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls={navigationId}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
