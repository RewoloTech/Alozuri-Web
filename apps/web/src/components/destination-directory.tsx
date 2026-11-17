'use client';
import { useLocale, useTranslations } from 'next-intl';
import { destinationName } from '@alozuri/shared/i18n/destinations';
import { localeDirection } from '@alozuri/shared/i18n';
import { useEffect, useState } from 'react';
import Link from '@/components/localized-link';
import {
  countries,
  countryFlag,
  uniqueDestinations,
  filterDestinations,
  type Country,
} from '@alozuri/shared';
import { api, demoMode } from '@/lib/api';
export function DestinationDirectory({ initial = [] }: { initial?: Country[] }) {
  const t = useTranslations('countryUi');
  const search = useTranslations('search');
  const locale = useLocale();
  const [items, setItems] = useState<Country[]>(
      initial.length ? uniqueDestinations(initial) : demoMode ? countries : [],
    ),
    [query, setQuery] = useState(''),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(!initial.length && !demoMode);
  useEffect(() => {
    if (demoMode) return;
    let active = true;
    void api<{ countries: Country[] }>('/v1/countries')
      .then((r) => {
        if (active) setItems(uniqueDestinations(r.countries));
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
  }, []);
  const native = items.map((country) => ({
    ...country,
    name: destinationName(country.code, locale),
  }));
  const matches = new Set(
    [...filterDestinations(items, query), ...filterDestinations(native, query)].map(
      (country) => country.code,
    ),
  );
  const filtered = native
    .filter((country) => matches.has(country.code))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  return (
    <>
      <label className="settings-form">
        {t('search')}
        <input
          type="search"
          maxLength={80}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={search('searchPlaceholder')}
        />
      </label>
      {error && <p role="alert">{search('destinationsError')}</p>}
      <p>
        {items.length
          ? t('available', { count: items.length })
          : loading
            ? search('loadingDestinations')
            : search('noDestinations')}
      </p>
      {!loading && items.length > 0 && !filtered.length && (
        <p role="status">{search('noDestinations')}</p>
      )}
      <div className="country-grid" dir="ltr">
        {filtered.map((c) => (
          <Link
            className="country-tile"
            dir="ltr"
            key={c.code}
            href={`/destinations/${c.code.toLowerCase()}`}
          >
            <span className="country-emoji">{countryFlag(c.code)}</span>
            <span dir={localeDirection(locale)}>
              <strong>{c.name}</strong>
              <small>{t('compare')}</small>
            </span>
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </div>
    </>
  );
}
