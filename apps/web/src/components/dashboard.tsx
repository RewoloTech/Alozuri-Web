'use client';
import Link from 'next/link';
import { AccountGate } from './account-gate';
import { useEffect, useState } from 'react';
import { sendEmailVerification, updateProfile } from 'firebase/auth';
import { Globe2, ShieldCheck, Receipt, ArrowRight } from 'lucide-react';
import { money, accountName, nameFields, type CustomerOrder } from '@voyaspan/shared';
import { useAuth } from './auth-provider';
import { api, demoMode } from '@/lib/api';
export function Dashboard() {
  const { user } = useAuth();
  return (
    <AccountGate>
      <AccountDashboard key={user?.uid ?? 'preview'} />
    </AccountGate>
  );
}
function AccountDashboard() {
  const { user, loading, logout } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function loadOrders() {
    setFetching(true);
    setError('');
    try {
      setOrders((await api<{ orders: CustomerOrder[] }>('/v1/orders', {}, true)).orders);
    } catch {
      setError('We couldn’t load your orders. Please try again.');
    } finally {
      setFetching(false);
    }
  }
  useEffect(() => {
    if (!user || demoMode) return;
    let active = true;
    setFetching(true);
    api<{ orders: CustomerOrder[] }>('/v1/orders', {}, true)
      .then((r) => {
        if (active) setOrders(r.orders);
      })
      .catch(() => {
        if (active) setError('We couldn’t load your orders. Please try again.');
      })
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, [user]);
  async function accountAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    try {
      await action();
      setNotice(success);
    } catch {
      setError('That didn’t go through. Please wait a moment and try again.');
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="loading-page" role="status">
        Opening your account…
      </div>
    );
  return (
    <section className="container section">
      <div className="dashboard-heading">
        <div className="page-intro">
          <span className="eyebrow">YOUR VOYASPAN</span>
          <h1>
            {user
              ? `Hi, ${user.displayName?.split(' ')[0] || 'traveller'}.`
              : 'Every adventure, in one place.'}
          </h1>
          <p>Your plans and order history. Stripe test payments do not issue real eSIMs.</p>
        </div>
        {user && (
          <button
            className="button"
            disabled={busy}
            onClick={() => accountAction(logout, 'You’re signed out.')}
          >
            Sign out
          </button>
        )}
      </div>
      {!user && (
        <div className="notice">
          {demoMode
            ? 'Dashboard preview. Sign in to manage your account. No sample purchases are added to your account.'
            : 'Sign in to see your purchased eSIMs.'}{' '}
          <Link className="text-link" href="/login?next=/dashboard">
            Log in →
          </Link>{' '}
          ·{' '}
          <Link className="text-link" href="/register">
            Create an account
          </Link>
        </div>
      )}
      {user && !user.emailVerified && (
        <div className="notice">
          <strong>Verify your email before purchasing.</strong>
          <p>Open the link in your verification email, then check again.</p>
          <div className="inline-actions">
            <button
              className="button small"
              disabled={busy}
              onClick={() =>
                accountAction(() => sendEmailVerification(user), 'Verification email sent.')
              }
            >
              Resend email
            </button>
            <button
              className="button small"
              disabled={busy}
              onClick={() =>
                accountAction(async () => {
                  await user.reload();
                  await user.getIdToken(true);
                  if (!user.emailVerified) throw new Error('unverified');
                }, 'Your email is verified.')
              }
            >
              I’ve verified my email
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="error-message" role="alert">
          {error}{' '}
          {user && !demoMode && (
            <button className="text-link" onClick={loadOrders}>
              Retry
            </button>
          )}
        </div>
      )}
      <div className="account-stats">
        <div className="surface">
          <Globe2 />
          <strong>{orders.filter((o) => o.status === 'ready').length}</strong>
          <span>Ready eSIMs</span>
        </div>
        <div className="surface">
          <Receipt />
          <strong>{orders.length}</strong>
          <span>Orders</span>
        </div>
        <div className="surface">
          <ShieldCheck />
          <strong>{user?.emailVerified ? 'Verified' : user ? 'Check email' : 'Preview'}</strong>
          <span>Account status</span>
        </div>
      </div>
      <div className="detail-layout">
        <div className="surface">
          <div className="section-heading">
            <h2>My eSIMs & orders</h2>
            <Link className="text-link" href="/#planner">
              Find a plan <ArrowRight size={16} />
            </Link>
          </div>
          {fetching ? (
            <p role="status">Loading orders…</p>
          ) : orders.length ? (
            <div className="order-list">
              {orders.map((o) => (
                <Link key={o.id} href={`/dashboard/orders?id=${encodeURIComponent(o.id)}`}>
                  <div>
                    <strong>{o.plan.name}</strong>
                    <small>
                      {new Date(o.createdAt).toLocaleDateString('en-GB')} ·{' '}
                      {money(o.amountCents, o.currency)}
                    </small>
                  </div>
                  <span className="status-pill">
                    {o.test ? 'Test · ' : ''}
                    {o.status.replaceAll('_', ' ')}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Globe2 size={38} />
              <h3>Your next connection starts here.</h3>
              <p>
                {error
                  ? 'Orders are temporarily unavailable.'
                  : 'No eSIMs to show yet. When you buy a plan, its status and installation details will appear here.'}
              </p>
              <Link href="/#planner" className="button primary">
                Plan my next trip →
              </Link>
            </div>
          )}
        </div>
        <aside className="stack">
          <div className="surface">
            <h2>Account details</h2>
            {user ? (
              <>
                <p>{user.email}</p>
                <form
                  className="settings-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void accountAction(async () => {
                      const displayName = accountName(data.get('firstName'), data.get('lastName'));
                      await updateProfile(user, { displayName });
                    }, 'Your name has been updated.');
                  }}
                >
                  <label>
                    First name
                    <input
                      name="firstName"
                      defaultValue={nameFields(user.displayName).firstName}
                      required
                      maxLength={50}
                      autoComplete="given-name"
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      name="lastName"
                      defaultValue={nameFields(user.displayName).lastName}
                      required
                      maxLength={50}
                      autoComplete="family-name"
                    />
                  </label>
                  <button className="button small" disabled={busy}>
                    Save name
                  </button>
                </form>
                <Link href="/forgot-password" className="text-link">
                  Reset password →
                </Link>
              </>
            ) : (
              <p>Sign in to manage your profile.</p>
            )}
          </div>
          <div className="surface">
            <h2>Ready for take-off?</h2>
            <p>
              Check your phone, install over Wi-Fi, and read your plan’s activation rules before you
              travel.
            </p>
            <Link href="/help" className="text-link">
              Installation help ↗
            </Link>
            <p className="fine-print">
              Usage information can be delayed by approximately 2–3 hours.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
