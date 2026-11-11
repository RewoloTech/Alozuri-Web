'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { money, type CartLine, type CartItem, type Plan } from '@voyaspan/shared';
import { removeFromCart, quantityChanged, type RootState } from '@/lib/store';
import { api } from '@/lib/api';
import { useAuth } from './auth-provider';
import { InstallationDetails } from './installation-details';
import { LineDescription } from './cart';
export type Purchase = {
  id: string;
  email: string;
  items: CartLine[];
  totalCents: number;
  currency: string;
  status: string;
  test: boolean;
  createdAt: string;
  legal?: {
    version: string;
    noticeText?: string;
    acceptedAt: string;
    effectiveDate: string;
    termsText: string;
    refundText: string;
    requestText: string;
    acknowledgementText: string;
  };
  allocations: { id: string; status: string; plan: Plan }[];
};
export function PurchaseStatus() {
  const id = useSearchParams().get('order') || '',
    { user } = useAuth();
  return <PrivatePurchase key={`${id}:${user?.uid ?? 'guest'}`} id={id} />;
}
function PrivatePurchase({ id }: { id: string }) {
  const { user } = useAuth(),
    dispatch = useDispatch(),
    cart = useSelector((s: RootState) => s.cart);
  const [order, setOrder] = useState<Purchase | null>(null),
    [access, setAccess] = useState(''),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('access');
    if (token) {
      sessionStorage.setItem('alozuri-order-' + id, token);
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
    setAccess(token || sessionStorage.getItem('alozuri-order-' + id) || '');
  }, [id]);
  useEffect(() => {
    if (!/^purchase_[a-f0-9]{48}$/.test(id) || (!access && !user?.emailVerified)) return;
    let active = true,
      timer: ReturnType<typeof setTimeout> | undefined,
      attempts = 0;
    async function poll() {
      try {
        const value = await api<Purchase>(
          '/v2/orders/' + id,
          { headers: access ? { 'X-Order-Access': access } : {} },
          Boolean(user?.emailVerified),
        );
        if (!active) return;
        setOrder(value);
        setError('');
        if (
          value.status !== 'cancelled' &&
          value.status !== 'refunded' &&
          (!value.allocations.length ||
            (!value.test &&
              value.allocations.some(
                (a) => !['ready', 'refunded', 'provision_error'].includes(a.status),
              ))) &&
          ++attempts < 90
        )
          timer = setTimeout(() => void poll(), 4000);
      } catch {
        if (active)
          setError(
            'We could not load this order. Use the private email link or sign in with the delivery email address.',
          );
      }
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, access, user, refresh]);
  useEffect(() => {
    if (
      !order ||
      !cart.ready ||
      !['paid', 'refunded', 'refund_pending', 'attention'].includes(order.status) ||
      sessionStorage.getItem('alozuri-cleared-' + id)
    )
      return;
    try {
      const purchased = JSON.parse(
        sessionStorage.getItem('alozuri-purchased-' + id) || '[]',
      ) as CartItem[];
      for (const item of purchased) {
        const line = cart.items.find((i) => i.plan.id === item.planId);
        if (!line) continue;
        if (line.quantity <= item.quantity) dispatch(removeFromCart(item.planId));
        else
          dispatch(quantityChanged({ id: item.planId, quantity: line.quantity - item.quantity }));
      }
      sessionStorage.setItem('alozuri-cleared-' + id, 'true');
      const attempt = JSON.parse(sessionStorage.getItem('alozuri-checkout-attempt') || '{}');
      if (attempt.orderId === id) sessionStorage.removeItem('alozuri-checkout-attempt');
    } catch {
      /* Cart content is never a payment authority. */
    }
  }, [order, cart.ready, cart.items, id, dispatch]);
  const ready = order?.allocations.length && order.allocations.every((a) => a.status === 'ready');
  return (
    <section className="container section">
      <div className="page-intro">
        <span className="eyebrow">YOUR ALOZURI ORDER</span>
        <h1>
          {order?.test
            ? 'Your test order'
            : ready
              ? 'Your eSIM is ready.'
              : order?.status === 'paid'
                ? 'Your eSIM is on its way.'
                : 'Checking your payment'}
        </h1>
      </div>
      {error ? (
        <div className="surface">
          <p role="alert">{error}</p>
          <button className="button" onClick={() => setRefresh((n) => n + 1)}>
            Check again
          </button>
          <Link href="/login?next=/account/esims">Sign in to your purchases</Link>
        </div>
      ) : !order ? (
        <p role="status">
          {!access && !user?.emailVerified
            ? 'Open your private order link from your email, or sign in to view your purchase.'
            : 'Confirming your order…'}
        </p>
      ) : (
        <div className="commerce-layout">
          <div className="stack">
            <div className="surface">
              <p>Order reference: {order.id}</p>
              <p>Payment: {order.status.replaceAll('_', ' ')}</p>
              <p>Delivery email: {order.email}</p>
              <p>Total: {money(order.totalCents, order.currency)}</p>
              {order.legal && (
                <details className="order-documents">
                  <summary>Order documents</summary>
                  <p>
                    Terms version {order.legal.version} · Accepted {order.legal.acceptedAt}
                  </p>
                  <button
                    className="button"
                    onClick={() => {
                      if (!order.legal) return;
                      const text = `Order ${order.id}\nTotal ${money(order.totalCents, order.currency)}\nAccepted ${order.legal.acceptedAt}\n${order.legal.noticeText ?? ''}\n${order.legal.requestText}\n${order.legal.acknowledgementText}\n\n${order.legal.termsText}\n\n${order.legal.refundText}`;
                      const url = URL.createObjectURL(
                        new Blob([text], { type: 'text/plain;charset=utf-8' }),
                      );
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = 'Alozuri-contract-' + order.id + '.txt';
                      link.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    Download your contract
                  </button>
                </details>
              )}
              {order.test ? (
                <p className="notice">Stripe test order. No real charge or eSIM is issued.</p>
              ) : order.status === 'paid' && !ready ? (
                <p role="status">
                  Preparing your eSIM. Installation information will be sent to your email after the
                  supplier confirms delivery. You can return to this private page at any time.
                </p>
              ) : null}
            </div>
            {order.allocations.map((a) => (
              <article className="surface stack" key={a.id}>
                <h2>{a.plan.name}</h2>
                <p>Status: {a.status.replaceAll('_', ' ')}</p>
                {a.status === 'ready' && !order.test ? (
                  <InstallationDetails orderId={a.id} purchaseId={id} accessToken={access} />
                ) : a.status === 'provision_error' ? (
                  <p>Delivery needs attention. Contact support with your order reference.</p>
                ) : a.status === 'refund_pending' ? (
                  <p>Your refund is being processed.</p>
                ) : null}
              </article>
            ))}
            <button className="button" onClick={() => setRefresh((n) => n + 1)}>
              Refresh order status
            </button>
            <Link className="text-link" href="/help">
              Installation guidance →
            </Link>
          </div>
          <aside className="surface stack">
            <h2>Your order</h2>
            {order.items.map((line) => (
              <div key={line.plan.id}>
                <LineDescription line={line} />
                <p>
                  Quantity {line.quantity} ·{' '}
                  {money(line.plan.priceCents * line.quantity, order.currency)}
                </p>
              </div>
            ))}
            <Link className="button" href="/account/esims">
              My eSIMs
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}
export function PurchaseHistory() {
  const { user } = useAuth();
  return <AccountPurchases key={user?.uid ?? 'guest'} />;
}
function AccountPurchases() {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<Purchase[] | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    if (!user?.emailVerified) return;
    let active = true;
    void api<{ orders: Purchase[] }>('/v2/orders', {}, true)
      .then((r) => {
        if (active) setOrders(r.orders);
      })
      .catch(() => {
        if (active) setError('Your purchases could not be loaded. Try again later.');
      });
    return () => {
      active = false;
    };
  }, [user]);
  return (
    <section className="container section">
      <div className="page-intro">
        <span className="eyebrow">YOUR ALOZURI</span>
        <h1>My eSIMs</h1>
        <p>Your purchases and installation details, in one place.</p>
      </div>
      {loading ? (
        <p role="status">Checking your account…</p>
      ) : !user?.emailVerified ? (
        <div className="surface">
          <p>
            Sign in with your verified delivery email to find your purchases. Guest customers can
            also use the private link in their delivery email.
          </p>
          <Link className="button primary" href="/login?next=/account/esims">
            Sign in
          </Link>
        </div>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : orders === null ? (
        <p role="status">Loading purchases…</p>
      ) : !orders.length ? (
        <div className="surface">
          <h2>No purchases yet</h2>
          <Link href="/destinations">Explore destinations →</Link>
        </div>
      ) : (
        <div className="stack">
          {orders.map((order) => (
            <article className="surface" key={order.id}>
              <h2>{order.items.map((i) => i.plan.name).join(', ')}</h2>
              <p>
                {new Date(order.createdAt).toLocaleDateString('en-GB')} ·{' '}
                {money(order.totalCents, order.currency)} · {order.test ? 'Test order · ' : ''}
                {order.status.replaceAll('_', ' ')}
              </p>
              <Link className="button" href={'/checkout/success?order=' + order.id}>
                View order and installation
              </Link>
            </article>
          ))}
        </div>
      )}
      <p>
        <Link href="/dashboard">Earlier orders and account settings →</Link>
      </p>
    </section>
  );
}
