'use client';
import { ERROR_MESSAGES, type ErrorCode } from '@alozuri/shared/i18n/errors';
import type { Messages } from '@alozuri/shared/i18n/messages';
import { LinkedMessage, MESSAGE_LINKS } from './linked-message';
import { StoreApiError } from '@/lib/api-error';
import { endorselyReferral } from '@/lib/endorsely';
import { trackMeta } from '@/lib/meta-pixel';
import { metaMoney } from '@/lib/meta-events';
import { LEGAL_VERSION, CHECKOUT_LEGAL_ACCEPTANCE } from '@alozuri/shared/legal';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/localized-link';
import { useLocale, useTranslations } from 'next-intl';
import {
  stripeElementsLocale,
  isPublishedLocale,
  localePath,
  type Locale,
} from '@alozuri/shared/i18n';
import { useLanguage } from './language-provider';
import { LoaderCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useLocalizedRouter as useRouter } from '@/lib/localized-router';
import { useSelector, useDispatch } from 'react-redux';
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
import { setPromotionCode as savePromotionCode, type RootState } from '@/lib/store';
import { api } from '@/lib/api';
import { useCurrency } from './currency-provider';
import { useAuth } from './auth-provider';
import { OrderSummary, type Quote } from './cart';
import { stripeCheckoutMode } from './stripe-checkout';
import { CheckoutAccount } from './checkout-account';
const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
let stripePromise: ReturnType<typeof loadStripe> | undefined;
const verificationTimeoutMs = 10_000;
type CheckoutFailure = { key: keyof Messages['paymentUi'] } | { code: ErrorCode };
class CheckoutPresentationError extends Error {
  constructor(readonly key: keyof Messages['paymentUi']) {
    super(key);
  }
}
function presentationFailure(
  error: unknown,
  fallback: keyof Messages['paymentUi'],
): CheckoutFailure {
  return error instanceof StoreApiError
    ? { code: error.code }
    : { key: error instanceof CheckoutPresentationError ? error.key : fallback };
}
function CheckoutPolicyNotice() {
  const p = useTranslations('paymentUi');
  const legal = useTranslations('legal');
  const locale = useLocale();
  return (
    <p className="checkout-policy-notice" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <LinkedMessage
        message={p('policy', {
          terms: MESSAGE_LINKS.terms,
          refunds: MESSAGE_LINKS.refunds,
          privacy: MESSAGE_LINKS.privacy,
        })}
        links={{
          terms: { href: '/terms', label: legal('terms') },
          refunds: { href: '/refund-policy', label: legal('refunds') },
          privacy: { href: '/privacy', label: legal('privacy') },
        }}
      />
    </p>
  );
}
function StripePayment({
  locale,
  clientSecret,
  orderId,
  deliveryEmail,
  totalCents,
  currency,
  walletFallback,
  onWalletStalled,
}: {
  locale: Locale;
  clientSecret: string;
  orderId: string;
  deliveryEmail: string;
  totalCents: number;
  currency: string;
  walletFallback: boolean;
  onWalletStalled: () => void;
}) {
  const p = useTranslations('paymentUi');
  const t = useTranslations('checkout');
  const errors = useTranslations('errors');
  const stripe = useStripe(),
    elements = useElements(),
    router = useRouter();
  const [processing, setProcessing] = useState(false),
    [error, setError] = useState<CheckoutFailure | null>(null),
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
    setError(null);
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
            message: p('walletFailed'),
          });
          // Recreate Elements with the SAME PaymentIntent; no new order or charge.
          onWalletStalled();
          return null;
        }
        throw cause;
      });
      if (!validation) return;
      if (validation.error) throw new CheckoutPresentationError('detailsError');
      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: new URL(
            localePath('/checkout/success?order=' + orderId, locale),
            window.location.origin,
          ).href,
          payment_method_data: { billing_details: { email: deliveryEmail } },
        },
        redirect: 'if_required',
      });
      if (result.error)
        throw new CheckoutPresentationError(
          result.error.code === 'card_declined' ? 'declined' : 'detailsError',
        );
      if (
        result.paymentIntent?.status === 'succeeded' ||
        result.paymentIntent?.status === 'processing'
      ) {
        router.replace('/checkout/success?order=' + orderId);
        return;
      }
      throw new CheckoutPresentationError('furtherAction');
    } catch (e) {
      setError(presentationFailure(e, 'detailsError'));
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
          {wallets && <p className="payment-divider">{p('orCard')}</p>}
        </div>
      )}
      <PaymentElement
        onReady={() => setReady(true)}
        onLoadError={() => setError({ key: 'formError' })}
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
          {'code' in error ? errors(ERROR_MESSAGES[error.code]) : p(error.key)}
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
          ? p('processing')
          : loadingPayment
            ? error
              ? p('unavailable')
              : p('loadingPayment')
            : t('pay', { amount: money(totalCents, currency) })}
      </button>
    </div>
  );
}
export function Checkout() {
  const p = useTranslations('paymentUi');
  const { user, loading } = useAuth();
  const { currency, ready } = useCurrency();
  if (!ready || loading)
    return (
      <section className="container section" role="status">
        {p('loadingCheckout')}
      </section>
    );
  return <CheckoutForIdentity key={(user?.uid ?? 'guest') + currency} />;
}
function CheckoutForIdentity() {
  const locale = useLocale();
  const isolate = (value: string) => (locale === 'ar' ? '\u2066' + value + '\u2069' : value);
  const { changeLanguage } = useLanguage();
  const t = useTranslations('checkout');
  const p = useTranslations('paymentUi');
  const cartCopy = useTranslations('cart');
  const errors = useTranslations('errors');
  const { currency, refresh, lock } = useCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cart = useSelector((s: RootState) => s.cart),
    { user } = useAuth(),
    params = useSearchParams();
  const buy = params.get('buy');
  const [buyPlan, setBuyPlan] = useState<Plan | null>(null),
    [quote, setQuote] = useState<Quote | null>(null),
    [error, setError] = useState<CheckoutFailure | null>(null),
    [loading, setLoading] = useState(false),
    [starting, setStarting] = useState(false),
    [email, setEmail] = useState(user?.email || ''),
    [accountBusy, setAccountBusy] = useState(false),
    [compatible, setCompatible] = useState(false),
    [session, setSession] = useState<{
      locale: Locale;
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
          setError({ key: 'availabilityError' });
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
      .catch(() => setError({ key: 'planUnavailable' }));
    return () => {
      active = false;
    };
  }, [buy, currency]);
  const lines: CartLine[] = useMemo(
    () => (buy ? (buyPlan ? [{ plan: buyPlan, quantity: 1 }] : []) : cart.items),
    [buy, buyPlan, cart.items],
  );
  const dispatch = useDispatch();
  const promotionCode = cart.promotionCode;
  const setPromotionCode = (value: string) => dispatch(savePromotionCode(value));
  const [promotionInput, setPromotionInput] = useState(promotionCode);
  useEffect(() => setPromotionInput(promotionCode), [promotionCode]);
  const reviewForm = useRef<HTMLFormElement>(null);
  const paymentHeading = useRef<HTMLHeadingElement>(null);
  const pendingPromotionContinue = useRef<string | null>(null);
  const enteredPromotion = promotionInput.trim().toUpperCase();
  const promotionChanged = enteredPromotion !== promotionCode;
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
    setError(null);
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
          pendingPromotionContinue.current = null;
          setQuotedSignature('');
          setError(
            controller.signal.aborted
              ? { key: 'totalTimeout' }
              : presentationFailure(e, 'priceError'),
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
  const continuationKey = JSON.stringify([
    signature,
    currency,
    email.trim().toLowerCase(),
    compatible,
    user?.uid ?? 'guest',
    enteredPromotion,
  ]);
  useEffect(() => {
    if (!pendingPromotionContinue.current) return;
    if (pendingPromotionContinue.current !== continuationKey) {
      pendingPromotionContinue.current = null;
      return;
    }
    if (!quoteReady) return;
    pendingPromotionContinue.current = null;
    reviewForm.current?.requestSubmit();
  }, [continuationKey, quoteReady]);
  useEffect(() => {
    if (!session) return;
    paymentHeading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [session]);
  const preview = previewCartPrices(
    lines,
    quote?.currency === currency ? quote.items : [],
    currency,
  );
  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (
      submitting.current ||
      !isPublishedLocale(locale) ||
      accountBusy ||
      cart.syncing ||
      (!buy && cart.syncFailed) ||
      !compatible ||
      loading ||
      mode === null ||
      mode === 'disabled' ||
      mode !== stripeCheckoutMode
    )
      return;
    if (promotionChanged) {
      pendingPromotionContinue.current = continuationKey;
      setPromotionCode(enteredPromotion);
      return;
    }
    if (!quote || !quoteReady) return;
    submitting.current = true;
    setStarting(true);
    setError(null);
    try {
      const fingerprint = JSON.stringify({
        locale,
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
        locale?: Locale;
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
            ...(params.get('repeatQuote') ? { repeatQuote: params.get('repeatQuote') } : {}),
            endorselyReferral: endorselyReferral(),
            locale,
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
        throw new CheckoutPresentationError('stripeError');
      }
      setSession({
        ...result,
        locale: result.locale ?? 'en',
        deliveryEmail: email.trim().toLowerCase(),
      });
      const trackingValue = metaMoney(result.quote.totalCents, result.quote.currency);
      if (trackingValue) void trackMeta('InitiateCheckout', trackingValue, result.orderId, true);
    } catch (e) {
      setError(presentationFailure(e, 'startError'));
      if (
        e instanceof StoreApiError &&
        ['PROMO_RESERVATION_EXPIRED', 'CHECKOUT_CLOSED'].includes(e.code)
      ) {
        request.current = crypto.randomUUID();
        try {
          sessionStorage.removeItem('alozuri-checkout-attempt');
        } catch {}
      }
      if (e instanceof StoreApiError && ['PRICE_CHANGED', 'CHECKOUT_CHANGED'].includes(e.code)) {
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
        {p('loadingCheckout')}
      </section>
    );
  if (!lines.length)
    return (
      <section className="container section">
        <h1>{buy ? p('loadingPlan') : cartCopy('emptyTitle')}</h1>
        {error && (
          <p role="alert">{'code' in error ? errors(ERROR_MESSAGES[error.code]) : p(error.key)}</p>
        )}
        <Link className="button primary" href="/destinations">
          {cartCopy('explore')}
        </Link>
      </section>
    );
  const progressLabel = starting
    ? p('preparing')
    : accountBusy
      ? p('signingIn')
      : cart.syncing
        ? cartCopy('saving')
        : mode === null
          ? p('checkingAvailability')
          : loading || (!quoteReady && !error)
            ? p('confirmingTotal')
            : '';
  const checkoutHint = starting
    ? p('openingHint')
    : accountBusy
      ? p('signInHint')
      : progressLabel
        ? p('confirmingHint')
        : !buy && cart.syncFailed
          ? p('syncHint')
          : !quoteReady
            ? p('totalHint')
            : mode === 'disabled' || mode !== stripeCheckoutMode
              ? p('paymentsHint')
              : !compatible
                ? p('compatibilityHint')
                : '';
  const orderSummary = (
    <OrderSummary
      compact
      showPlanDetails
      lines={session ? session.quote.items : quoteReady && quote ? quote.items : preview.items}
      total={
        session ? session.quote.totalCents : quoteReady && quote ? quote.totalCents : preview.total
      }
      quote={session ? session.quote : quoteReady ? quote : null}
      currency={session?.quote.currency ?? currency}
      updating={!session && loading}
    />
  );
  return (
    <section className="container section checkout-page">
      <Link className="text-link" href="/cart">
        {p('editCart')}
      </Link>
      <div className="page-intro">
        <h1>{t('title')}</h1>
      </div>
      {!session && !isPublishedLocale(locale) && (
        <div className="notice checkout-language-notice" role="status">
          <p>{t('legalUnavailable')}</p>
          <button type="button" className="button" onClick={() => void changeLanguage('en')}>
            {t('useEnglish')}
          </button>
        </div>
      )}
      <div className={`commerce-layout${session ? '' : ' checkout-review'}`} dir="ltr">
        <div className="surface stack" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          {session ? (
            <>
              <h2 ref={paymentHeading} tabIndex={-1}>
                {t('securePayment')}
              </h2>
              <p>{p('deliveryEmail', { email: isolate(session.deliveryEmail) })}</p>
              {mode === 'test' && <p className="notice">{p('testNotice')}</p>}
              {walletFallback && (
                <p role="alert" className="notice">
                  {p('walletTimeout')}
                </p>
              )}
              <Elements
                key={walletFallback ? 'card-fallback' : 'wallets'}
                stripe={stripePromise!}
                options={{
                  locale: stripeElementsLocale(session.locale),
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
                  locale={session.locale}
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
            <form ref={reviewForm} className="stack" onSubmit={start} dir="ltr">
              <h2 dir={locale === 'ar' ? 'rtl' : 'ltr'}>{t('deliveryEmail')}</h2>
              <p dir={locale === 'ar' ? 'rtl' : 'ltr'}>{t('emailHint')}</p>
              <CheckoutAccount
                email={email}
                onEmailChange={setEmail}
                user={user}
                disabled={starting}
                onBusyChange={setAccountBusy}
                returnTo={buy ? '/checkout?buy=' + encodeURIComponent(buy) : '/checkout'}
              />
              {cart.syncing && <p role="status">{p('syncingCart')}</p>}
              {!buy && cart.syncFailed && (
                <p className="error-message" role="alert">
                  {cartCopy('syncError')} <Link href="/cart">{p('resolveCart')}</Link>
                </p>
              )}
              {orderSummary}
              <details className="checkout-promo-entry" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                <summary>{p('promotionQuestion')}</summary>
                <label htmlFor="promotion-code">{t('promotionalCode')}</label>
                <input
                  id="promotion-code"
                  dir="ltr"
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
                  disabled={starting}
                  onChange={(e) => setPromotionInput(e.target.value)}
                />
                <div className="checkout-promo-actions" dir="ltr">
                  <button
                    type="button"
                    className="button small"
                    disabled={loading || starting || !promotionInput.trim()}
                    onClick={() => setPromotionCode(promotionInput.trim().toUpperCase())}
                  >
                    {t('apply')}
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
                      {t('remove')}
                    </button>
                  )}
                </div>
              </details>
              {quoteReady && quote?.promotion && (
                <p role="status" className="checkout-promotion">
                  {quote.promotion.discount && quote.promotion.discount.kind !== 'percent'
                    ? `${isolate(quote.promotion.code)} · −${isolate(money(quote.discountCents ?? 0, currency))}`
                    : p('promotionApplied', {
                        code: isolate(quote.promotion.code),
                        percent: quote.promotion.discountPercent,
                        discount: isolate(money(quote.discountCents ?? 0, currency)),
                        original: isolate(
                          money(quote.originalRetailCents ?? quote.totalCents, currency),
                        ),
                      })}
                </p>
              )}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  required
                  checked={compatible}
                  onChange={(e) => setCompatible(e.target.checked)}
                />
                <span dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                  {p('compatible')}{' '}
                  <Link href="/esim-compatibility">{p('checkCompatibility')}</Link>
                </span>
              </label>
              <CheckoutPolicyNotice />
              {mode !== null && (mode === 'disabled' || mode !== stripeCheckoutMode) ? (
                <p className="notice" role="status">
                  {p('notConfigured')}
                </p>
              ) : null}
              <button
                className={`button primary full-width${progressLabel ? ' checkout-progress' : ''}`}
                aria-busy={Boolean(progressLabel)}
                aria-describedby="checkout-next-step"
                disabled={
                  !isPublishedLocale(locale) ||
                  starting ||
                  accountBusy ||
                  cart.syncing ||
                  (!buy && cart.syncFailed) ||
                  loading ||
                  (!quoteReady && !promotionChanged) ||
                  !compatible ||
                  mode === null ||
                  mode === 'disabled' ||
                  mode !== stripeCheckoutMode
                }
              >
                {progressLabel && (
                  <LoaderCircle size={18} className="checkout-spinner" aria-hidden="true" />
                )}
                {progressLabel || t('continue')}
              </button>
              <p id="checkout-next-step" className="fine-print checkout-next-step" role="status">
                {checkoutHint}
              </p>
              <p className="fine-print payment-security">{cartCopy('security')}</p>
            </form>
          )}
          {error && (
            <div role="alert">
              <p className="error-message">
                {'code' in error ? errors(ERROR_MESSAGES[error.code]) : p(error.key)}
              </p>
              {!session && (!quoteReady || mode === 'disabled') && (
                <button
                  type="button"
                  className="button"
                  onClick={() => setQuoteAttempt((n) => n + 1)}
                >
                  {p('retry')}
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
