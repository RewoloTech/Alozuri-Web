'use client';
import { useEffect, useState } from 'react';
import Link from '@/components/localized-link';
import { useTranslations } from 'next-intl';
import { usePlanCopy } from '@/lib/use-plan-copy';
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
  const t = useTranslations('countryUi');
  const cart = useTranslations('cart');
  const info = useTranslations('planInfo');
  const copy = usePlanCopy();
  const { currency, refresh, ready } = useCurrency(),
    [plans, setPlans] = useState(initial),
    [error, setError] = useState(false);
  useEffect(() => {
    if (!ready) return;
    if (currency === 'USD') {
      setPlans(initial);
      setError(false);
      return;
    }
    let active = true;
    // Keep card geometry while the existing API supplies the selected currency.
    // PlanCard hides a stale currency's amount until matching prices arrive.
    setError(false);
    void api<{ plans: Plan[] }>(
      '/v1/packages/match?' + new URLSearchParams({ countries: code, coverage, currency }),
    )
      .then((r) => {
        if (active) {
          setPlans(r.plans.slice(0, 6));
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [code, currency, refresh, initial, ready, coverage]);
  if (!initial.length && !plans.length) return <p>{t('availabilityHint')}</p>;
  return (
    <section
      className="section"
      aria-label={coverage === 'local' ? t('localPlans') : t('multiPlans')}
    >
      <h2>{coverage === 'local' ? t('localPlans') : t('multiPlans')}</h2>
      <p>{t('review')}</p>
      {error && <p role="status">{t('pricesError')}</p>}
      <div className="plan-grid" dir="ltr">
        {plans.map((p) => (
          <div key={p.id}>
            <PlanCard plan={p} />
            <details className="country-plan-conditions" dir={copy.dir}>
              <summary>{t('conditions')}</summary>
              <p>{cart('coverage', { countries: p.countries.map(copy.country).join(', ') })}</p>
              <p>
                {info('networks')}:{p.networks.length ? p.networks.join(', ') : t('networkMissing')}
              </p>
              <p>{cart('activation', { rule: copy.activation(p.activation) })}</p>
              <p>
                {info('dataPolicy')}: {copy.fairUse(p.fairUse)}
              </p>
              <Link href={'/plans/' + p.id}>{t('fullSpecs')}</Link>
            </details>
          </div>
        ))}
      </div>
    </section>
  );
}
