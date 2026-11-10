'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { countryName, money, type Plan } from '@voyaspan/shared';
import { demoPlans } from '@voyaspan/shared/demo';
import { api, demoMode } from '@/lib/api';
import type { RootState } from '@/lib/store';
import { useAuth } from './auth-provider';
export function PlanDetails({ id, review = false }: { id: string; review?: boolean }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(() =>
    demoMode ? (demoPlans.find((p) => p.id === id) ?? null) : null,
  );
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState('');
  const [paymentMode, setPaymentMode] = useState<'test' | 'disabled'>('disabled');
  const [paying, setPaying] = useState(false);
  const requestId = useRef('');
  useEffect(() => {
    if (!demoMode)
      void api<{ paymentMode: 'test' | 'disabled' }>('/v1/config')
        .then((c) => setPaymentMode(c.paymentMode))
        .catch(() => {});
  }, []);
  async function checkout() {
    if (!user) {
      router.push('/login?next=' + encodeURIComponent('/checkout/' + id));
      return;
    }
    if (!user.emailVerified) {
      router.push('/verify-email?next=' + encodeURIComponent('/checkout/' + id));
      return;
    }
    setPaying(true);
    setError('');
    try {
      requestId.current ||= crypto.randomUUID();
      const result = await api<{ url: string }>(
        '/v1/checkout',
        {
          method: 'POST',
          body: JSON.stringify({ planId: id, requestId: requestId.current, compatible: true }),
        },
        true,
      );
      const target = new URL(result.url);
      if (target.protocol !== 'https:' || target.hostname !== 'checkout.stripe.com')
        throw new Error('Invalid checkout URL.');
      window.location.assign(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open checkout.');
      if (e instanceof Error && /closed|changed|no longer|unavailable/i.test(e.message)) {
        requestId.current = '';
        setCompatible(false);
      }
      setPaying(false);
      if (!demoMode)
        void api<{ plan: Plan }>(`/v1/packages/${encodeURIComponent(id)}`)
          .then((r) => setPlan(r.plan))
          .catch(() => {});
    }
  }
  const [compatible, setCompatible] = useState(false);
  const itinerary = useSelector((s: RootState) => s.itinerary.countries);
  useEffect(() => {
    if (demoMode) return;
    let active = true;
    api<{ plan: Plan }>(`/v1/packages/${encodeURIComponent(id)}`)
      .then((r) => {
        if (active) setPlan(r.plan);
      })
      .catch(() => {
        if (active) setError('This plan is unavailable. Please search again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (loading)
    return (
      <div className="loading-page" role="status">
        Loading your plan…
      </div>
    );
  if (!plan)
    return (
      <section className="container section">
        <h1 className="compact-title">Plan unavailable</h1>
        <p role="alert">{error || 'This plan could not be found.'}</p>
        <Link className="button" href="/#planner">
          Search plans
        </Link>
      </section>
    );
  const covered = itinerary.length > 0 && itinerary.every((c) => plan.countries.includes(c));
  return (
    <section className="container section">
      <Link className="text-link" href="/#planner">
        ← Back to your itinerary
      </Link>
      <div className="page-intro">
        <span className="eyebrow">{review ? 'REVIEW YOUR PLAN' : 'ONE PLAN. EVERY STOP.'}</span>
        <h1>{plan.name}</h1>
        <p>
          {plan.dataType === 'unlimited'
            ? 'Unlimited data'
            : `${plan.dataGb} GB${plan.dataType === 'daily' ? ' per day' : ''}`}{' '}
          · {plan.days} days · Data only
        </p>
      </div>
      <div className="detail-layout">
        <div className="stack">
          <div className="surface">
            <h2>Every destination, checked.</h2>
            {itinerary.length > 0 && (
              <p className={covered ? 'success-message' : 'error-message'}>
                {covered
                  ? '✓ Covers all your selected countries'
                  : 'This plan does not cover your full itinerary'}
                : {itinerary.map(countryName).join(', ')}.
              </p>
            )}
            <div className="coverage-list">
              {plan.countries.map((c) => (
                <span key={c}>{countryName(c)}</span>
              ))}
            </div>
          </div>
          <div className="surface">
            <h2>Know before you go</h2>
            <dl className="spec-list">
              <div>
                <dt>Activation</dt>
                <dd>{plan.activation}</dd>
              </div>
              <div>
                <dt>Networks</dt>
                <dd>
                  {plan.networks.length
                    ? plan.networks.join(', ')
                    : 'Operator information is not available for this sample plan.'}
                </dd>
              </div>
              <div>
                <dt>Data and fair use</dt>
                <dd>{plan.fairUse}</dd>
              </div>
              <div>
                <dt>Calls and texts</dt>
                <dd>Data only. Keep your home SIM for your existing number.</dd>
              </div>
            </dl>
            <Link href="/help#compatibility" className="text-link">
              Check your device compatibility ↗
            </Link>
          </div>
        </div>
        <aside className="surface purchase-summary">
          <span className="eyebrow">{plan.demo ? 'SAMPLE PLAN' : 'PLAN SUMMARY'}</span>
          <h2>
            {money(plan.priceCents)} <small>USD</small>
          </h2>
          <p>
            {plan.demo
              ? 'Illustrative price. No payment will be taken.'
              : 'One-time payment. Final total must be confirmed before payment.'}
          </p>
          {plan.demo && (
            <div className="notice">
              First draft preview. Supplier availability, network coverage and pricing have not been
              verified. Purchases are disabled.
            </div>
          )}
          {review && !authLoading && !user && (
            <div className="notice">
              <Link
                href={`/login?next=${encodeURIComponent(`/checkout/${id}`)}`}
                className="text-link"
              >
                Log in
              </Link>{' '}
              or{' '}
              <Link
                href={`/register?next=${encodeURIComponent(`/checkout/${id}`)}`}
                className="text-link"
              >
                create an account
              </Link>{' '}
              to keep your plans in one place. Email verification is required before purchasing.
            </div>
          )}
          {review && user && !user.emailVerified && (
            <div className="notice">
              Verify your email before purchasing.{' '}
              <Link
                href={`/verify-email?next=${encodeURIComponent('/checkout/' + id)}`}
                className="text-link"
              >
                Open your account to resend the email or check verification.
              </Link>
            </div>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={compatible}
              onChange={(e) => setCompatible(e.target.checked)}
            />
            <span>My phone supports eSIM and is carrier unlocked.</span>
          </label>
          {review ? (
            <>
              {paymentMode === 'test' && (
                <div className="notice">
                  Stripe test checkout. No real payment or eSIM will be issued. Apple Pay and Google
                  Pay appear in Stripe when supported by your device and wallet.
                </div>
              )}
              <button
                disabled={
                  paymentMode !== 'test' ||
                  !compatible ||
                  paying ||
                  authLoading ||
                  (itinerary.length > 0 && !covered)
                }
                onClick={checkout}
                className="button primary full-width"
              >
                {paying
                  ? 'Opening Stripe…'
                  : paymentMode === 'test'
                    ? 'Continue to Stripe test checkout'
                    : 'Checkout unavailable'}
              </button>
              {error && (
                <p role="alert" className="error-message">
                  {error}
                </p>
              )}
            </>
          ) : (
            <Link
              aria-disabled={!compatible || (itinerary.length > 0 && !covered)}
              href={compatible && (!itinerary.length || covered) ? `/checkout/${id}` : '#'}
              className="button primary full-width"
            >
              Review plan →
            </Link>
          )}
          <p className="fine-print">
            Install over Wi-Fi. Check the activation rule before installing.{' '}
            <Link href="/legal/refunds">Refund information</Link>
          </p>
        </aside>
      </div>
    </section>
  );
}
