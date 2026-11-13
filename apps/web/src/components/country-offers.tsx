'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { countryName } from '@alozuri/shared';
import type { Plan } from '@alozuri/shared';
import { PlanCard } from './planner';
import { useCurrency } from './currency-provider';
import { api } from '@/lib/api';
export function CountryOffers({
  code,
  initial,
  coverage = 'local',
}: {
  code: string;
  initial: Plan[];
  coverage?: 'local' | 'all';
}) {
  const { currency, refresh, ready } = useCurrency(),
    [plans, setPlans] = useState(initial),
    [error, setError] = useState('');
  useEffect(() => {
    if (!ready) return;
    if (currency === 'USD') {
      setPlans(initial);
      setError('');
      return;
    }
    let active = true;
    // Keep card geometry while the existing API supplies the selected currency.
    // PlanCard hides a stale currency's amount until matching prices arrive.
    setError('');
    void api<{ plans: Plan[] }>(
      '/v1/packages/match?' + new URLSearchParams({ countries: code, coverage, currency }),
    )
      .then((r) => {
        if (active) {
          setPlans(r.plans.slice(0, 6));
          setError('');
        }
      })
      .catch(() => {
        if (active)
          setError('Current currency prices could not be loaded. Use the planner to retry.');
      });
    return () => {
      active = false;
    };
  }, [code, currency, refresh, initial, ready, coverage]);
  if (!initial.length && !plans.length)
    return (
      <p>
        Current plan availability could not be confirmed here. Use the planner below to check
        current options; no price or coverage is promised until verified.
      </p>
    );
  return (
    <section
      className="section"
      aria-label={coverage === 'local' ? 'Current local plans' : 'Current multi-country plans'}
    >
      <h2>{coverage === 'local' ? 'Local plans to explore' : 'Multi-country plans to explore'}</h2>
      <p>
        Review the full plan conditions and current checkout total before purchasing. Use the
        planner to compare all allowances and regional coverage.
      </p>
      {error && <p role="status">{error}</p>}
      <div className="plan-grid">
        {plans.map((p) => (
          <div key={p.id}>
            <PlanCard plan={p} />
            <details className="country-plan-conditions">
              <summary>Coverage, networks and activation</summary>
              <p>Included countries: {p.countries.map(countryName).join(', ')}.</p>
              <p>
                Networks:{' '}
                {p.networks.length
                  ? p.networks.join(', ')
                  : 'Not supplied for this package; no named operator is promised.'}
              </p>
              <p>Activation: {p.activation}</p>
              <p>Data policy: {p.fairUse}</p>
              <Link href={'/plans/' + p.id}>Full plan specifications and current price</Link>
            </details>
          </div>
        ))}
      </div>
    </section>
  );
}
