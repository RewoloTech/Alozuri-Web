'use client';
import { BuyAgain } from './buy-again';
import { useLocale, useTranslations } from 'next-intl';
import { usePlanCopy } from '@/lib/use-plan-copy';
import { useStatusCopy } from '@/lib/use-status-copy';
import { ContractDownloadError } from '@/lib/contract-errors';
import { BUSINESS } from '@alozuri/shared/legal';
import { LinkedMessage, MESSAGE_LINKS } from './linked-message';
import { trackMeta, marketingConsentNow, onPixelReady } from '@/lib/meta-pixel';
import { confirmedMetaPurchase } from '@/lib/meta-events';
import { useMarketingConsent } from './privacy-provider';
import { AccountNavigation } from './account-navigation';
import { useEffect, useRef, useState } from 'react';
import Link from '@/components/localized-link';
import { useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { money, type CartLine, type CartItem, type Plan } from '@alozuri/shared';
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
  locale?: import('@alozuri/shared/i18n').Locale;
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
  allocations: {
    id: string;
    status: string;
    plan: Plan;
    fulfillmentMethod?: 'TOPUP';
    topupState?: string;
  }[];
};
export function PurchaseStatus() {
  const id = useSearchParams().get('order') || '',
    { user } = useAuth();
  return <PrivatePurchase key={`${id}:${user?.uid ?? 'guest'}`} id={id} />;
}
function PrivatePurchase({ id }: { id: string }) {
  const t = useTranslations('orderUi');
  const site = useTranslations('site');
  const emailCopy = useTranslations('emails');
  const payment = useTranslations('paymentUi');
  const copy = usePlanCopy();
  const status = useStatusCopy();
  const marketing = useMarketingConsent();
  const reported = useRef(new Set<string>());
  const { user } = useAuth(),
    dispatch = useDispatch(),
    cart = useSelector((s: RootState) => s.cart);
  const [order, setOrder] = useState<Purchase | null>(null),
    [access, setAccess] = useState(''),
    [error, setError] = useState(false),
    [refresh, setRefresh] = useState(0),
    [downloadingContract, setDownloadingContract] = useState(false),
    [contractError, setContractError] = useState<'pdfError' | 'pdfFontError' | ''>('');
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('access');
    if (token) {
      sessionStorage.setItem('alozuri-order-' + id, token);
    }
    // Stripe return credentials are not needed by this page. Keep only the order lookup.
    const clean = new URL(location.href);
    for (const key of ['payment_intent', 'payment_intent_client_secret', 'redirect_status'])
      clean.searchParams.delete(key);
    clean.hash = '';
    window.history.replaceState(window.history.state, '', clean.pathname + clean.search);
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
        setError(false);
        if (
          value.status !== 'cancelled' &&
          value.status !== 'refunded' &&
          (['pending_payment', 'payment_processing'].includes(value.status) ||
            !value.allocations.length ||
            (!value.test &&
              value.allocations.some(
                (a) => !['ready', 'refunded', 'provision_error'].includes(a.status),
              ))) &&
          ++attempts < 90
        )
          timer = setTimeout(() => void poll(), 4000);
      } catch {
        if (active) setError(true);
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
  useEffect(() => {
    if (!marketing || !order) return;
    const data = confirmedMetaPurchase(order);
    if (!data) return;
    void trackMeta('Purchase', data, order.id, true);
    // Wait for the consented library to establish its browser identifier before CAPI.
    return onPixelReady(() => {
      if (
        !marketingConsentNow() ||
        reported.current.has(order.id) ||
        !document.cookie.split('; ').some((cookie) => cookie.startsWith('_fbp='))
      )
        return;
      reported.current.add(order.id);
      void (async () => {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (access) headers['X-Order-Access'] = access;
          else if (user?.emailVerified)
            headers.Authorization = 'Bearer ' + (await user.getIdToken());
          if (!marketingConsentNow()) return;
          await fetch('/api/marketing/purchase', {
            method: 'POST',
            headers,
            body: JSON.stringify({ orderId: order.id }),
          });
        } catch {
          /* Advertising failure never interrupts payment or delivery. */
        }
      })();
    });
  }, [marketing, order, access, user]);
  const ready = order?.allocations.length && order.allocations.every((a) => a.status === 'ready');
  return (
    <section className="container section purchase-status-page">
      <div className="page-intro">
        <span className="eyebrow">{t('eyebrow')}</span>
        <h1>
          {order?.test
            ? t('testOrder')
            : ready
              ? t('readyTitle')
              : order?.status === 'paid'
                ? t('onWayTitle')
                : t('checkingTitle')}
        </h1>
      </div>
      {error ? (
        <div className="surface">
          <p role="alert">{t('loadError')}</p>
          <button className="button" onClick={() => setRefresh((n) => n + 1)}>
            {t('checkAgain')}
          </button>
          <Link href="/login?next=/account/esims">{t('signinPurchases')}</Link>
        </div>
      ) : !order ? (
        <p role="status">
          {!access && !user?.emailVerified ? t('privateLinkHint') : t('confirming')}
        </p>
      ) : (
        <div className="commerce-layout" dir="ltr">
          <div className="stack" dir={copy.dir}>
            <div className="surface">
              <p>
                {emailCopy('reference', { reference: copy.isolate(order.reference ?? order.id) })}
              </p>
              <p>{t('paymentStatus', { status: status.order(order.status) })}</p>
              <p>{payment('deliveryEmail', { email: copy.isolate(order.email) })}</p>
              <p>{t('total', { amount: copy.isolate(money(order.totalCents, order.currency)) })}</p>
              {order.legal && (
                <details className="order-documents">
                  <summary>{t('documents')}</summary>
                  <p>
                    {t('termsVersion', {
                      version: copy.isolate(order.legal.version),
                      date: copy.isolate(order.legal.acceptedAt),
                    })}
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
                          error instanceof ContractDownloadError &&
                            error.code === 'FONT_UNAVAILABLE'
                            ? 'pdfFontError'
                            : 'pdfError',
                        );
                      } finally {
                        setDownloadingContract(false);
                      }
                    }}
                  >
                    {downloadingContract ? t('preparingPdf') : t('downloadPdf')}
                  </button>
                  {!contractPaymentConfirmed(order) && <p role="status">{t('pdfPending')}</p>}
                  {contractError && <p role="alert">{t(contractError)}</p>}
                </details>
              )}
              {order.test ? (
                <p className="notice">{t('testNotice')}</p>
              ) : order.confirmationNeedsSupport ? (
                <p className="notice" role="status">
                  <LinkedMessage
                    message={t('supportNotice', { support: MESSAGE_LINKS.support })}
                    links={{ support: { href: 'mailto:' + BUSINESS.email, label: BUSINESS.email } }}
                  />
                </p>
              ) : order.status === 'paid' && !ready ? (
                <p role="status">{t('preparingNotice')}</p>
              ) : null}
            </div>
            {user &&
              !order.test &&
              process.env.NEXT_PUBLIC_BUY_AGAIN_ENABLED === 'true' &&
              order.allocations
                .filter((a) => a.status === 'ready')
                .map((a) => <BuyAgain key={'repeat-' + a.id} orderId={a.id} />)}
            {order.allocations.map((a) => (
              <article className="surface stack" key={a.id}>
                <h2>{copy.title(a.plan)}</h2>
                <p>{t('unitStatus', { status: status.order(a.status) })}</p>
                {a.status === 'ready' && !order.test ? (
                  <>
                    <EsimUsagePanel purchaseId={id} unitId={a.id} accessToken={access} />
                    {a.fulfillmentMethod === 'TOPUP' ? (
                      <p>
                        Top-up successful. Your existing eSIM has been recharged. No new QR code or
                        installation is needed.
                      </p>
                    ) : (
                      <InstallationDetails orderId={a.id} purchaseId={id} accessToken={access} />
                    )}
                  </>
                ) : a.status === 'provision_error' ? (
                  <p>{t('deliveryIssue')}</p>
                ) : a.status === 'refund_pending' ? (
                  <p>{t('refundNotice')}</p>
                ) : null}
              </article>
            ))}
            <button className="button" onClick={() => setRefresh((n) => n + 1)}>
              {t('refresh')}
            </button>
            <Link className="text-link" href="/help">
              {t('guidance')}
            </Link>
          </div>
          <aside className="surface stack" dir={copy.dir}>
            <h2>{t('title')}</h2>
            {order.items.map((line) => (
              <div key={line.plan.id}>
                <LineDescription line={line} />
                <p>
                  {t('quantityAmount', {
                    quantity: line.quantity,
                    amount: copy.isolate(
                      money(line.plan.priceCents * line.quantity, order.currency),
                    ),
                  })}
                </p>
              </div>
            ))}
            <Link className="button" href="/account/esims">
              {site('myEsims')}
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
  const t = useTranslations('orderUi');
  const site = useTranslations('site');
  const navigation = useTranslations('navigation');
  const auth = useTranslations('authUi');
  const cartCopy = useTranslations('cart');
  const copy = usePlanCopy();
  const status = useStatusCopy();
  const locale = useLocale();
  const { user, loading } = useAuth();
  const uid = user?.uid,
    verified = user?.emailVerified;
  const [orders, setOrders] = useState<Purchase[] | null>(null),
    [error, setError] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!uid || !verified) return;
    let active = true;
    setError(false);
    void api<{ orders: Purchase[] }>('/v2/orders', {}, uid)
      .then((r) => {
        if (active) setOrders(r.orders);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [uid, verified, refresh]);
  return (
    <section className="container section">
      <div className="page-intro">
        <span className="eyebrow">{t('accountEyebrow')}</span>
        <h1>
          {view === 'usage' ? site('usage') : view === 'orders' ? site('orders') : site('myEsims')}
        </h1>
        <p>{view === 'usage' ? t('usageHint') : t('historyHint')}</p>
      </div>
      <AccountNavigation active={view} />
      {loading ? (
        <p role="status">{auth('checkingAccess')}</p>
      ) : !user?.emailVerified ? (
        <div className="surface">
          <p>{t('loginHint')}</p>
          <Link
            className="button primary"
            href={'/login?next=' + encodeURIComponent('/account/' + view)}
          >
            {navigation('login')}
          </Link>
        </div>
      ) : error ? (
        <div className="surface stack">
          <p role="alert">{t('purchasesError')}</p>
          <button className="button" onClick={() => setRefresh((value) => value + 1)}>
            {t('retryPurchases')}
          </button>
        </div>
      ) : orders === null ? (
        <p role="status">{t('loadingPurchases')}</p>
      ) : !orders.length ? (
        <div className="surface">
          <h2>{t('empty')}</h2>
          <Link href="/destinations">{cartCopy('explore')}</Link>
        </div>
      ) : view === 'usage' ? (
        <AccountUsage orders={orders} />
      ) : (
        <div className="stack" dir={copy.dir}>
          {orders.map((order) => (
            <article className="surface purchase-card" key={order.id}>
              <h2>{order.items.map((i) => copy.title(i.plan)).join(', ')}</h2>
              <p>
                {new Date(order.createdAt).toLocaleDateString(locale === 'en' ? 'en-GB' : locale)} ·{' '}
                {money(order.totalCents, order.currency)} ·{' '}
                {order.test ? t('testOrder') + ' · ' : ''}
                {status.order(order.status)}
              </p>
              <div className="purchase-actions">
                <Link className="button" href={'/checkout/success?order=' + order.id}>
                  {t('viewOrder')}
                </Link>
              </div>
              {process.env.NEXT_PUBLIC_BUY_AGAIN_ENABLED === 'true' &&
                !order.test &&
                (order.allocations ?? [])
                  .filter((unit) => unit.status === 'ready')
                  .map((unit) => <BuyAgain key={'again-' + unit.id} orderId={unit.id} />)}
              {view === 'orders' ? null : order.test ? (
                <p className="fine-print">{t('testNoUsage')}</p>
              ) : (
                (order.allocations ?? []).map((unit) => (
                  <section className="surface stack" key={unit.id}>
                    <h3>{copy.title(unit.plan)}</h3>
                    {unit.status === 'ready' ? (
                      <>
                        <EsimUsagePanel purchaseId={order.id} unitId={unit.id} />
                        {view === 'esims' && unit.fulfillmentMethod !== 'TOPUP' && (
                          <InstallationDetails purchaseId={order.id} orderId={unit.id} />
                        )}
                      </>
                    ) : (
                      <p>{t('unitWaiting', { status: status.order(unit.status) })}</p>
                    )}
                  </section>
                ))
              )}
            </article>
          ))}
        </div>
      )}
      <p>
        <Link href="/dashboard">{t('earlierAccount')}</Link>
      </p>
    </section>
  );
}

