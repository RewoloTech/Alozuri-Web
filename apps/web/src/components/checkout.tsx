'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';
import type { StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';
import { cartItems, type CartLine, type Plan } from '@voyaspan/shared';
import type { RootState } from '@/lib/store';
import { api } from '@/lib/api';
import { useAuth } from './auth-provider';
import { OrderSummary, type Quote } from './cart';
import { stripeCheckoutMode } from './stripe-checkout';
const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
let stripePromise: ReturnType<typeof loadStripe> | undefined;
function StripePayment({
  clientSecret,
  orderId,
  deliveryEmail,
}: {
  clientSecret: string;
  orderId: string;
  deliveryEmail: string;
}) {
  const stripe = useStripe(),
    elements = useElements(),
    router = useRouter();
  const [processing, setProcessing] = useState(false),
    [error, setError] = useState(''),
    [wallets, setWallets] = useState(true),
    [ready, setReady] = useState(false);
  const submitted = useRef(false);
  async function pay(event?: StripeExpressCheckoutElementConfirmEvent) {
    if (!stripe || !elements || submitted.current) {
      event?.paymentFailed({ reason: 'fail' });
      return;
    }
    submitted.current = true;
    setProcessing(true);
    setError('');
    try {
      const validation = await elements.submit();
      if (validation.error)
        throw new Error(validation.error.message || 'Check your payment details.');
      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: new URL('/checkout/success?order=' + orderId, window.location.origin).href,
        },
        redirect: 'if_required',
      });
      if (result.error) throw new Error(result.error.message || 'Payment could not be completed.');
      if (
        result.paymentIntent?.status === 'succeeded' ||
        result.paymentIntent?.status === 'processing'
      ) {
        router.replace('/checkout/success?order=' + orderId);
        return;
      }
      throw new Error('Payment needs further action. Please try again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not be completed.');
      event?.paymentFailed({ reason: 'fail' });
      submitted.current = false;
      setProcessing(false);
    }
  }
  return (
    <div className="stack">
      <div style={{ display: wallets ? 'block' : 'none' }}>
        <ExpressCheckoutElement
          options={{
            paymentMethods: { applePay: 'auto', googlePay: 'auto' },
            layout: { maxColumns: 2, maxRows: 2 },
          }}
          onReady={(e) =>
            setWallets(
              Boolean(
                e.availablePaymentMethods && Object.values(e.availablePaymentMethods).some(Boolean),
              ),
            )
          }
          onConfirm={(e) => void pay(e)}
          onLoadError={() => setWallets(false)}
        />
        {wallets && <p className="payment-divider">or pay by card</p>}
      </div>
      <PaymentElement
        onReady={() => setReady(true)}
        onLoadError={() =>
          setError('The payment form could not load. Refresh the page and try again.')
        }
        options={{
          layout: 'tabs',
          business: { name: 'Alozuri' },
          defaultValues: { billingDetails: { email: deliveryEmail } },
          wallets: { applePay: 'never', googlePay: 'never' },
        }}
      />
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <button
        className="button primary full-width"
        disabled={!stripe || !elements || !ready || processing}
        onClick={() => void pay()}
      >
        {processing ? 'Processing payment…' : 'Pay securely'}
      </button>
    </div>
  );
}
export function Checkout() {
  const { user } = useAuth();
  return <CheckoutForIdentity key={user?.uid ?? 'guest'} />;
}
function CheckoutForIdentity() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cart = useSelector((s: RootState) => s.cart),
    { user } = useAuth(),
    params = useSearchParams();
  const buy = params.get('buy');
  const [buyPlan, setBuyPlan] = useState<Plan | null>(null),
    [quote, setQuote] = useState<Quote | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [starting, setStarting] = useState(false),
    [email, setEmail] = useState(user?.emailVerified ? user.email || '' : ''),
    [confirmation, setConfirmation] = useState(''),
    [compatible, setCompatible] = useState(false),
    [session, setSession] = useState<{ clientSecret: string; orderId: string } | null>(null),
    [mode, setMode] = useState('disabled');
  const request = useRef(crypto.randomUUID()),
    submitting = useRef(false);
  useEffect(() => {
    if (user?.emailVerified && user.email) setEmail(user.email);
  }, [user]);
  useEffect(() => {
    void api<{ cartCheckoutMode: string }>('/v1/config')
      .then((r) => setMode(r.cartCheckoutMode))
      .catch(() => setMode('disabled'));
  }, []);
  useEffect(() => {
    if (!buy) return;
    let active = true;
    void api<{ plan: Plan }>('/v1/packages/' + encodeURIComponent(buy))
      .then((r) => {
        if (active) setBuyPlan(r.plan);
      })
      .catch(() => setError('This plan is unavailable. Return to your cart.'));
    return () => {
      active = false;
    };
  }, [buy]);
  const lines: CartLine[] = useMemo(
    () => (buy ? (buyPlan ? [{ plan: buyPlan, quantity: 1 }] : []) : cart.items),
    [buy, buyPlan, cart.items],
  );
  const signature = JSON.stringify(cartItems(lines));
  useEffect(() => {
    setSession(null);
    request.current = crypto.randomUUID();
    if (signature === '[]') {
      setQuote(null);
      return;
    }
    let active = true;
    setQuote(null);
    setLoading(true);
    setError('');
    void api<{ quote: Quote }>('/v2/quote', {
      method: 'POST',
      body: JSON.stringify({ items: JSON.parse(signature), currency: 'USD' }),
    })
      .then((r) => {
        if (active) setQuote(r.quote);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not check prices.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [signature]);
  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || !quote) return;
    if (email.trim().toLowerCase() !== confirmation.trim().toLowerCase()) {
      setError('Email addresses do not match.');
      return;
    }
    submitting.current = true;
    setStarting(true);
    setError('');
    try {
      const fingerprint = JSON.stringify({
        items: JSON.parse(signature),
        email: email.trim().toLowerCase(),
        total: quote.totalCents,
        owner: user?.uid ?? 'guest',
      });
      try {
        const previous = JSON.parse(sessionStorage.getItem('alozuri-checkout-attempt') || 'null');
        if (previous?.fingerprint === fingerprint && typeof previous.requestId === 'string')
          request.current = previous.requestId;
        sessionStorage.setItem(
          'alozuri-checkout-attempt',
          JSON.stringify({ fingerprint, requestId: request.current }),
        );
      } catch {
        /* In-memory idempotency remains active if browser storage is unavailable. */
      }
      const result = await api<{
        clientSecret: string;
        orderId: string;
        accessToken: string;
        quote: Quote;
      }>(
        '/v2/checkout',
        {
          method: 'POST',
          body: JSON.stringify({
            items: JSON.parse(signature),
            currency: 'USD',
            email: email.trim(),
            emailConfirmation: confirmation.trim(),
            compatible,
            requestId: request.current,
            expectedTotalCents: quote.totalCents,
          }),
        },
        Boolean(user?.emailVerified),
      );
      sessionStorage.setItem('alozuri-order-' + result.orderId, result.accessToken);
      try {
        const attempt = JSON.parse(sessionStorage.getItem('alozuri-checkout-attempt') || '{}');
        sessionStorage.setItem(
          'alozuri-checkout-attempt',
          JSON.stringify({ ...attempt, orderId: result.orderId }),
        );
      } catch {}
      sessionStorage.setItem(
        'alozuri-purchased-' + result.orderId,
        JSON.stringify(buy ? [] : cartItems(lines)),
      );
      setQuote(result.quote);
      stripePromise ??= loadStripe(key).catch(() => {
        stripePromise = undefined;
        return null;
      });
      if (!(await stripePromise)) {
        stripePromise = undefined;
        throw new Error('Stripe could not load. Check your connection and try again.');
      }
      setSession(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout could not start.');
      if (e instanceof Error && /price changed|Checkout changed/i.test(e.message)) {
        request.current = crypto.randomUUID();
        const fresh = await api<{ quote: Quote }>('/v2/quote', {
          method: 'POST',
          body: JSON.stringify({ items: JSON.parse(signature), currency: 'USD' }),
        }).catch(() => null);
        if (fresh) setQuote(fresh.quote);
      }
    } finally {
      submitting.current = false;
      setStarting(false);
    }
  }
  if (!mounted || !cart.ready)
    return (
      <section className="container section" role="status">
        Loading checkout…
      </section>
    );
  if (!lines.length)
    return (
      <section className="container section">
        <h1>{buy ? 'Loading your plan…' : 'Your cart is empty'}</h1>
        {error && <p role="alert">{error}</p>}
        <Link className="button primary" href="/destinations">
          Explore destinations
        </Link>
      </section>
    );
  return (
    <section className="container section">
      <Link className="text-link" href="/cart">
        ← Edit cart
      </Link>
      <div className="page-intro">
        <span className="eyebrow">A LITTLE LESS ROAMING</span>
        <h1>Checkout</h1>
        <p>No account needed. Your next connection starts here.</p>
      </div>
      <div className="commerce-layout">
        <div className="surface stack">
          {session ? (
            <>
              <h2>Secure payment</h2>
              <p>Delivery email: {email}</p>
              {mode === 'test' && (
                <p className="notice">Test payment. No real money or eSIM will be issued.</p>
              )}
              <Elements
                stripe={stripePromise!}
                options={{
                  clientSecret: session.clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#5145cd',
                      borderRadius: '12px',
                      fontFamily: 'Arial, sans-serif',
                    },
                  },
                }}
              >
                <StripePayment
                  clientSecret={session.clientSecret}
                  orderId={session.orderId}
                  deliveryEmail={email}
                />
              </Elements>
            </>
          ) : (
            <form className="stack" onSubmit={start}>
              <h2>Contact information</h2>
              <p>
                Your private installation link will be sent to this email when your eSIM is ready.
              </p>
              <label>
                Email address
                <input
                  className="commerce-input"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Confirm email address
                <input
                  className="commerce-input"
                  type="email"
                  required
                  autoComplete="off"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
              <h2>Review your order</h2>
              <p>The order summary shows your plans and final total in USD.</p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  required
                  checked={compatible}
                  onChange={(e) => setCompatible(e.target.checked)}
                />
                <span>
                  My device supports eSIM and is carrier unlocked.{' '}
                  <Link href="/help#compatibility">Check compatibility</Link>
                </span>
              </label>
              {mode === 'disabled' || mode !== stripeCheckoutMode ? (
                <p className="notice" role="status">
                  Payments are not currently configured for this storefront. Your cart is saved.
                </p>
              ) : null}
              <button
                className="button primary full-width"
                disabled={
                  starting ||
                  loading ||
                  !quote ||
                  !compatible ||
                  mode === 'disabled' ||
                  mode !== stripeCheckoutMode
                }
              >
                {starting ? 'Preparing secure payment…' : 'Continue to payment'}
              </button>
            </form>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          {loading && <p role="status">Checking availability and prices…</p>}
        </div>
        <OrderSummary
          lines={quote?.items ?? lines}
          total={quote?.totalCents ?? lines.reduce((n, i) => n + i.quantity * i.plan.priceCents, 0)}
        />
      </div>
    </section>
  );
}
