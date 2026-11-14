'use client';
import { useEffect, useState } from 'react';
import type { PricingHistoryReport } from '@alozuri/shared/pricing-history';
import { londonMonth } from '@alozuri/shared/financial';
import { OperationsCountries } from './operations-countries';
import { api } from '@/lib/api';
const supplier = (value: number | null) =>
  value === null
    ? 'Not recorded'
    : `USD ${(BigInt(value) / 10000n).toLocaleString('en-US')}.${String(BigInt(value) % 10000n).padStart(4, '0')}`;
const selling = (value: number | null) =>
  value === null
    ? 'Not recorded'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
const percent = (value: number | null) =>
  value === null ? '—' : `${value > 0 ? '+' : ''}${(value / 100).toFixed(2)}%`;
const margin = (value: number | null) =>
  value === null ? 'Not recorded' : `${(value / 100).toFixed(2)}%`;
const directionLabels = {
  increased: '↑ Increased',
  decreased: '↓ Decreased',
  unchanged: '— Unchanged',
  baseline: 'New baseline',
  unavailable: 'Price unavailable',
};
export function PricingHistory({ uid }: { uid: string }) {
  const [dates, setDates] = useState(() => londonMonth()),
    [draftSearch, setDraftSearch] = useState(''),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [report, setReport] = useState<PricingHistoryReport | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [cursor, setCursor] = useState<string | undefined>(),
    [history, setHistory] = useState<(string | undefined)[]>([]),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setBusy(true);
    setError('');
    setReport(null);
    if (!dates.from || !dates.to || dates.from > dates.to) {
      setBusy(false);
      setError('Choose a valid pricing date range.');
      return;
    }
    const query = new URLSearchParams(dates);
    if (search) query.set('q', search);
    if (selected) query.set('packageId', selected.id);
    if (cursor) query.set('cursor', cursor);
    void api<PricingHistoryReport>(
      '/v1/operations/pricing-history?' + query,
      { signal: controller.signal },
      uid,
    )
      .then((value) => {
        if (active) setReport(value);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Pricing history could not load.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [uid, dates, selected, cursor, attempt, search]);
  const reset = () => {
    setCursor(undefined);
    setHistory([]);
  };
  const current =
    report?.from === dates.from &&
    (report.query ?? '') === search &&
    report.to === dates.to &&
    report.packageId === (selected?.id ?? null) &&
    !busy
      ? report
      : null;
  return (
    <>
      <h2>Pricing History</h2>
      <p className="fine-print">
        Catalogue supplier and selling prices in USD. Prices are snapshots at the listed date;
        current means after that recorded change. Gross margin is before Stripe fees, other
        operating expenses and taxes; it is not the profit earned on an order. Dates use
        Europe/London.
      </p>
      <div className="surface operations-dates">
        <label>
          From Date
          <input
            type="date"
            value={dates.from}
            max={dates.to || undefined}
            onChange={(e) => {
              setDates((d) => ({ ...d, from: e.target.value }));
              reset();
            }}
          />
        </label>
        <label>
          To Date
          <input
            type="date"
            value={dates.to}
            min={dates.from || undefined}
            onChange={(e) => {
              setDates((d) => ({ ...d, to: e.target.value }));
              reset();
            }}
          />
        </label>
        <button className="button" disabled={busy} onClick={() => setAttempt((n) => n + 1)}>
          Refresh pricing
        </button>
      </div>
      <form
        className="surface operations-esim-search"
        role="search"
        aria-label="Search pricing history"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(draftSearch.trim());
          reset();
          setAttempt((n) => n + 1);
        }}
      >
        <label htmlFor="pricing-history-search">Search pricing history</label>
        <p className="fine-print">
          Package name, package ID or destination within the selected dates.
        </p>
        <input
          id="pricing-history-search"
          type="search"
          className="commerce-input"
          maxLength={80}
          value={draftSearch}
          onChange={(e) => setDraftSearch(e.target.value)}
          placeholder="For example, United Kingdom or Europe"
        />
        <button className="button" type="submit" disabled={busy}>
          Search prices
        </button>
        {search && (
          <button
            className="button"
            type="button"
            onClick={() => {
              setSearch('');
              setDraftSearch('');
              reset();
            }}
          >
            Clear search
          </button>
        )}
      </form>
      {selected && (
        <div className="pricing-selection">
          <p>
            Price trend: <strong>{selected.name}</strong>
          </p>
          <button
            className="button"
            onClick={() => {
              setSelected(null);
              reset();
            }}
          >
            All packages
          </button>
        </div>
      )}
      {busy && <p role="status">Loading pricing history…</p>}
      {error && (
        <div role="alert">
          <p className="error-message">{error}</p>
          <button className="button" onClick={() => setAttempt((n) => n + 1)}>
            Retry pricing history
          </button>
        </div>
      )}
      {current && (
        <div className="surface operations-transactions pricing-history-table">
          {!current.rows.length ? (
            <p role="status">
              {search
                ? current.nextCursor
                  ? 'No matches in the history checked so far. Continue searching to check older records.'
                  : 'No pricing history matches your search in this date range.'
                : 'No pricing history recorded in this date range. Try an earlier date range to see older changes.'}
            </p>
          ) : (
            <>
              <p className="fine-print operations-table-hint">
                Scroll horizontally to see all pricing columns.
              </p>
              <div
                className="operations-table-scroll"
                role="region"
                aria-label={selected ? 'Package price trend' : 'Catalogue pricing history'}
                tabIndex={0}
              >
                <table>
                  <caption className="sr-only">
                    Historical catalogue price movements, newest first
                  </caption>
                  <thead>
                    <tr>
                      {[
                        'Package and destination',
                        'Previous supplier price',
                        'Current supplier price',
                        'Price change (%)',
                        'Previous selling price',
                        'Current selling price',
                        'Profit margin',
                        'Last change date',
                      ].map((label) => (
                        <th scope="col" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.rows.map((row) => (
                      <tr key={row.packageId + ':' + row.id}>
                        <td>
                          <strong>{row.name}</strong>
                          <OperationsCountries countries={row.countries} />
                          {row.identitySource === 'current_catalogue' && (
                            <small>
                              Current name and destination; historical values not recorded.
                            </small>
                          )}
                          {row.identitySource === 'unavailable' && (
                            <small>Package label unavailable.</small>
                          )}
                          {row.active === false && <small>Inactive / unavailable</small>}
                          {!selected && (
                            <button
                              className="text-link"
                              aria-label={'View price history for ' + row.name}
                              onClick={() => {
                                setSelected({ id: row.packageId, name: row.name });
                                setSearch('');
                                setDraftSearch('');
                                reset();
                              }}
                            >
                              View history
                            </button>
                          )}
                        </td>
                        <td>{supplier(row.previousSupplierUnits)}</td>
                        <td>{supplier(row.currentSupplierUnits)}</td>
                        <td>
                          <span className={'price-direction price-direction-' + row.direction}>
                            {directionLabels[row.direction]}
                          </span>
                          <small>{percent(row.changeBps)}</small>
                        </td>
                        <td>{selling(row.previousSellingMinor)}</td>
                        <td>{selling(row.currentSellingMinor)}</td>
                        <td>
                          {margin(row.currentMarginBps)}
                          <small>Previously {margin(row.previousMarginBps)}</small>
                          {row.marginChangeBps !== null && (
                            <small>
                              {row.marginChangeBps > 0 ? '+' : ''}
                              {(row.marginChangeBps / 100).toFixed(2)} percentage points
                            </small>
                          )}
                        </td>
                        <td>
                          {new Intl.DateTimeFormat('en-GB', {
                            timeZone: 'Europe/London',
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(row.recordedAt))}
                          <small>
                            {row.kind === 'checkout_revalidation'
                              ? 'Checkout revalidation'
                              : 'Catalogue sync'}
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="fine-print">
            Unchanged-price entries can record availability or review-state changes. Unchanged daily
            syncs do not add duplicate price points.
          </p>
          <div className="operations-pagination">
            <button
              className="button"
              disabled={!history.length || busy}
              onClick={() => {
                setCursor(history.at(-1));
                setHistory((h) => h.slice(0, -1));
              }}
            >
              Previous prices
            </button>
            <button
              className="button"
              disabled={!current.nextCursor || busy}
              onClick={() => {
                setHistory((h) => [...h, cursor]);
                setCursor(current.nextCursor ?? undefined);
              }}
            >
              {search ? 'Search older history' : 'Next prices'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
