'use client';
import { useEffect, useState } from 'react';
import type { Plan } from '@alozuri/shared';
import { PlanCard } from './planner';
import { useCurrency } from './currency-provider';
import { api } from '@/lib/api';
export function CountryOffers({ code, initial }: { code: string; initial: Plan[] }) {
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
    setPlans([]);
    void api<{ plans: Plan[] }>(
      '/v1/packages/match?' + new URLSearchParams({ countries: code, coverage: 'local', currency }),
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
  }, [code, currency, refresh, initial, ready]);
  if (!initial.length && !plans.length) return null;
  return (
    <section className="section" aria-label="Current local plans">
      <h2>Local plans to explore</h2>
      <p>
        Review the full plan conditions and current checkout total before purchasing. Use the
        planner to compare all allowances and regional coverage.
      </p>
      {error && <p role="status">{error}</p>}
      <div className="plan-grid">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
      </div>
    </section>
  );
}