function AccountUsage({ orders }: { orders: Purchase[] }) {
  const t = useTranslations('orderUi');
  const plans = useTranslations('plans');
  const copy = usePlanCopy();
  const units = orders
    .filter((order) => !order.test)
    .flatMap((order) => (order.allocations ?? []).map((unit) => ({ order, unit })));
  return units.length ? (
    <div className="stack" dir={copy.dir}>
      {units.map(({ order, unit }) => (
        <article className="surface usage-card" key={unit.id}>
          <h2>{copy.title(unit.plan)}</h2>
          <p>
            {copy.allowance(unit.plan)} · {plans('days', { count: unit.plan.days })} ·{' '}
            {copy.coverage(unit.plan)}
          </p>
          {unit.status === 'ready' && order.status === 'paid' ? (
            <EsimUsagePanel purchaseId={order.id} unitId={unit.id} />
          ) : (
            <p role="status">
              {['refunded', 'refund_pending', 'cancelled'].includes(order.status) ||
              ['refunded', 'refund_pending', 'cancelled'].includes(unit.status)
                ? t('cancelledUsage')
                : unit.status === 'provision_error' || order.status === 'attention'
                  ? t('supportUsage')
                  : t('preparingUsage')}
            </p>
          )}
          <div className="purchase-actions">
            <Link className="button" href={'/checkout/success?order=' + order.id}>
              {t('viewOrder')}
            </Link>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <div className="surface">
      <h2>{t('emptyUsage')}</h2>
      <p>
        {orders.some((order) => !order.test && order.status === 'paid')
          ? t('paidAllocating')
          : t('liveUsageOnly')}
      </p>
      <Link className="button" href="/account/orders">
        {t('viewOrders')}
      </Link>
    </div>
  );
}
