'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { countries, type Country } from '@voyaspan/shared';
import { api, demoMode } from '@/lib/api';
export function DestinationDirectory() {
  const [items, setItems] = useState<Country[]>(demoMode ? countries : []),
    [query, setQuery] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    if (demoMode) return;
    let active = true;
    void api<{ countries: Country[] }>('/v1/countries')
      .then((r) => {
        if (active) setItems(r.countries);
      })
      .catch(() => {
        if (active) setError('Could not load destinations. Please refresh and try again.');
      });
    return () => {
      active = false;
    };
  }, []);
  const filtered = items.filter((c) =>
    (c.name + ' ' + c.code).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <label className="settings-form">
        Search destinations
        <input
          type="search"
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
            <span className="country-emoji">{c.flag}</span>
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
