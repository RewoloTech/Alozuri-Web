'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Globe2 } from 'lucide-react';
import { money } from '@voyaspan/shared';
import {
  parseFeaturedBundles,
  unavailableBundles,
  type FeaturedBundle,
  type FeaturedRegion,
  type BundleAllowance,
} from '@voyaspan/shared/featured';
import { useCurrency } from './currency-provider';
import { api } from '@/lib/api';
export function FeaturedBundles({ initial }: { initial: FeaturedBundle[] | null }) {
  const { currency, refresh, ready } = useCurrency();
  const [bundles, setBundles] = useState(initial ?? unavailableBundles()),
    [loadedCurrency, setLoadedCurrency] = useState('USD'),
    [loading, setLoading] = useState(!initial),
    [error, setError] = useState('');
  const [choices, setChoices] = useState<Partial<Record<FeaturedRegion, BundleAllowance>>>({});
  const loadedRequest = useRef(initial ? 'USD:0' : '');
  useEffect(() => {
    if (!ready) return;
    const requestKey = currency + ':' + refresh;
    if (loadedRequest.current === requestKey) return;
    let active = true;
    setLoading(true);
    setError('');
    void api<{ bundles: unknown }>('/v1/featured-bundles?currency=' + currency)
      .then((response) => {
        const next = parseFeaturedBundles(response.bundles, currency);
        if (!next) throw new Error('Bundle prices could not be loaded.');
        if (active) {
          setBundles(next);
          setLoadedCurrency(currency);
          loadedRequest.current = requestKey;
        }
      })
      .catch(() => {
        if (active) setError('Bundle prices are temporarily unavailable. Please try again later.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currency, refresh, initial, ready]);
  const current = ready && loadedCurrency === currency;
  return (
    <section
      className="section container featured-bundles"
      aria-labelledby="featured-bundles-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="featured-bundles-title">Explore Regional &amp; Global eSIMs</h2>
          <p>Compare data allowances and coverage for your next trip.</p>
        </div>
      </div>
      {error && <p role="status">{error}</p>}
      <div className="featured-grid" aria-busy={!ready || loading}>
        {bundles.map((bundle) => {
          const selected =
            bundle.options.find((option) => option.dataGb === choices[bundle.region]) ??
            bundle.options.find((option) => option.dataGb === bundle.defaultDataGb);
          return (
            <article
              className="surface featured-card"
              key={bundle.region}
              aria-labelledby={'featured-' + bundle.region}
            >
              <div className="featured-card-heading">
                <h3 id={'featured-' + bundle.region}>{bundle.regionName}</h3>
                <Globe2 size={23} aria-hidden="true" />
              </div>
              {selected ? (
                <>
                  <p className="featured-spec">
                    {selected.dataGb} GB · {selected.validityDays} days
                  </p>
                  <p className="featured-coverage">Covers {selected.countryCount} countries</p>
                  <strong className="featured-price">
                    {current ? money(selected.priceCents, selected.currency) : '—'}{' '}
                    <small>{ready ? currency : ''}</small>
                  </strong>
                  <fieldset className="featured-allowances">
                    <legend>Data allowance for {bundle.regionName}</legend>
                    {bundle.options.map((option) => (
                      <button
                        type="button"
                        key={option.dataGb}
                        aria-pressed={option.dataGb === selected.dataGb}
                        disabled={!current || loading}
                        onClick={() =>
                          setChoices((previous) => ({
                            ...previous,
                            [bundle.region]: option.dataGb,
                          }))
                        }
                      >
                        {option.dataGb} GB
                      </button>
                    ))}
                  </fieldset>
                  <Link
                    className="button primary"
                    aria-label={'View ' + bundle.regionName + ' ' + selected.dataGb + ' GB plan'}
                    aria-disabled={!current || loading}
                    href={'/plans/' + encodeURIComponent(selected.productId)}
                    onClick={(event) => {
                      if (!current || loading) event.preventDefault();
                    }}
                  >
                    View plan <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <>
                  <p className="featured-unavailable">
                    {loading ? 'Loading current plans…' : 'Plans currently unavailable'}
                  </p>
                  <p className="fine-print">Please check again later.</p>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
