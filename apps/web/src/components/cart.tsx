'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ShoppingBag, Trash2, Minus, Plus, LockKeyhole } from 'lucide-react';
import {
  cartItems,
  coverageLabel,
  countryName,
  dataLabel,
  money,
  type CartLine,
  type Currency,
} from '@voyaspan/shared';
import { quantityChanged, removeFromCart, restoreCart, type RootState } from '@/lib/store';
import { api } from '@/lib/api';
import { useCurrency } from './currency-provider';
import { useAuth } from './auth-provider';
export type Quote = {
  items: CartLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: Currency;
};
export function LineDescription({ line }: { line: CartLine }) {
  return (
    <>
      <h3>{line.plan.name}</h3>
      <p>
        {dataLabel(line.plan)} · {line.plan.days} days · {coverageLabel(line.plan)}
      </p>
      <p>Activation: {line.plan.activation}</p>
      <details>
        <summary>
          Coverage: {line.plan.countries.length}{' '}
          {line.plan.countries.length === 1 ? 'destination' : 'destinations'}
        </summary>
        <p>{line.plan.countries.map(countryName).join(', ')}</p>
      </details>
    </>
  );
}
export function OrderSummary({
  lines,
  total,
  children,
  currency = lines[0]?.plan.currency ?? 'USD',
}: {
  lines: CartLine[];
  total: number;
  currency?: Currency;
  children?: React.ReactNode;
}) {
  return (
    <aside className="surface commerce-summary">
      <span className="eyebrow">YOUR ORDER</span>
      {lines.map((line) => (
        <div className="summary-line" key={line.plan.id}>
          <div>
            <strong>{line.plan.name}</strong>
            <p>
              {dataLabel(line.plan)} · {line.plan.days} days · Qty {line.quantity}
            </p>
            <p>Activation: {line.plan.activation}</p>
            <p>{line.plan.fairUse}</p>
            <small>
              Coverage: {line.plan.countries.length}{' '}
              {line.plan.countries.length === 1 ? 'destination' : 'destinations'}
            </small>
          </div>
          <strong>
            {line.plan.currency === currency
              ? money(line.plan.priceCents * line.quantity, line.plan.currency)
              : 'Updating price…'}
          </strong>
        </div>
      ))}
      <dl className="spec-list">
        <div>
          <dt>Subtotal</dt>
          <dd>{money(total, currency)}</dd>
        </div>
      </dl>
      <div className="commerce-total">
        <strong>Total · {currency}</strong>
        <strong>{money(total, currency)}</strong>
      </div>
      <p className="fine-print">
        The displayed total is the amount charged. No additional checkout fees.
      </p>
      {children}
      <p className="fine-print">
        <LockKeyhole size={13} /> Payment details are handled securely by Stripe.
      </p>
    </aside>
  );
}
export function Cart() {
  const { currency, refresh } = useCurrency();
  const { user } = useAuth();
  async function restoreSavedCart() {
    try {
      const result = await api<{ items: CartLine[]; version: number }>('/v2/cart', {}, true);
      localStorage.setItem('alozuri-cart', JSON.stringify(result.items));
      if (user) localStorage.removeItem('alozuri-cart-pending-' + user.uid);
      window.location.reload();
    } catch {
      setError('The saved cart could not be loaded. Please try again.');
    }
  }
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cart = useSelector((s: RootState) => s.cart),
    dispatch = useDispatch();
  const [quote, setQuote] = useState<Quote | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const signature = JSON.stringify(cartItems(cart.items));
  useEffect(() => {
    if (!cart.ready || signature === '[]') {
      setQuote(null);
      return;
    }
    let active = true;
    setQuote(null);
    setPending(true);
    setError('');
    void api<{ quote: Quote }>('/v2/quote', {
      method: 'POST',
      body: JSON.stringify({ items: JSON.parse(signature), currency }),
    })
      .then((r) => {
        if (active) {
          setQuote(r.quote);
          dispatch(restoreCart(r.quote.items));
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not validate cart.');
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [signature, cart.ready, dispatch, currency, refresh]);
  if (!mounted || !cart.ready)
    return (
      <section className="container section" role="status">
        Loading your cart…
      </section>
    );
  if (!cart.items.length)
    return (
      <section className="container section empty-cart">
        <ShoppingBag size={48} />
        <h1>Your cart is empty</h1>
        <p>Explore eSIM plans for your next destination.</p>
        {cart.error && (
          <div role="alert">
            <p className="error-message">{cart.error}</p>
            {user?.emailVerified && (
              <button className="button" onClick={() => void restoreSavedCart()}>
                Use saved account cart
              </button>
            )}
          </div>
        )}
        <Link className="button primary" href="/destinations">
          Explore destinations
        </Link>
      </section>
    );
  const priceReady = quote?.currency === currency;
  // Account cart snapshots remain base USD; the verified quote owns displayed prices.
  const displayedItems = cart.items.map((line) => ({
    ...line,
    plan: priceReady
      ? (quote.items.find((item) => item.plan.id === line.plan.id)?.plan ?? line.plan)
      : line.plan,
  }));
  const total =
    quote?.totalCents ?? cart.items.reduce((sum, i) => sum + i.quantity * i.plan.priceCents, 0);
  return (
    <section className="container section">
      <div className="page-intro">
        <span className="eyebrow">READY FOR YOUR NEXT TRIP</span>
        <h1>Your cart</h1>
        <p>
          {cart.items.reduce((sum, i) => sum + i.quantity, 0)} eSIMs · Prices in {currency}
        </p>
      </div>
      <div className="commerce-layout">
        <div className="stack">
          {displayedItems.map((line) => (
            <article className="surface cart-line" key={line.plan.id}>
              <div className="cart-plan">
                <LineDescription line={line} />
                <p>
                  {line.unavailable ? 'Unavailable · last seen price: ' : ''}
                  {priceReady
                    ? money(line.plan.priceCents, line.plan.currency)
                    : 'Updating price…'}{' '}
                  per eSIM
                </p>
                <div className="quantity-controls" aria-label={'Quantity for ' + line.plan.name}>
                  <button
                    aria-label={'Decrease quantity for ' + line.plan.name}
                    disabled={cart.syncing || line.quantity <= 1}
                    onClick={() =>
                      dispatch(quantityChanged({ id: line.plan.id, quantity: line.quantity - 1 }))
                    }
                  >
                    <Minus size={16} />
                  </button>
                  <output aria-live="polite">{line.quantity}</output>
                  <button
                    aria-label={'Increase quantity for ' + line.plan.name}
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
              <div className="cart-line-end">
                <strong>
                  {line.plan.currency === currency
                    ? money(line.plan.priceCents * line.quantity, line.plan.currency)
                    : 'Updating price…'}
                </strong>
                <button
                  className="text-link"
                  aria-label={'Remove ' + line.plan.name}
                  disabled={cart.syncing}
                  onClick={() => dispatch(removeFromCart(line.plan.id))}
                >
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            </article>
          ))}
          <Link className="text-link" href="/destinations">
            ← Continue shopping
          </Link>
          {(error || cart.error) && (
            <div role="alert">
              <p className="error-message">{error || cart.error}</p>
              {user?.emailVerified && cart.error && (
                <button className="button" onClick={() => void restoreSavedCart()}>
                  Use saved account cart
                </button>
              )}
            </div>
          )}
        </div>
        {quote?.currency === currency ? (
          <OrderSummary lines={quote?.items ?? cart.items} total={total}>
            {pending ? (
              <p role="status">Checking current availability and prices…</p>
            ) : (
              <Link
                className="button primary full-width"
                aria-disabled={!quote || !!error}
                href={quote && !error ? '/checkout' : '#'}
              >
                Secure checkout →
              </Link>
            )}
          </OrderSummary>
        ) : (
          <p role="status">Updating prices in {currency}…</p>
        )}
      </div>
    </section>
  );
}
