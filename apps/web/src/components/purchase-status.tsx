'use client';
import { AccountNavigation } from './account-navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { money, dataLabel, type CartLine, type CartItem, type Plan } from '@alozuri/shared';
import { removeFromCart, quantityChanged, type RootState } from '@/lib/store';
import { api } from '@/lib/api';
import {
  CONTRACT_PDF_FILENAME,
  contractPaymentConfirmed,
  type ContractLegal,
} from '@alozuri/shared/contract';
import { useAuth } from './auth-provider';
import { InstallationDetails } from './installation-details';
import { EsimUsagePanel } from './esim-usage';
import { LineDescription } from './cart';
export type Purchase = {
  id: string;
  reference?: string;
  confirmationNeedsSupport?: boolean;
  contractDownloadAvailable?: boolean;
  email: string;
  items: CartLine[];
  totalCents: number;
  currency: string;
  status: string;
  test: boolean;
  createdAt: string;
  paidAt?: string;
  customerName?: string;
  subtotalCents?: number;
  taxCents?: number;
  legal?: ContractLegal;
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
    [refresh, setRefresh] = useState(0),
    [downloadingContract, setDownloadingContract] = useState(false),
    [contractError, setContractError] = useState('');
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
              <p>Order reference: {order.reference ?? order.id}</p>
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
                    disabled={!contractPaymentConfirmed(order) || downloadingContract}
                    onClick={async () => {
                      setDownloadingContract(true);
                      setContractError('');
                      try {
                        if (!order.legal) throw new Error('The recorded contract is unavailable.');
                        const { createContractPdf } = await import('@/lib/contract-download');
                        const pdf = await createContractPdf({ ...order, legal: order.legal });
                        const url = URL.createObjectURL(pdf);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = CONTRACT_PDF_FILENAME;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        setTimeout(() => URL.revokeObjectURL(url), 60000);
                      } catch (error) {
                        setContractError(
                          error instanceof Error
                            ? error.message
                            : 'Your contract could not be downloaded. Please retry.',
                        );
                      } finally {
                        setDownloadingContract(false);
                      }
                    }}
                  >
                    {downloadingContract ? 'Preparing PDF…' : 'Download your contract PDF'}
                  </button>
                  {!contractPaymentConfirmed(order) && (
                    <p role="status">The PDF becomes available after payment is confirmed.</p>
                  )}
                  {contractError && <p role="alert">{contractError}</p>}
                </details>
              )}
              {order.test ? (
                <p className="notice">Stripe test order. No real charge or eSIM is issued.</p>
              ) : order.confirmationNeedsSupport ? (
                <p className="notice" role="status">
                  Your payment is recorded. Your order needs support before we can prepare your
                  eSIM. <a href="mailto:support@alozuri.com">Contact support@alozuri.com</a> with
                  your order reference.
                </p>
              ) : order.status === 'paid' && !ready ? (
                <p role="status">
                  Preparing your eSIM. This private page updates when installation details are
                  ready. Your order confirmation email includes a link back here and your purchase
                  contract.
                </p>
              ) : null}
            </div>
            {order.allocations.map((a) => (
              <article className="surface stack" key={a.id}>
                <h2>{a.plan.name}</h2>
                <p>Status: {a.status.replaceAll('_', ' ')}</p>
                {a.status === 'ready' && !order.test ? (
                  <>
                    <EsimUsagePanel purchaseId={id} unitId={a.id} accessToken={access} />
                    <InstallationDetails orderId={a.id} purchaseId={id} accessToken={access} />
                  </>
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
type PurchaseView = 'esims' | 'usage' | 'orders';
export function PurchaseHistory({ view = 'esims' }: { view?: PurchaseView }) {
  const { user } = useAuth();
  return <AccountPurchases key={(user?.uid ?? 'guest') + view} view={view} />;
}
function AccountPurchases({ view }: { view: PurchaseView }) {
  const { user, loading } = useAuth();
  const uid = user?.uid,
    verified = user?.emailVerified;
  const [orders, setOrders] = useState<Purchase[] | null>(null),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!uid || !verified) return;
    let active = true;
    setError('');
    void api<{ orders: Purchase[] }>('/v2/orders', {}, uid)
      .then((r) => {
        if (active) setOrders(r.orders);
      })
      .catch(() => {
        if (active) setError('Your purchases could not be loaded. Try again later.');
      });
    return () => {
      active = false;
    };
  }, [uid, verified, refresh]);
  return (
    <section className="container section">
      <div className="page-intro">
        <span className="eyebrow">YOUR ALOZURI</span>
        <h1>{view === 'usage' ? 'Data usage' : view === 'orders' ? 'Orders' : 'My eSIMs'}</h1>
        <p>
          {view === 'usage'
            ? 'Check the data usage for each of your delivered eSIMs.'
            : 'Your purchases and installation details, in one place.'}
        </p>
      </div>
      <AccountNavigation active={view} />
      {loading ? (
        <p role="status">Checking your account…</p>
      ) : !user?.emailVerified ? (
        <div className="surface">
          <p>
            Sign in with your verified delivery email to find your purchases. Guest customers can
            also use the private link in their delivery email.
          </p>
          <Link
            className="button primary"
            href={'/login?next=' + encodeURIComponent('/account/' + view)}
          >
            Sign in
          </Link>
        </div>
      ) : error ? (
        <div className="surface stack">
          <p role="alert">{error}</p>
          <button className="button" onClick={() => setRefresh((value) => value + 1)}>
            Retry loading {view === 'usage' ? 'eSIMs' : 'purchases'}
          </button>
        </div>
      ) : orders === null ? (
        <p role="status">Loading purchases…</p>
      ) : !orders.length ? (
        <div className="surface">
          <h2>No purchases yet</h2>
          <Link href="/destinations">Explore destinations →</Link>
        </div>
      ) : view === 'usage' ? (
        <AccountUsage orders={orders} />
      ) : (
        <div className="stack">
          {orders.map((order) => (
            <article className="surface purchase-card" key={order.id}>
              <h2>{order.items.map((i) => i.plan.name).join(', ')}</h2>
              <p>
                {new Date(order.createdAt).toLocaleDateString('en-GB')} ·{' '}
                {money(order.totalCents, order.currency)} · {order.test ? 'Test order · ' : ''}
                {order.status.replaceAll('_', ' ')}
              </p>
              <div className="purchase-actions">
                <Link className="button" href={'/checkout/success?order=' + order.id}>
                  View order and installation
                </Link>
              </div>
              {view === 'orders' ? null : order.test ? (
                <p className="fine-print">Test order. No eSIM usage is available.</p>
              ) : (
                (order.allocations ?? []).map((unit) => (
                  <section className="surface stack" key={unit.id}>
                    <h3>{unit.plan.name}</h3>
                    {unit.status === 'ready' ? (
                      <>
                        <EsimUsagePanel purchaseId={order.id} unitId={unit.id} />
                        {view === 'esims' && (
                          <InstallationDetails purchaseId={order.id} orderId={unit.id} />
                        )}
                      </>
                    ) : (
                      <p>
                        eSIM status: {unit.status.replaceAll('_', ' ')}. Usage will be available
                        after delivery.
                      </p>
                    )}
                  </section>
                ))
              )}
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

function AccountUsage({ orders }: { orders: Purchase[] }) {
  const units = orders
    .filter((order) => !order.test)
    .flatMap((order) => (order.allocations ?? []).map((unit) => ({ order, unit })));
  return units.length ? (
    <div className="stack">
      {units.map(({ order, unit }) => (
        <article className="surface usage-card" key={unit.id}>
          <h2>{unit.plan.name}</h2>
          <p>
            {dataLabel(unit.plan)} · {unit.plan.days} days · {unit.plan.countries.length}{' '}
            {unit.plan.countries.length === 1 ? 'country' : 'countries'}
          </p>
          {unit.status === 'ready' && order.status === 'paid' ? (
            <EsimUsagePanel purchaseId={order.id} unitId={unit.id} />
          ) : (
            <p role="status">
              {['refunded', 'refund_pending', 'cancelled'].includes(order.status) ||
              ['refunded', 'refund_pending', 'cancelled'].includes(unit.status)
                ? 'Usage is unavailable for this cancelled or refunded eSIM.'
                : unit.status === 'provision_error' || order.status === 'attention'
                  ? 'This eSIM needs support before usage can be shown.'
                  : 'Your eSIM is being prepared. Usage becomes available after delivery.'}
            </p>
          )}
          <div className="purchase-actions">
            <Link className="button" href={'/checkout/success?order=' + order.id}>
              View order and installation
            </Link>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <div className="surface">
      <h2>No eSIMs available for usage yet</h2>
      <p>
        {orders.some((order) => !order.test && order.status === 'paid')
          ? 'Your paid order is being prepared. Your eSIM will appear here after it is allocated.'
          : 'Usage is available for delivered eSIMs. Test orders do not contain a live eSIM.'}
      </p>
      <Link className="button" href="/account/orders">
        View orders
      </Link>
    </div>
  );
}
