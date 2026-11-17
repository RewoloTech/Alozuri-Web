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
import { BUSINESS } from '@alozuri/shared/legal';
import { SUPPORTED_CURRENCIES } from '@alozuri/shared';
import { useCurrency } from './currency-provider';
import { useAuth } from './auth-provider';
export function Brand() {
  const t = useTranslations('site');
  const wordmark = BUSINESS.brand.toLowerCase();
  return (
    <Link href="/" className="brand" aria-label={t('home')} dir="ltr">
      <span className="brand-icon">
        <Globe2 size={22} />
      </span>
      {wordmark.slice(0, 3)}
      <span className="brand-span">{wordmark.slice(3)}</span>
    </Link>
  );
}
export function Header() {
  const t = useTranslations('navigation');
  const s = useTranslations('site');
  const { user, logout, admin } = useAuth();
  const router = useRouter();
  const { currency, ready, setCurrency, available, locked } = useCurrency();
  const quantity = useSelector((s: RootState) => s.cart.items.reduce((n, i) => n + i.quantity, 0));
  const [open, setOpen] = useState(false);
  const navigationId = useId();
  return (
    <header className="site-header">
      <div className="container nav-wrap" dir="ltr">
        <Brand />
        <nav
          id={navigationId}
          className={open ? 'main-nav is-open' : 'main-nav'}
          aria-label={s('mainNav')}
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
                {t('login')}
              </Link>
              <Link href="/register" className="button primary" onClick={() => setOpen(false)}>
                {t('signup')}
              </Link>
            </div>
          )}
        </nav>
        <div className="nav-actions">
          <Link
            href="/cart"
            className="header-cart"
            aria-label={s('cartCount', { count: quantity })}
          >
            <ShoppingBag size={21} />
            {quantity > 0 && (
              <span className="cart-badge" aria-live="polite" aria-atomic="true">
                <bdi dir="ltr">{quantity}</bdi>
              </span>
            )}
          </Link>
          <select
            className="currency-select"
            dir="ltr"
            aria-label={s('currency')}
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
              {t('login')} <ArrowUpRight size={16} />
            </Link>
          )}
          {!user && (
            <Link href="/register" className="nav-login nav-signup">
              {t('signup')}
            </Link>
          )}
          <button
            className="mobile-toggle"
            aria-label={s(open ? 'closeMenu' : 'openMenu')}
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
