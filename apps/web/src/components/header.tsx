'use client';
import Link from 'next/link';
import { ArrowUpRight, Globe2, Menu, X } from 'lucide-react';
import { useState } from 'react';
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
          <span className="currency">
            <Globe2 size={15} /> USD $
          </span>
          <Link
            href={user ? (user.emailVerified ? '/dashboard' : '/verify-email') : '/login'}
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
