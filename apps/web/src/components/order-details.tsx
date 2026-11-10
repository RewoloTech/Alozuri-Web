'use client';
import Link from 'next/link';
import { AccountGate } from './account-gate';
import { useCallback, useEffect, useState } from 'react';
import { StripeCheckout } from './stripe-checkout';
import { InstallationDetails } from './installation-details';
import type { CustomerOrder } from '@voyaspan/shared';
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
  const { user, loading } = useAuth();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [checking, setChecking] = useState(false);
  const [confirmationError, setConfirmationError] = useState('');
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
    } catch (e) {
      setConfirmationError(e instanceof Error ? e.message : 'Checkout could not be resumed.');
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
        setError('');
        const waiting = [
          'created',
          'checkout_pending',
          ...(!latest.test ? ['paid', 'fulfilling', 'provision_wait'] : []),
        ].includes(latest.status);
        if (!waiting) setCanResume(false);
        setConfirmationError(
          waiting && confirmationFailed
            ? 'We could not check Stripe yet. Your payment may still be processing.'
            : '',
        );
        if (waiting) {
          if (++attempts < 40) timer = setTimeout(() => void load(), 3000);
          else
            setConfirmationError(
              'Your order is taking longer than usual. Refresh its status or contact support before starting another payment.',
            );
        }
      } catch {
        if (active)
          setError('This order could not be loaded. Check your connection and try again.');
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
        ← My eSIMs
      </Link>
      <div className="page-intro">
        <h1>{order?.status === 'paid' && order.test ? 'Test payment complete' : 'Your order'}</h1>
      </div>
      {clientSecret ? (
        <StripeCheckout clientSecret={clientSecret} orderId={id} onComplete={complete} />
      ) : loading ? (
        <p role="status">Checking your account…</p>
      ) : !user ? (
        <Link
          className="button primary"
          href={`/login?next=${encodeURIComponent(`/dashboard/orders?id=${encodeURIComponent(id)}`)}`}
        >
          Sign in to view this order
        </Link>
      ) : demoMode ? (
        <div className="notice">
          No purchased eSIM exists in this preview. Installation codes are only available after a
          real order is fulfilled.
        </div>
      ) : pending ? (
        <p role="status">Loading order…</p>
      ) : error ? (
        <p role="alert" className="error-message">
          {error}
          <button className="button" onClick={() => setRefresh((n) => n + 1)}>
            Try again
          </button>
        </p>
      ) : (
        order && (
          <div className="surface">
            <h2>{order.plan.name}</h2>
            <p>Status: {order.status.replaceAll('_', ' ')}</p>
            <p>Order reference: {order.id}</p>
            <div className="notice">
              {order.test
                ? order.status === 'paid'
                  ? 'Your Stripe test payment is confirmed. No real money was charged and no eSIM was ordered.'
                  : order.status === 'expired'
                    ? 'This test checkout expired. No eSIM was issued.'
                    : 'This is a Stripe test order. Payment confirmation will appear here after Stripe confirms it. No eSIM will be issued.'
                : order.status === 'ready'
                  ? 'Your eSIM is ready. Open the installation details below.'
                  : order.status === 'refunded'
                    ? 'Your payment has been refunded. Allow time for your bank to display the credit.'
                    : order.status === 'refund_pending'
                      ? 'A refund is being processed. Contact support with your order reference if you need help.'
                      : order.status === 'provision_error'
                        ? 'Your order needs attention. Contact support with your order reference.'
                        : order.status === 'expired'
                          ? 'This checkout expired without a confirmed payment.'
                          : 'Your payment will be verified and your eSIM will appear here after provisioning. You can return to this page at any time.'}
            </div>
            {!order.test && order.status === 'ready' && <InstallationDetails orderId={id} />}
            {canResume && (
              <button className="button primary" disabled={resuming} onClick={resume}>
                {resuming ? 'Opening payment…' : 'Continue payment'}
              </button>
            )}
            {confirmationError && <p role="status">{confirmationError}</p>}
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
                {checking ? 'Checking payment…' : 'Check payment status'}
              </button>
            )}
            {order.status === 'expired' && (
              <p>
                This checkout expired without a confirmed payment.{' '}
                <Link href={'/checkout/' + encodeURIComponent(order.plan.id)}>
                  Try checkout again
                </Link>
              </p>
            )}
            <Link href="/help">Installation guidance →</Link>
          </div>
        )
      )}
    </section>
  );
}
