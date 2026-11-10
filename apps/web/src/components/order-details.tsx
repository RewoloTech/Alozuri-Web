'use client';
import Link from 'next/link';
import { AccountGate } from './account-gate';
import { useEffect, useState } from 'react';
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
  const orderStatus = order?.status;
  useEffect(() => {
    if (!user || !orderStatus || !['created', 'checkout_pending'].includes(orderStatus)) return;
    let attempts = 0;
    const timer = setInterval(() => {
      if (++attempts > 40) {
        clearInterval(timer);
        return;
      }
      void api<{ order: CustomerOrder }>(`/v1/orders/${encodeURIComponent(id)}`, {}, true)
        .then((r) => setOrder(r.order))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [user, id, orderStatus]);
  useEffect(() => {
    if (!user || demoMode) return;
    let active = true;
    api<{ order: CustomerOrder }>(`/v1/orders/${encodeURIComponent(id)}`, {}, true)
      .then((r) => {
        if (active) setOrder(r.order);
      })
      .catch(() => {
        if (active) setError('This order is unavailable or does not belong to your account.');
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [id, user]);
  return (
    <section className="container section">
      <Link className="text-link" href="/dashboard">
        ← My eSIMs
      </Link>
      <div className="page-intro">
        <h1>Your eSIM</h1>
      </div>
      {loading ? (
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
                  : 'This is a Stripe test order. Payment confirmation will appear here after Stripe confirms it. No eSIM will be issued.'
                : order.status === 'ready'
                  ? 'Contact support to retrieve installation details. Secure activation retrieval is not connected in this draft.'
                  : 'Your installation details will become available after provisioning is confirmed.'}
            </div>
            <Link href="/help">Installation guidance →</Link>
          </div>
        )
      )}
    </section>
  );
}
