'use client';
import Link from 'next/link';
import { ArrowUpRight, Globe2, Menu, X, ShoppingBag } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/lib/store';
import { useState } from 'react';
import { SUPPORTED_CURRENCIES } from '@voyaspan/shared';
import { useCurrency } from './currency-provider';
import { useAuth } from './auth-provider';
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Alozuri home">
      <span className="brand-icon">
        <Globe2 size={22} />
      </span>
      alo<span className="brand-span">zuri</span>
    </Link>
  );
}
export function Header() {
  const { user } = useAuth();
  const { currency, setCurrency, available, locked } = useCurrency();
  const quantity = useSelector((s: RootState) => s.cart.items.reduce((n, i) => n + i.quantity, 0));
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Brand />
        <nav className={open ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
          <Link href="/destinations" onClick={() => setOpen(false)}>
            Destinations
          </Link>
          <Link href="/#how-it-works" onClick={() => setOpen(false)}>
            How it works
          </Link>
          <Link href="/help" onClick={() => setOpen(false)}>
            Help centre
          </Link>
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
            aria-label="Currency"
            disabled={locked}
            value={currency}
            onChange={(e) => {
              const value = SUPPORTED_CURRENCIES.find((c) => c === e.target.value);
              if (value) setCurrency(value);
            }}
          >
            {available.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Link
            href={user ? (user.emailVerified ? '/account/esims' : '/verify-email') : '/login'}
            className="nav-login"
          >
            {user ? (user.emailVerified ? 'My account' : 'Verify email') : 'Log in'}{' '}
            <ArrowUpRight size={16} />
          </Link>
          {!user && (
            <Link href="/register" className="nav-login nav-signup">
              Sign up
            </Link>
          )}
          <button
            className="mobile-toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
