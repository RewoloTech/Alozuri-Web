'use client';
import { useLocale, useTranslations } from 'next-intl';
import { localeDirection } from '@alozuri/shared/i18n';
import { useEffect, useRef, useState } from 'react';
import Link from '@/components/localized-link';
import { ArrowUpRight, Globe2 } from 'lucide-react';
import { money } from '@alozuri/shared';
import {
  parseFeaturedBundles,
  unavailableBundles,
  type FeaturedBundle,
  type FeaturedRegion,
  type BundleAllowance,
} from '@alozuri/shared/featured';
import { useCurrency } from './currency-provider';
import { api } from '@/lib/api';
export function FeaturedBundles({ initial }: { initial: FeaturedBundle[] | null }) {
  const t = useTranslations('display');
  const plans = useTranslations('plans');
  const locale = useLocale();
  const dir = localeDirection(locale);
  const regionNames: Record<FeaturedRegion, string> = {
    europe: t('europe'),
    asia: t('asia'),
    'north-america': t('northAmerica'),
    global: t('global'),
  };
  const { currency, refresh, ready } = useCurrency();
  const [bundles, setBundles] = useState(initial ?? unavailableBundles()),
    [loadedCurrency, setLoadedCurrency] = useState('USD'),
    [loading, setLoading] = useState(!initial),
    [error, setError] = useState(false);
  const [choices, setChoices] = useState<Partial<Record<FeaturedRegion, BundleAllowance>>>({});
  const loadedRequest = useRef(initial ? 'USD:0' : '');
  useEffect(() => {
    if (!ready) return;
    const requestKey = currency + ':' + refresh;
    if (loadedRequest.current === requestKey) return;
    let active = true;
    setLoading(true);
    setError(false);
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
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currency, refresh, initial, ready]);
  const current = ready && loadedCurrency === currency && !error;
  return (
    <section
      className="section container featured-bundles"
      aria-labelledby="featured-bundles-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="featured-bundles-title">{t('featureTitle')}</h2>
          <p>{t('featureDescription')}</p>
        </div>
      </div>
      {error && <p role="status">{t('featureError')}</p>}
      <div className="featured-grid" dir="ltr" aria-busy={!ready || loading}>
        {bundles.map((bundle) => {
          const selected =
            bundle.options.find((option) => option.dataGb === choices[bundle.region]) ??
            bundle.options.find((option) => option.dataGb === bundle.defaultDataGb);
          return (
            <article
              className="surface featured-card"
              dir={dir}
              key={bundle.region}
              aria-labelledby={'featured-' + bundle.region}
            >
              <div className="featured-card-heading" dir="ltr">
                <h3 id={'featured-' + bundle.region}>{regionNames[bundle.region]}</h3>
                <Globe2 size={23} aria-hidden="true" />
              </div>
              {selected ? (
                <>
                  <p className="featured-spec">
                    <bdi dir="ltr">{selected.dataGb} GB</bdi> ·{' '}
                    {plans('days', { count: selected.validityDays })}
                  </p>
                  <p className="featured-coverage">
                    {t('featureCoverage', { count: selected.countryCount })}
                  </p>
                  <strong className="featured-price" dir="ltr">
                    {current
                      ? money(selected.priceCents, selected.currency)
                      : error
                        ? plans('unavailable')
                        : plans('loadingPrice')}{' '}
                    <small>{ready ? currency : ''}</small>
                  </strong>
                  <fieldset className="featured-allowances" dir="ltr">
                    <legend>
                      {t('featureRegionAllowance', { region: regionNames[bundle.region] })}
                    </legend>
                    {bundle.options.map((option) => (
                      <button
                        type="button"
                        key={option.dataGb}
                        aria-pressed={option.dataGb === selected.dataGb}
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
                    aria-label={t('featureView', {
                      region: regionNames[bundle.region],
                      amount: selected.dataGb,
                    })}
                    href={'/plans/' + encodeURIComponent(selected.productId)}
                  >
                    {plans('view')} <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <>
                  <p className="featured-unavailable">
                    {loading ? t('featureLoading') : t('featureUnavailable')}
                  </p>
                  <p className="fine-print">{t('featureRetry')}</p>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
