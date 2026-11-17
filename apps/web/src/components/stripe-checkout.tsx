'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useLocalizedRouter as useRouter } from '@/lib/localized-router';
import { loadStripe } from '@stripe/stripe-js/pure';
import type { StripeEmbeddedCheckout } from '@stripe/stripe-js';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const configuredMode = process.env.NEXT_PUBLIC_PAYMENT_MODE ?? 'test';
export const stripeCheckoutMode: 'test' | 'live' | 'disabled' =
  configuredMode === 'live' && publishableKey.startsWith('pk_live_')
    ? 'live'
    : configuredMode === 'test' && publishableKey.startsWith('pk_test_')
      ? 'test'
      : 'disabled';
export const stripeCheckoutConfigured = stripeCheckoutMode !== 'disabled';
let stripePromise: ReturnType<typeof loadStripe> | undefined;
// Serialize initialization so React's development effect replay cannot mount two checkouts.
let initialization = Promise.resolve();

export function StripeCheckout({
  clientSecret,
  orderId,
  onComplete,
}: {
  clientSecret: string;
  orderId: string;
  onComplete?: () => void;
}) {
  const t = useTranslations('paymentUi');
  const common = useTranslations('common');
  const container = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let checkout: StripeEmbeddedCheckout | undefined;
    initialization = initialization.then(async () => {
      if (cancelled) return;
      try {
        if (!stripeCheckoutConfigured) throw new Error('Checkout is not configured.');
        stripePromise ??= loadStripe(publishableKey).catch((e) => {
          stripePromise = undefined;
          throw e;
        });
        const stripe = await stripePromise;
        if (cancelled) return;
        if (!stripe) throw new Error('Stripe could not load.');
        checkout = await stripe.createEmbeddedCheckoutPage({
          clientSecret,
          onComplete: () => {
            if (!cancelled) {
              if (onComplete) onComplete();
              else router.replace('/dashboard/orders?id=' + encodeURIComponent(orderId));
            }
          },
        });
        if (cancelled) {
          checkout.destroy();
          checkout = undefined;
          return;
        }
        if (container.current) checkout.mount(container.current);
        setLoading(false);
      } catch {
        checkout?.destroy();
        checkout = undefined;
        if (!cancelled) {
          setLoading(false);
          setError(true);
        }
      }
    });
    return () => {
      cancelled = true;
      checkout?.destroy();
      checkout = undefined;
    };
  }, [clientSecret, orderId, router, attempt, onComplete]);
  return (
    <div className="surface stripe-checkout">
      {loading && <p role="status">{t('loadingPayment')}</p>}
      {error && (
        <div role="alert">
          <p className="error-message">{t('formError')}</p>
          <button
            className="button"
            onClick={() => {
              setError(false);
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          >
            {common('retry')}
          </button>
        </div>
      )}
      <div ref={container} />
    </div>
  );
}
