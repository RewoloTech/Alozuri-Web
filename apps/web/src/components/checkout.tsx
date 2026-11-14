'use client';
import { trackMeta } from '@/lib/meta-pixel';
import { metaMoney } from '@/lib/meta-events';
import { LEGAL_VERSION, CHECKOUT_LEGAL_ACCEPTANCE } from '@alozuri/shared/legal';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';
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
import { cartItems, previewCartPrices, money, type CartLine, type Plan } from '@alozuri/shared';
import type { RootState } from '@/lib/store';
import { api } from '@/lib/api';
import { useCurrency } from './currency-provider';
import { useAuth } from './auth-provider';
import { OrderSummary, type Quote } from './cart';
import { stripeCheckoutMode } from './stripe-checkout';
import { CheckoutAccount } from './checkout-account';
const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
let stripePromise: ReturnType<typeof loadStripe> | undefined;
const verificationTimeoutMs = 10_000;
function CheckoutPolicyNotice() {
  return (
    <p className="checkout-policy-notice">
      By continuing, you agree to our <Link href="/terms">Terms &amp; Conditions</Link> and
      acknowledge our <Link href="/refund-policy">Refund Policy</Link> and{' '}
      <Link href="/privacy">Privacy Policy</Link>.
    </p>
  );
}
function StripePayment({
  clientSecret,
  orderId,
  deliveryEmail,
  totalCents,
  currency,
  walletFallback,
  onWalletStalled,
}: {
  clientSecret: string;
  orderId: string;
  deliveryEmail: string;
  totalCents: number;
  currency: string;
  walletFallback: boolean;
  onWalletStalled: () => void;
}) {
  const stripe = useStripe(),
    elements = useElements(),
    router = useRouter();
  const [processing, setProcessing] = useState(false),
    [error, setError] = useState(''),
    [wallets, setWallets] = useState(true),
    [ready, setReady] = useState(false);
  const submitted = useRef(false);
  const loadingPayment = !stripe || !elements || !ready;
  const paymentBusy = processing || (loadingPayment && !error);
  async function pay(event?: StripeExpressCheckoutElementConfirmEvent) {
    if (!stripe || !elements || submitted.current) {
      event?.paymentFailed({ reason: 'fail' });
      return;
    }
    submitted.current = true;
    setProcessing(true);
    setError('');
    try {
      // Bound validation only: confirmation/3DS must never be abandoned mid-payment.
      // No confirmPayment call can run after this timeout, even if submit resolves late.
      let timer: ReturnType<typeof setTimeout> | undefined;
      let stalled = false;
      const validation = await (
        event
          ? Promise.race([
              elements.submit(),
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                  stalled = true;
                  reject(new Error('Wallet validation timed out.'));
                }, 15_000);
              }),
            ]).finally(() => clearTimeout(timer))
          : elements.submit()
      ).catch((cause: unknown) => {
        if (stalled) {
          event?.paymentFailed({
            reason: 'fail',
            message: 'The wallet did not respond. Please pay by card instead.',
          });
          // Recreate Elements with the SAME PaymentIntent; no new order or charge.
          onWalletStalled();
          return null;
        }
        throw cause;
      });
      if (!validation) return;
      if (validation.error)
        throw new Error(validation.error.message || 'Check your payment details.');
      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: new URL('/checkout/success?order=' + orderId, window.location.origin).href,
          payment_method_data: { billing_details: { email: deliveryEmail } },
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
      <CheckoutPolicyNotice />
      {!walletFallback && (
        <div style={{ display: wallets ? 'block' : 'none' }}>
          <ExpressCheckoutElement
            options={{
              // Broader supported-browser coverage; Stripe still checks eligibility.
              paymentMethods: { applePay: 'always', googlePay: 'always' },
              paymentMethodOrder: ['apple_pay', 'google_pay', 'link'],
              layout: { maxColumns: 2, maxRows: 2 },
            }}
            onReady={(e) =>
              setWallets(
                Boolean(
                  e.availablePaymentMethods &&
                  Object.values(e.availablePaymentMethods).some(Boolean),
                ),
              )
            }
            onConfirm={(e) => void pay(e)}
            onLoadError={() => setWallets(false)}
          />
          {wallets && <p className="payment-divider">or pay by card</p>}
        </div>
      )}
      <PaymentElement
        onReady={() => setReady(true)}
        onLoadError={() =>
          setError('The payment form could not load. Refresh the page and try again.')
        }
        options={{
          layout: 'tabs',
          business: { name: 'Alozuri' },
          defaultValues: { billingDetails: { email: deliveryEmail } },
          fields: { billingDetails: { email: 'never' } },
          wallets: { applePay: 'never', googlePay: 'never' },
        }}
      />
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <button
        className={`button primary full-width${paymentBusy ? ' checkout-progress' : ''}`}
        aria-busy={paymentBusy}
        disabled={loadingPayment || processing}
        onClick={() => void pay()}
      >
        {paymentBusy && <LoaderCircle size={18} className="checkout-spinner" aria-hidden="true" />}
        {processing
          ? 'Processing payment…'
          : loadingPayment
            ? error
              ? 'Payment form unavailable'
              : 'Loading secure payment…'
            : `Pay ${money(totalCents, currency)}`}
      </button>
    </div>
  );
}
export function Checkout() {
  const { user, loading } = useAuth();
  const { currency, ready } = useCurrency();
  if (!ready || loading)
    return (
      <section className="container section" role="status">
        Loading checkout…
      </section>
    );
  return <CheckoutForIdentity key={(user?.uid ?? 'guest') + currency} />;
}
function CheckoutForIdentity() {
  const { currency, refresh, lock } = useCurrency();
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
    [email, setEmail] = useState(user?.email || ''),
    [accountBusy, setAccountBusy] = useState(false),
    [compatible, setCompatible] = useState(false),
    [session, setSession] = useState<{
      clientSecret: string;
      orderId: string;
      quote: Quote;
      deliveryEmail: string;
    } | null>(null),
    [mode, setMode] = useState<string | null>(null),
    [walletFallback, setWalletFallback] = useState(false),
    [quoteAttempt, setQuoteAttempt] = useState(0),
    [quotedSignature, setQuotedSignature] = useState('');
  useEffect(() => {
    lock(Boolean(session) || starting);
    return () => lock(false);
  }, [session, starting, lock]);
  const request = useRef(crypto.randomUUID()),
    submitting = useRef(false);
  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), verificationTimeoutMs);
    setMode(null);
    void api<{ cartCheckoutMode: string }>('/v1/config', { signal: controller.signal })
      .then((r) => {
        if (active) setMode(r.cartCheckoutMode);
      })
      .catch(() => {
        if (active) {
          setMode('disabled');
          setError('We could not load payment availability. Please retry.');
        }
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [quoteAttempt]);
  useEffect(() => {
    if (!buy) return;
    let active = true;
    void api<{ plan: Plan }>(
      '/v1/packages/' +
        encodeURIComponent(buy) +
        (currency === 'USD' ? '' : '?currency=' + currency),
    )
      .then((r) => {
        if (active) setBuyPlan(r.plan);
      })
      .catch(() => setError('This plan is unavailable. Return to your cart.'));
    return () => {
      active = false;
    };
  }, [buy, currency]);
  const lines: CartLine[] = useMemo(
    () => (buy ? (buyPlan ? [{ plan: buyPlan, quantity: 1 }] : []) : cart.items),
    [buy, buyPlan, cart.items],
  );
  const [promotionInput, setPromotionInput] = useState('');
  const [promotionCode, setPromotionCode] = useState('');
  const signature = JSON.stringify(cartItems(lines));
  useEffect(() => {
    if (session) return;
    setSession(null);
    request.current = crypto.randomUUID();
    if (signature === '[]') {
      setQuote(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), verificationTimeoutMs);
    setLoading(true);
    setError('');
    void api<{ quote: Quote }>('/v2/quote', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({
        items: JSON.parse(signature),
        currency,
        ...(promotionCode ? { promotionCode } : {}),
      }),
    })
      .then((r) => {
        if (active) {
          setQuote(r.quote);
          setQuotedSignature(signature);
        }
      })
      .catch((e) => {
        if (active) {
          setQuotedSignature('');
          setError(
            controller.signal.aborted
              ? 'Confirming your total took too long. Your cart is saved. Please retry.'
              : e instanceof Error
                ? e.message
                : 'Could not check prices.',
          );
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [signature, currency, refresh, session, quoteAttempt, promotionCode]);
  const quoteReady =
    quote?.currency === currency &&
    quotedSignature === signature &&
    (quote.promotion?.code ?? '') === promotionCode &&
    !loading;
  const preview = previewCartPrices(
    lines,
    quote?.currency === currency ? quote.items : [],
    currency,
  );
  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (
      submitting.current ||
      accountBusy ||
      cart.syncing ||
      (!buy && cart.syncFailed) ||
      !quote ||
      !compatible ||
      !quoteReady ||
      mode === null ||
      mode === 'disabled' ||
      mode !== stripeCheckoutMode
    )
      return;
    submitting.current = true;
    setStarting(true);
    setError('');
    try {
      const fingerprint = JSON.stringify({
        legalVersion: LEGAL_VERSION,
        currency,
        items: JSON.parse(signature),
        email: email.trim().toLowerCase(),
        total: quote.totalCents,
        promotion: quote.promotion ?? null,
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
            currency,
            email: email.trim(),
            // Keep the single-input UI compatible with the deployed API's
            // legacy contract until the optional-field API update is released.
            emailConfirmation: email.trim(),
            compatible,
            legal: CHECKOUT_LEGAL_ACCEPTANCE,
            requestId: request.current,
            expectedTotalCents: quote.totalCents,
            ...(promotionCode ? { promotionCode } : {}),
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
      setSession({ ...result, deliveryEmail: email.trim().toLowerCase() });
      const trackingValue = metaMoney(result.quote.totalCents, result.quote.currency);
      if (trackingValue) void trackMeta('InitiateCheckout', trackingValue, result.orderId, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout could not start.');
      if (e instanceof Error && /reservation expired|payment is closed/i.test(e.message)) {
        request.current = crypto.randomUUID();
        try {
          sessionStorage.removeItem('alozuri-checkout-attempt');
        } catch {}
      }
      if (e instanceof Error && /price changed|Checkout changed/i.test(e.message)) {
        request.current = crypto.randomUUID();
        const fresh = await api<{ quote: Quote }>('/v2/quote', {
          method: 'POST',
          body: JSON.stringify({
            items: JSON.parse(signature),
            currency,
            ...(promotionCode ? { promotionCode } : {}),
          }),
        }).catch(() => null);
        if (fresh) {
          setQuote(fresh.quote);
          setQuotedSignature(signature);
        }
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
  const progressLabel = starting
    ? 'Preparing secure payment…'
    : accountBusy
      ? 'Finishing sign-in…'
      : cart.syncing
        ? 'Saving your cart…'
        : mode === null
          ? 'Checking payment availability…'
          : loading || (!quoteReady && !error)
            ? 'Confirming your total…'
            : '';
  const checkoutHint = starting
    ? 'Opening your payment options. You will review payment before being charged.'
    : accountBusy
      ? 'Finish signing in to continue. Your order is saved.'
      : progressLabel
        ? 'You can enter your details while we confirm your order. You will review payment before being charged.'
        : !buy && cart.syncFailed
          ? 'Resolve your cart sync issue before continuing to payment.'
          : !quoteReady
            ? 'We could not confirm your total. Please retry below.'
            : mode === 'disabled' || mode !== stripeCheckoutMode
              ? 'Payments are currently unavailable. Your cart is saved.'
              : !compatible
                ? 'Confirm that your device supports eSIM above to continue.'
                : '';
  const orderSummary = (
    <OrderSummary
      compact
      showPlanDetails
      lines={session ? session.quote.items : quoteReady && quote ? quote.items : preview.items}
      total={
        session ? session.quote.totalCents : quoteReady && quote ? quote.totalCents : preview.total
      }
      currency={session?.quote.currency ?? currency}
      updating={!session && loading}
    />
  );
  return (
    <section className="container section checkout-page">
      <Link className="text-link" href="/cart">
        ← Edit cart
      </Link>
      <div className="page-intro">
        <h1>Checkout</h1>
      </div>
      <div className={`commerce-layout${session ? '' : ' checkout-review'}`}>
        <div className="surface stack">
          {session ? (
            <>
              <h2>Secure payment</h2>
              <p>Delivery email: {session.deliveryEmail}</p>
              {mode === 'test' && (
                <p className="notice">Test payment. No real money or eSIM will be issued.</p>
              )}
              {walletFallback && (
                <p role="alert" className="notice">
                  The wallet did not respond. Please pay by card below. Your existing order is
                  unchanged, and no payment was submitted by this wallet attempt.
                </p>
              )}
              <Elements
                key={walletFallback ? 'card-fallback' : 'wallets'}
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
                  walletFallback={walletFallback}
                  onWalletStalled={() => setWalletFallback(true)}
                  clientSecret={session.clientSecret}
                  orderId={session.orderId}
                  deliveryEmail={session.deliveryEmail}
                  totalCents={session.quote.totalCents}
                  currency={session.quote.currency}
                />
              </Elements>
            </>
          ) : (
            <form className="stack" onSubmit={start}>
              <h2>Delivery email</h2>
              <p>We&apos;ll send your eSIM installation instructions here.</p>
              <CheckoutAccount
                email={email}
                onEmailChange={setEmail}
                user={user}
                disabled={starting}
                onBusyChange={setAccountBusy}
                returnTo={buy ? '/checkout?buy=' + encodeURIComponent(buy) : '/checkout'}
              />
              {cart.syncing && <p role="status">Syncing your saved cart…</p>}
              {!buy && cart.syncFailed && (
                <p className="error-message" role="alert">
                  {cart.error}{' '}
                  <Link href="/cart">Return to your cart to resolve this before paying.</Link>
                </p>
              )}
              {orderSummary}
              <details className="checkout-promo-entry">
                <summary>Have a promotional code?</summary>
                <label htmlFor="promotion-code">Promotional code</label>
                <input
                  id="promotion-code"
                  className="commerce-input"
                  maxLength={32}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!loading && !starting)
                        setPromotionCode(promotionInput.trim().toUpperCase());
                    }
                  }}
                  value={promotionInput}
                  onChange={(e) => setPromotionInput(e.target.value)}
                />
                <div className="checkout-promo-actions">
                  <button
                    type="button"
                    className="button small"
                    disabled={loading || starting || !promotionInput.trim()}
                    onClick={() => setPromotionCode(promotionInput.trim().toUpperCase())}
                  >
                    Apply code
                  </button>
                  {promotionCode && (
                    <button
                      type="button"
                      className="button small"
                      onClick={() => {
                        setPromotionCode('');
                        setPromotionInput('');
                      }}
                    >
                      Remove code
                    </button>
                  )}
                </div>
              </details>
              {quoteReady && quote?.promotion && (
                <p role="status" className="checkout-promotion">
                  {quote.promotion.code}: {quote.promotion.discountPercent}% off · Discount{' '}
                  {money(quote.discountCents ?? 0, currency)} · Original total{' '}
                  {money(quote.originalRetailCents ?? quote.totalCents, currency)}
                </p>
              )}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  required
                  checked={compatible}
                  onChange={(e) => setCompatible(e.target.checked)}
                />
                <span>
                  My device supports eSIM and is carrier unlocked.{' '}
                  <Link href="/esim-compatibility">Check compatibility</Link>
                </span>
              </label>
              <CheckoutPolicyNotice />
              {mode !== null && (mode === 'disabled' || mode !== stripeCheckoutMode) ? (
                <p className="notice" role="status">
                  Payments are not currently configured for this storefront. Your cart is saved.
                </p>
              ) : null}
              <button
                className={`button primary full-width${progressLabel ? ' checkout-progress' : ''}`}
                aria-busy={Boolean(progressLabel)}
                aria-describedby="checkout-next-step"
                disabled={
                  starting ||
                  accountBusy ||
                  cart.syncing ||
                  (!buy && cart.syncFailed) ||
                  loading ||
                  !quoteReady ||
                  !compatible ||
                  mode === null ||
                  mode === 'disabled' ||
                  mode !== stripeCheckoutMode
                }
              >
                {progressLabel && (
                  <LoaderCircle size={18} className="checkout-spinner" aria-hidden="true" />
                )}
                {progressLabel || 'Continue to payment'}
              </button>
              <p id="checkout-next-step" className="fine-print checkout-next-step" role="status">
                {checkoutHint}
              </p>
              <p className="fine-print payment-security">
                Payment details are handled securely by Stripe.
              </p>
            </form>
          )}
          {error && (
            <div role="alert">
              <p className="error-message">{error}</p>
              {!session && (!quoteReady || mode === 'disabled') && (
                <button
                  type="button"
                  className="button"
                  onClick={() => setQuoteAttempt((n) => n + 1)}
                >
                  Retry checkout
                </button>
              )}
            </div>
          )}
        </div>
        {session && orderSummary}
      </div>
    </section>
  );
}
