'use client';
import { useTranslations } from 'next-intl';
import { usePlanCopy } from '@/lib/use-plan-copy';
import { useStatusCopy } from '@/lib/use-status-copy';
import Link from '@/components/localized-link';
import { AccountGate } from './account-gate';
import { useCallback, useEffect, useState } from 'react';
import { StripeCheckout } from './stripe-checkout';
import { InstallationDetails } from './installation-details';
import type { CustomerOrder } from '@alozuri/shared';
import { useAuth } from './auth-provider';
import { api, demoMode } from '@/lib/api';
export function OrderDetails({ id }: { id: string }) {
  const { user } = useAuth();
  return (
    <AccountGate next={`/dashboard/orders?id=${encodeURIComponent(id)}`}>
      <AccountOrder key={`${user?.uid ?? 'signed-out'}:${id}`} id={id} />
    </AccountGate>
  );
}
function AccountOrder({ id }: { id: string }) {
  const t = useTranslations('orderUi');
  const legacy = useTranslations('legacyOrder');
  const site = useTranslations('site');
  const auth = useTranslations('authUi');
  const payment = useTranslations('paymentUi');
  const checkout = useTranslations('checkout');
  const emailCopy = useTranslations('emails');
  const common = useTranslations('common');
  const copy = usePlanCopy();
  const status = useStatusCopy();
  const { user, loading } = useAuth();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [checking, setChecking] = useState(false);
  const [confirmationError, setConfirmationError] = useState<
    'resume' | 'stripePending' | 'delayed' | ''
  >('');
  const [canResume, setCanResume] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [resuming, setResuming] = useState(false);
  const complete = useCallback(() => {
    setClientSecret('');
    setRefresh((n) => n + 1);
  }, []);
  async function resume() {
    setResuming(true);
    setConfirmationError('');
    try {
      const result = await api<{ clientSecret?: string; url?: string }>(
        `/v1/orders/${encodeURIComponent(id)}/resume-checkout`,
        { method: 'POST' },
        true,
      );
      if (result.clientSecret) setClientSecret(result.clientSecret);
      else if (result.url) {
        const url = new URL(result.url);
        if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com')
          throw new Error('Invalid checkout URL.');
        window.location.assign(url.href);
      } else throw new Error('Checkout could not be resumed.');
    } catch {
      setConfirmationError('resume');
      setRefresh((n) => n + 1);
    } finally {
      setResuming(false);
    }
  }
  useEffect(() => {
    if (!user || demoMode) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    async function load() {
      setChecking(true);
      let confirmationFailed = false;
      // The server retrieves Stripe's session by the authenticated owner's stored order.
      // URL parameters and client completion callbacks never mark an order paid.
      try {
        const status = await api<{ canResume: boolean }>(
          `/v1/orders/${encodeURIComponent(id)}/payment-status`,
          { method: 'POST' },
          true,
        );
        if (active) setCanResume(status.canResume);
      } catch {
        confirmationFailed = true;
        if (active) setCanResume(false);
      }
      if (!active) return;
      try {
        const { order: latest } = await api<{ order: CustomerOrder }>(
          `/v1/orders/${encodeURIComponent(id)}`,
          {},
          true,
        );
        if (!active) return;
        setOrder(latest);
        setError(false);
        const waiting = [
          'created',
          'checkout_pending',
          ...(!latest.test ? ['paid', 'fulfilling', 'provision_wait'] : []),
        ].includes(latest.status);
        if (!waiting) setCanResume(false);
        setConfirmationError(waiting && confirmationFailed ? 'stripePending' : '');
        if (waiting) {
          if (++attempts < 40) timer = setTimeout(() => void load(), 3000);
          else setConfirmationError('delayed');
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) {
          setPending(false);
          setChecking(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, user, refresh]);
  return (
    <section className="container section">
      <Link className="text-link" href="/dashboard">
        {site('myEsims')}
      </Link>
      <div className="page-intro">
        <h1>{order?.status === 'paid' && order.test ? legacy('testComplete') : t('title')}</h1>
      </div>
      {clientSecret ? (
        <StripeCheckout clientSecret={clientSecret} orderId={id} onComplete={complete} />
      ) : loading ? (
        <p role="status">{auth('checkingAccess')}</p>
      ) : !user ? (
        <Link
          className="button primary"
          href={`/login?next=${encodeURIComponent(`/dashboard/orders?id=${encodeURIComponent(id)}`)}`}
        >
          {t('signinPurchases')}
        </Link>
      ) : demoMode ? (
        <div className="notice">{t('testNoUsage')}</div>
      ) : pending ? (
        <p role="status">{t('confirming')}</p>
      ) : error ? (
        <p role="alert" className="error-message">
          {t('loadError')}
          <button className="button" onClick={() => setRefresh((n) => n + 1)}>
            {common('retry')}
          </button>
        </p>
      ) : (
        order && (
          <div className="surface">
            <h2>{copy.title(order.plan)}</h2>
            <p>{t('unitStatus', { status: status.order(order.status) })}</p>
            <p>{emailCopy('reference', { reference: copy.isolate(order.id) })}</p>
            <div className="notice">
              {order.test
                ? order.status === 'paid'
                  ? t('testNotice')
                  : order.status === 'expired'
                    ? legacy('expired') + ' ' + t('testNotice')
                    : t('testNotice') + ' ' + t('checkingTitle')
                : order.status === 'ready'
                  ? t('readyTitle')
                  : order.status === 'refunded'
                    ? legacy('refunded')
                    : order.status === 'refund_pending'
                      ? t('refundNotice')
                      : order.status === 'provision_error'
                        ? t('deliveryIssue')
                        : order.status === 'expired'
                          ? legacy('expired')
                          : legacy('paymentPending')}
            </div>
            {!order.test && order.status === 'ready' && <InstallationDetails orderId={id} />}
            {canResume && (
              <button className="button primary" disabled={resuming} onClick={resume}>
                {resuming ? payment('preparing') : checkout('continue')}
              </button>
            )}
            {confirmationError && (
              <p role="status">
                {confirmationError === 'resume' ? payment('startError') : legacy(confirmationError)}
              </p>
            )}
            {[
              'created',
              'checkout_pending',
              ...(!order.test ? ['paid', 'fulfilling', 'provision_wait'] : []),
            ].includes(order.status) && (
              <button
                className="button"
                disabled={checking}
                onClick={() => setRefresh((n) => n + 1)}
              >
                {checking ? t('checkingTitle') : t('checkAgain')}
              </button>
            )}
            {order.status === 'expired' && (
              <p>
                {legacy('expired')}{' '}
                <Link href={'/checkout/' + encodeURIComponent(order.plan.id)}>
                  {common('retry')}
                </Link>
              </p>
            )}
            <Link href="/help">{t('guidance')}</Link>
          </div>
        )
      )}
    </section>
  );
}
