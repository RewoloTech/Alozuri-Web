'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  countries,
  countryFlag,
  uniqueDestinations,
  filterDestinations,
  type Country,
} from '@alozuri/shared';
import { api, demoMode } from '@/lib/api';
export function DestinationDirectory({ initial = [] }: { initial?: Country[] }) {
  const [items, setItems] = useState<Country[]>(
      initial.length ? uniqueDestinations(initial) : demoMode ? countries : [],
    ),
    [query, setQuery] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    if (demoMode) return;
    let active = true;
    void api<{ countries: Country[] }>('/v1/countries')
      .then((r) => {
        if (active) setItems(uniqueDestinations(r.countries));
      })
      .catch(() => {
        if (active) setError('Could not load destinations. Please refresh and try again.');
      });
    return () => {
      active = false;
    };
  }, []);
  const filtered = filterDestinations(items, query);
  return (
    <>
      <label className="settings-form">
        Search destinations
        <input
          type="search"
          maxLength={80}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a country…"
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <p>{items.length ? `${items.length} available destinations` : 'Loading destinations…'}</p>
      <div className="country-grid">
        {filtered.map((c) => (
          <Link
            className="country-tile"
            key={c.code}
            href={`/destinations/${c.code.toLowerCase()}`}
          >
            <span className="country-emoji">{countryFlag(c.code)}</span>
            <span>
              <strong>{c.name}</strong>
              <small>Compare data plans</small>
            </span>
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </div>
    </>
  );
}
