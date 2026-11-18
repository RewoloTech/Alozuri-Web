'use client';
import { useTranslations } from 'next-intl';
import { usePlanCopy } from '@/lib/use-plan-copy';
import { StoreApiError } from '@/lib/api-error';
import { ERROR_MESSAGES, type ErrorCode } from '@alozuri/shared/i18n/errors';
import type { Messages } from '@alozuri/shared/i18n/messages';
import Link from '@/components/localized-link';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { ShoppingBag, Trash2, Minus, Plus, LockKeyhole } from 'lucide-react';
import { cartItems, previewCartPrices, money, type CartLine, type Currency } from '@alozuri/shared';
import { quantityChanged, removeFromCart, restoreCart, type RootState } from '@/lib/store';
import { api } from '@/lib/api';
import { authClient } from '@/lib/firebase';
import { useCurrency } from './currency-provider';
import { useAuth } from './auth-provider';
import { PromotionPrice } from './promotion-price';
export type Quote = {
  originalRetailCents?: number;
  discountCents?: number;
  promotion?: { code: string; discountPercent: number; discount?: { kind: string; value: number } };
  items: CartLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: Currency;
};
export function LineDescription({ line }: { line: CartLine }) {
  const t = useTranslations('cart');
  const plans = useTranslations('plans');
  const copy = usePlanCopy();
  return (
    <>
      <h3>{copy.title(line.plan)}</h3>
      <p>
        {copy.allowance(line.plan)} · {plans('days', { count: line.plan.days })} ·{' '}
        {copy.coverage(line.plan)}
      </p>
      <p>{t('activation', { rule: copy.activation(line.plan.activation) })}</p>
      <p>{copy.fairUse(line.plan.fairUse)}</p>
      <details>
        <summary>{copy.coverage(line.plan)}</summary>
        <p>{line.plan.countries.map(copy.country).join(', ')}</p>
      </details>
    </>
  );
}
export function OrderSummary({
  lines,
  total,
  children,
  currency = lines[0]?.plan.currency ?? 'USD',
  updating = false,
  compact = false,
  showPlanDetails = false,
}: {
  lines: CartLine[];
  total: number | null;
  currency?: Currency;
  updating?: boolean;
  compact?: boolean;
  showPlanDetails?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTranslations('cart');
  const plans = useTranslations('plans');
  const search = useTranslations('search');
  const copy = usePlanCopy();
  return (
    <aside
      className={`surface commerce-summary${compact ? ' compact-summary' : ''}${showPlanDetails ? ' checkout-summary' : ''}`}
      aria-busy={updating}
      dir={copy.dir}
    >
      <span className="eyebrow">{t('orderTitle')}</span>
      {lines.map((line) => (
        <div className="summary-line" dir="ltr" key={line.plan.id}>
          <div dir={copy.dir}>
            <strong>{copy.title(line.plan)}</strong>
            <p>
              {t('summaryLine', {
                allowance: copy.allowance(line.plan),
                validity: plans('days', { count: line.plan.days }),
                quantity: line.quantity,
              })}
            </p>
            {showPlanDetails && (
              <>
                <small>{search('dataOnly')}</small>
                <details className="checkout-plan-details">
                  <summary>{t('details')}</summary>
                  <p>{t('activation', { rule: copy.activation(line.plan.activation) })}</p>
                  <p>{copy.fairUse(line.plan.fairUse)}</p>
                  <p>
                    {t('coverage', { countries: line.plan.countries.map(copy.country).join(', ') })}
                  </p>
                  {line.plan.networks.length > 0 && (
                    <p>{t('networks', { networks: line.plan.networks.join(', ') })}</p>
                  )}
                  {line.plan.supplierNotes && <p>{copy.notes(line.plan.supplierNotes)}</p>}
                </details>
              </>
            )}
          </div>
          <strong dir="ltr">
            {line.plan.currency === currency ? (
              <PromotionPrice
                amount={line.plan.priceCents * line.quantity}
                currency={line.plan.currency}
                promotion={
                  line.plan.promotionPrice
                    ? {
                        ...line.plan.promotionPrice,
                        originalPriceCents:
                          line.plan.promotionPrice.originalPriceCents * line.quantity,
                      }
                    : undefined
                }
              />
            ) : (
              '—'
            )}
          </strong>
        </div>
      ))}
      {(!compact || !showPlanDetails || lines.length > 1) && (
        <dl className="spec-list" dir="ltr">
          <div>
            <dt dir={copy.dir}>{t('subtotal')}</dt>
            <dd dir="ltr">{total === null ? '—' : money(total, currency)}</dd>
          </div>
        </dl>
      )}
      <div className="commerce-total" dir="ltr">
        <strong dir={copy.dir}>{t('total', { currency: copy.isolate(currency) })}</strong>
        <strong dir="ltr">{total === null ? '—' : money(total, currency)}</strong>
      </div>
      {!compact && <p className="fine-print">{t('priceNote')}</p>}
      <p className="quote-status" role="status" aria-live="polite">
        {updating ? t('confirming') : ''}
      </p>
      {children}
      {!showPlanDetails && (
        <p className="fine-print payment-security">
          <LockKeyhole size={13} aria-hidden="true" />
          <span>{t('security')}</span>
        </p>
      )}
    </aside>
  );
}
type CartFailure = { key: keyof Messages['cart'] } | { code: ErrorCode };
export function Cart() {
  const t = useTranslations('cart');
  const errors = useTranslations('errors');
  const copy = usePlanCopy();
  const { currency, refresh, ready: currencyReady } = useCurrency();
  const { user } = useAuth();
  async function restoreSavedCart() {
    try {
      if (!user?.emailVerified) return;
      const result = await api<{ items: CartLine[]; version: number }>('/v2/cart', {}, user.uid);
      if (authClient().currentUser?.uid !== user.uid) return;
      // This explicit choice replaces local edits with the saved account cart.
      // Do not replay a frozen guest intent against that account snapshot on reload.
      localStorage.removeItem('alozuri-cart-merge');
      localStorage.removeItem('alozuri-cart-merge-intent');
      localStorage.setItem('alozuri-cart-owner', user.uid);
      localStorage.setItem('alozuri-cart', JSON.stringify(result.items));
      if (user) localStorage.removeItem('alozuri-cart-pending-' + user.uid);
      window.location.reload();
    } catch {
      setError({ key: 'savedError' });
    }
  }
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cart = useSelector((s: RootState) => s.cart),
    dispatch = useDispatch(),
    store = useStore<RootState>();
  const [quote, setQuote] = useState<Quote | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState<CartFailure | null>(null),
    [quoteAttempt, setQuoteAttempt] = useState(0),
    [quotedSignature, setQuotedSignature] = useState('');
  const signature = JSON.stringify(cartItems(cart.items));
  useEffect(() => {
    if (!currencyReady || !cart.ready || signature === '[]') {
      setQuote(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setPending(true);
    setError(null);
    const timer = setTimeout(() => {
      void api<{ quote: Quote }>('/v2/quote', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({ items: JSON.parse(signature), currency }),
      })
        .then((r) => {
          if (active && JSON.stringify(cartItems(store.getState().cart.items)) === signature) {
            setQuote(r.quote);
            setQuotedSignature(signature);
            dispatch(restoreCart(r.quote.items));
          }
        })
        .catch((e) => {
          if (active) {
            setQuotedSignature('');
            setError(e instanceof StoreApiError ? { code: e.code } : { key: 'validationError' });
          }
        })
        .finally(() => {
          if (active) setPending(false);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [signature, cart.ready, dispatch, currency, refresh, quoteAttempt, store, currencyReady]);
  if (!currencyReady || !mounted || !cart.ready)
    return (
      <section className="container section" role="status">
        {t('loading')}
      </section>
    );
  if (!cart.items.length)
    return (
      <section className="container section empty-cart">
        <ShoppingBag size={48} />
        <h1>{t('emptyTitle')}</h1>
        <p>{t('emptyText')}</p>
        {cart.error && (
          <div role="alert">
            <p className="error-message">{t('syncError')}</p>
            {user?.emailVerified && (
              <button className="button" onClick={() => void restoreSavedCart()}>
                {t('useSaved')}
              </button>
            )}
          </div>
        )}
        <Link className="button primary" href="/destinations">
          {t('explore')}
        </Link>
      </section>
    );
  const priceReady =
    quote?.currency === currency && quotedSignature === signature && !pending && !error;
  const preview = previewCartPrices(
    cart.items,
    quote?.currency === currency ? quote.items : [],
    currency,
  );
  const displayedItems = preview.items;
  const total = priceReady ? quote.totalCents : preview.total;
  // Checkout independently verifies the total before it can create a payment.
  const checkoutBlocked =
    cart.syncing || cart.syncFailed || displayedItems.some((line) => line.unavailable);
  return (
    <section className="container section">
      <div className="page-intro">
        <span className="eyebrow">{t('eyebrow')}</span>
        <h1>{t('title')}</h1>
        <p>{t('intro', { count: cart.items.reduce((sum, i) => sum + i.quantity, 0), currency })}</p>
      </div>
      <div className="commerce-layout" dir="ltr">
        <div className="stack" dir={copy.dir}>
          {displayedItems.map((line) => (
            <article className="surface cart-line" dir="ltr" key={line.plan.id}>
              <div className="cart-plan" dir={copy.dir}>
                <LineDescription line={line} />
                <p dir={copy.dir}>
                  {line.unavailable ? t('unavailablePrice') + ' ' : ''}
                  {t('unitPrice', {
                    amount: copy.isolate(
                      line.plan.currency === currency
                        ? money(line.plan.priceCents, line.plan.currency)
                        : '—',
                    ),
                  })}
                </p>
                <div
                  className="quantity-controls"
                  dir="ltr"
                  aria-label={t('quantity', { plan: line.plan.name })}
                >
                  <button
                    aria-label={t('decrease', { plan: line.plan.name })}
                    disabled={cart.syncing || line.quantity <= 1}
                    onClick={() =>
                      dispatch(quantityChanged({ id: line.plan.id, quantity: line.quantity - 1 }))
                    }
                  >
                    <Minus size={16} />
                  </button>
                  <output aria-live="polite">{line.quantity}</output>
                  <button
                    aria-label={t('increase', { plan: line.plan.name })}
                    disabled={
                      cart.syncing ||
                      line.quantity >= 5 ||
                      cart.items.reduce((n, i) => n + i.quantity, 0) >= 10
                    }
                    onClick={() =>
                      dispatch(quantityChanged({ id: line.plan.id, quantity: line.quantity + 1 }))
                    }
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div className="cart-line-end" dir={copy.dir}>
                <strong dir="ltr">
                  {line.plan.currency === currency ? (
                    <PromotionPrice
                      amount={line.plan.priceCents * line.quantity}
                      currency={line.plan.currency}
                      promotion={
                        line.plan.promotionPrice
                          ? {
                              ...line.plan.promotionPrice,
                              originalPriceCents:
                                line.plan.promotionPrice.originalPriceCents * line.quantity,
                            }
                          : undefined
                      }
                    />
                  ) : (
                    '—'
                  )}
                </strong>
                <button
                  className="text-link"
                  aria-label={t('removeLabel', { plan: line.plan.name })}
                  disabled={cart.syncing}
                  onClick={() => dispatch(removeFromCart(line.plan.id))}
                >
                  <Trash2 size={16} /> {t('remove')}
                </button>
              </div>
            </article>
          ))}
          <Link className="text-link" href="/destinations">
            {t('continueShopping')}
          </Link>
          {(error || cart.error) && (
            <div role="alert">
              <p className="error-message">
                {error
                  ? 'code' in error
                    ? errors(ERROR_MESSAGES[error.code])
                    : t(error.key)
                  : t('syncError')}
              </p>
              {error && (
                <button
                  type="button"
                  className="button"
                  disabled={pending}
                  onClick={() => setQuoteAttempt((n) => n + 1)}
                >
                  {t('retryPrices')}
                </button>
              )}
              {user?.emailVerified && cart.error && (
                <button className="button" onClick={() => void restoreSavedCart()}>
                  {t('useSaved')}
                </button>
              )}
            </div>
          )}
        </div>
        <OrderSummary
          compact
          lines={displayedItems}
          total={total}
          currency={currency}
          updating={pending}
        >
          <Link
            className="button primary full-width"
            aria-disabled={checkoutBlocked}
            href="/checkout"
            onClick={(event) => {
              if (checkoutBlocked) event.preventDefault();
            }}
          >
            {cart.syncing ? t('saving') : t('secureCheckout')}
          </Link>
          {checkoutBlocked && (
            <p className="fine-print" role="status">
              {cart.syncing
                ? t('syncPending')
                : cart.syncFailed
                  ? t('syncFailed')
                  : t('removeUnavailable')}
            </p>
          )}
        </OrderSummary>
      </div>
    </section>
  );
}
