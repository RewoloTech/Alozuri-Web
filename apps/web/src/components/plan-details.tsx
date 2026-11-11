'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import { dataLabel, countryName, money, coverageLabel, type Plan } from '@voyaspan/shared';
import { demoPlans } from '@voyaspan/shared/demo';
import { useCurrency } from './currency-provider';
import { api, demoMode } from '@/lib/api';
import { addToCart, type RootState } from '@/lib/store';
export function PlanDetails({
  id,
  initialPlan = null,
}: {
  id: string;
  review?: boolean;
  initialPlan?: Plan | null;
}) {
  const { currency, refresh } = useCurrency();
  const dispatch = useDispatch(),
    cart = useSelector((s: RootState) => s.cart);
  const [plan, setPlan] = useState<Plan | null>(
      () => initialPlan ?? (demoMode ? (demoPlans.find((p) => p.id === id) ?? null) : null),
    ),
    [loading, setLoading] = useState(!demoMode && !initialPlan),
    [adding, setAdding] = useState(false),
    [added, setAdded] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (demoMode) return;
    let active = true;
    setLoading(true);
    setError('');
    void api<{ plan: Plan }>(
      '/v1/packages/' +
        encodeURIComponent(id) +
        (currency === 'USD' ? '' : '?currency=' + currency),
    )
      .then((r) => {
        if (active) setPlan(r.plan);
      })
      .catch(() => {
        if (active) setError('This plan is no longer available. Search again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, currency, refresh]);
  async function add() {
    if (!plan || plan.demo) return;
    setAdding(true);
    setAdded(false);
    setError('');
    try {
      const fresh = await api<{ plan: Plan }>(
        '/v1/packages/' +
          encodeURIComponent(id) +
          (currency === 'USD' ? '' : '?currency=' + currency),
      );
      if (fresh.plan.demo) throw new Error('Sample plans cannot be purchased.');
      setPlan(fresh.plan);
      dispatch(addToCart(fresh.plan));
      setAdded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add this plan.');
    } finally {
      setAdding(false);
    }
  }
  if (loading)
    return (
      <div className="loading-page" role="status">
        Loading your plan…
      </div>
    );
  if (!plan)
    return (
      <section className="container section">
        <h1>Plan unavailable</h1>
        <p role="alert">{error}</p>
        <Link className="button" href="/destinations">
          Search plans
        </Link>
      </section>
    );
  const limit =
    cart.items.reduce((n, i) => n + i.quantity, 0) >= 10 ||
    (cart.items.find((i) => i.plan.id === id)?.quantity ?? 0) >= 5;
  return (
    <section className="container section">
      <Link className="text-link" href="/destinations">
        ← Explore destinations
      </Link>
      <div className="page-intro">
        <span className="eyebrow">ONE PLAN. EVERY STOP.</span>
        <h1>{plan.name}</h1>
        <p>
          {dataLabel(plan)} · {plan.days} days · Data only
        </p>
      </div>
      <div className="detail-layout">
        <div className="stack">
          <div className="surface">
            <h2>{coverageLabel(plan)}</h2>
            <p>
              Includes exactly {plan.countries.length}{' '}
              {plan.countries.length === 1 ? 'destination' : 'destinations'}:
            </p>
            <div className="coverage-list">
              {plan.countries.map((c) => (
                <span key={c}>{countryName(c)}</span>
              ))}
            </div>
          </div>
          <div className="surface">
            {plan.supplierNotes && (
              <section>
                <h2>Supplier conditions</h2>
                <p>
                  These product-specific conditions do not override{' '}
                  <Link href="/refund-policy">Alozuri’s Refund and Cancellation Policy</Link> or
                  your statutory rights.
                </p>
                <p style={{ whiteSpace: 'pre-line' }}>{plan.supplierNotes}</p>
              </section>
            )}
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
                    : 'Network information has not been provided for this plan.'}
                </dd>
              </div>
              <div>
                <dt>Data policy</dt>
                <dd>{plan.fairUse}</dd>
              </div>
              <div>
                <dt>Calls and texts</dt>
                <dd>Data only. Keep your home SIM for your existing number.</dd>
              </div>
            </dl>
            <Link href="/help#compatibility" className="text-link">
              Check device compatibility ↗
            </Link>
          </div>
        </div>
        <aside className="surface purchase-summary">
          <span className="eyebrow">{plan.demo ? 'SAMPLE PLAN' : 'PLAN SUMMARY'}</span>
          <h2>
            {money(plan.priceCents, plan.currency)} <small>{plan.currency}</small>
          </h2>
          <p>
            {dataLabel(plan)} · {plan.days} days
          </p>
          <p>Coverage: {plan.countries.length} destinations</p>
          {plan.demo && (
            <p className="notice">Illustrative sample. This plan cannot be purchased.</p>
          )}
          <button
            className="button primary full-width"
            disabled={Boolean(plan.demo) || adding || limit || !cart.ready || cart.syncing}
            onClick={() => void add()}
          >
            {adding ? 'Adding…' : 'Add to cart'}
          </button>
          <Link
            className="button full-width"
            href={plan.demo ? '#' : '/checkout?buy=' + encodeURIComponent(id)}
            aria-disabled={Boolean(plan.demo)}
          >
            Buy now
          </Link>
          {added && (
            <div role="status" className="success-message">
              <p>Added to your cart.</p>
              <Link href="/destinations">Continue shopping</Link> ·{' '}
              <Link href="/cart">View cart →</Link>
            </div>
          )}
          {(error || limit || cart.error) && (
            <p className="error-message" role="alert">
              {error ||
                (limit ? 'Cart limit reached: five per plan and ten eSIMs per order.' : cart.error)}
            </p>
          )}
          <p className="fine-print">
            Your device must support eSIM and be carrier unlocked. Install over Wi-Fi and follow the
            activation rule.
          </p>
          <Link href="/legal/refunds" className="text-link">
            Refund information
          </Link>
        </aside>
      </div>
    </section>
  );
}
