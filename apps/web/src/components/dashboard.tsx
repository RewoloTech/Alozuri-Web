'use client';
import { useLocale, useTranslations } from 'next-intl';
import type { Messages } from '@alozuri/shared/i18n/messages';
import { usePlanCopy } from '@/lib/use-plan-copy';
import { useStatusCopy } from '@/lib/use-status-copy';
import { authClient } from '@/lib/firebase';
import Link from '@/components/localized-link';
import { AccountGate } from './account-gate';
import { AccountNavigation } from './account-navigation';
import { LanguageSelector } from './language-provider';
import { useEffect, useState } from 'react';
import { sendEmailVerification, updateProfile } from 'firebase/auth';
import { Globe2, ShieldCheck, Receipt, ArrowRight } from 'lucide-react';
import { money, nameFields, accountName, type CustomerOrder } from '@alozuri/shared';
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
  const t = useTranslations('dashboardUi');
  const common = useTranslations('common');
  const auth = useTranslations('authUi');
  const navigation = useTranslations('navigation');
  const site = useTranslations('site');
  const orderCopy = useTranslations('orderUi');
  const locale = useLocale();
  const copy = usePlanCopy();
  const status = useStatusCopy();
  const { user, loading, logout, profile, profileError, profileLoading, refreshProfile } =
    useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<'ordersError' | 'actionError' | ''>('');
  const [notice, setNotice] = useState<keyof Messages['dashboardUi'] | 'verifySent' | ''>('');
  const [busy, setBusy] = useState(false);
  async function loadOrders() {
    setFetching(true);
    setError('');
    try {
      setOrders((await api<{ orders: CustomerOrder[] }>('/v1/orders', {}, true)).orders);
    } catch {
      setError('ordersError');
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
        if (active) setError('ordersError');
      })
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, [user]);
  async function accountAction(
    action: () => Promise<void>,
    success: keyof Messages['dashboardUi'] | 'verifySent',
  ) {
    setBusy(true);
    setError('');
    try {
      await action();
      setNotice(success);
    } catch {
      setError('actionError');
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="loading-page" role="status">
        {t('opening')}
      </div>
    );
  return (
    <section className="container section">
      <div className="dashboard-heading" dir="ltr">
        <div className="page-intro" dir={copy.dir}>
          <span className="eyebrow">{orderCopy('accountEyebrow')}</span>
          <h1>
            {user
              ? t('greeting', {
                  name: copy.isolate(
                    (profile?.displayName ?? user.displayName)?.split(' ')[0] || t('traveller'),
                  ),
                })
              : t('title')}
          </h1>
          <p>{t('hint')}</p>
        </div>
        {user && (
          <button
            className="button"
            disabled={busy}
            onClick={() => accountAction(logout, 'signedOut')}
          >
            {navigation('logout')}
          </button>
        )}
      </div>
      <AccountNavigation active="profile" />
      <LanguageSelector />
      {profileError && (
        <div className="error-message" role="alert">
          {t('profileSyncError')}{' '}
          <button className="text-link" onClick={refreshProfile}>
            {t('retryProfile')}
          </button>
        </div>
      )}
      {profileLoading && <p role="status">{t('syncing')}</p>}
      {!user && (
        <div className="notice">
          {demoMode ? t('preview') : t('signinHint')}{' '}
          <Link className="text-link" href="/login?next=/dashboard">
            {navigation('login')}
          </Link>{' '}
          ·{' '}
          <Link className="text-link" href="/register">
            {site('createAccount')}
          </Link>
        </div>
      )}
      {user && !user.emailVerified && (
        <div className="notice">
          <strong>{t('verifyBefore')}</strong>
          <p>{t('verifyInstruction')}</p>
          <div className="inline-actions">
            <button
              className="button small"
              disabled={busy}
              onClick={() =>
                accountAction(() => {
                  authClient().languageCode = locale === 'zh-Hans' ? 'zh-CN' : locale;
                  return sendEmailVerification(user);
                }, 'verifySent')
              }
            >
              {auth('resend')}
            </button>
            <button
              className="button small"
              disabled={busy}
              onClick={() =>
                accountAction(async () => {
                  await user.reload();
                  await user.getIdToken(true);
                  if (!user.emailVerified) throw new Error('unverified');
                }, 'verified')
              }
            >
              {auth('verifiedButton')}
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p className="success-message" role="status">
          {notice === 'verifySent' ? auth('verifySent') : t(notice)}
        </p>
      )}
      {error && (
        <div className="error-message" role="alert">
          {t(error)}{' '}
          {user && !demoMode && (
            <button className="text-link" onClick={loadOrders}>
              {common('retry')}
            </button>
          )}
        </div>
      )}
      <div className="account-stats" dir="ltr">
        <div className="surface">
          <Globe2 />
          <strong>{orders.filter((o) => o.status === 'ready').length}</strong>
          <span>{t('earlierEsims')}</span>
        </div>
        <div className="surface">
          <Receipt />
          <strong>{orders.length}</strong>
          <span>{t('earlierOrders')}</span>
        </div>
        <div className="surface">
          <ShieldCheck />
          <strong>
            {user?.emailVerified ? t('verified') : user ? t('checkEmail') : t('guest')}
          </strong>
          <span>{t('accountStatus')}</span>
        </div>
      </div>
      <div className="detail-layout" dir="ltr">
        <div className="surface" dir={copy.dir}>
          <div className="section-heading">
            <h2>{t('earlierOrders')}</h2>
            <Link className="text-link" href="/#planner">
              {site('itinerary')} <ArrowRight size={16} />
            </Link>
          </div>
          {fetching ? (
            <p role="status">{orderCopy('loadingPurchases')}</p>
          ) : orders.length ? (
            <div className="order-list">
              {orders.map((o) => (
                <Link key={o.id} href={`/dashboard/orders?id=${encodeURIComponent(o.id)}`}>
                  <div>
                    <strong>{copy.title(o.plan)}</strong>
                    <small>
                      {new Date(o.createdAt).toLocaleDateString(locale === 'en' ? 'en-GB' : locale)}{' '}
                      · {money(o.amountCents, o.currency)}
                    </small>
                  </div>
                  <span className="status-pill">
                    {o.test ? orderCopy('testOrder') + ' · ' : ''}
                    {status.order(o.status)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Globe2 size={38} />
              <h3>{t('noEarlier')}</h3>
              <p>{error ? t('ordersUnavailable') : t('currentHint')}</p>
              <Link href="/#planner" className="button primary">
                {t('nextTrip')}
              </Link>
            </div>
          )}
        </div>
        <aside className="stack" dir={copy.dir}>
          <div className="surface" id="account-settings">
            <h2>{t('details')}</h2>
            {user ? (
              <>
                <p dir="ltr">{user.email}</p>
                <form
                  key={JSON.stringify([
                    profile?.firstName ?? nameFields(user.displayName).firstName,
                    profile?.lastName ?? nameFields(user.displayName).lastName,
                  ])}
                  className="settings-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void accountAction(async () => {
                      const displayName = accountName(data.get('firstName'), data.get('lastName'));
                      await updateProfile(user, { displayName });
                      await api(
                        '/v2/profile',
                        {
                          method: 'PATCH',
                          body: JSON.stringify({
                            firstName: String(data.get('firstName') ?? ''),
                            lastName: String(data.get('lastName') ?? ''),
                          }),
                        },
                        user.uid,
                      );
                      await user.reload();
                      refreshProfile();
                    }, 'nameSaved');
                  }}
                >
                  <label>
                    {auth('first')}
                    <input
                      name="firstName"
                      defaultValue={profile?.firstName ?? nameFields(user.displayName).firstName}
                      required
                      maxLength={50}
                      autoComplete="given-name"
                    />
                  </label>
                  <label>
                    {auth('last')}
                    <input
                      name="lastName"
                      defaultValue={profile?.lastName ?? nameFields(user.displayName).lastName}
                      required
                      maxLength={50}
                      autoComplete="family-name"
                    />
                  </label>
                  <button className="button small" disabled={busy}>
                    {t('saveName')}
                  </button>
                </form>
                <Link href="/forgot-password" className="text-link">
                  {auth('resetEyebrow')}
                </Link>
              </>
            ) : (
              <p>{t('manageHint')}</p>
            )}
          </div>
          <div className="surface">
            <h2>{t('takeoff')}</h2>
            <p>{t('installHint')}</p>
            <Link href="/help" className="text-link">
              {t('installHelp')}
            </Link>
            <p className="fine-print">{t('usageDelay')}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
