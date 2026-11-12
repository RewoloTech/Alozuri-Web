'use client';
import { useEffect, useRef, useState } from 'react';
import { PricingHistory } from './pricing-history';
import type { OperationsReport } from '@alozuri/shared/financial';
import { londonMonth } from '@alozuri/shared/financial';
import { OperationsCountries } from './operations-countries';
import { AccountGate } from './account-gate';
import { useAuth } from './auth-provider';
import { api } from '@/lib/api';
type Status = {
  mode: string;
  paymentsEnabled: boolean;
  supplierConnected: boolean;
  catalogueCount: number;
};
const gbp = (value: number | null) =>
  value === null
    ? 'Pending'
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value / 100);
const original = (value: number, currency: string) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value / 100);
const margin = (value: number | null) => (value === null ? '—' : `${(value / 100).toFixed(2)}%`);
export function Operations() {
  const { user } = useAuth();
  return (
    <AccountGate next="/operations">
      <OperationsAccount key={user?.uid ?? 'signed-out'} />
    </AccountGate>
  );
}
function OperationsAccount() {
  const { user, admin } = useAuth();
  const [section, setSection] = useState<'financial' | 'pricing'>('financial');
  const navigation = useRef<HTMLDivElement>(null);
  const [dates, setDates] = useState(() => londonMonth());
  const [authorized, setAuthorized] = useState(false),
    [status, setStatus] = useState<Status | null>(null),
    [accessError, setAccessError] = useState(''),
    [statusError, setStatusError] = useState('');
  const [report, setReport] = useState<OperationsReport | null>(null),
    [cursor, setCursor] = useState<string | undefined>(),
    [history, setHistory] = useState<(string | undefined)[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!user) return;
    setAuthorized(false);
    setReport(null);
    setAccessError('');
    let active = true;
    const controller = new AbortController();
    void api<{ authorized: true }>('/v1/operations/access', { signal: controller.signal }, user.uid)
      .then(() => {
        if (!active) return;
        setAuthorized(true);
        void api<Status>('/v1/operations/status', { signal: controller.signal }, user.uid)
          .then((result) => {
            if (active) setStatus(result);
          })
          .catch(() => {
            if (active) setStatusError('Service configuration status is temporarily unavailable.');
          });
      })
      .catch(() => {
        if (active) setAccessError('Administrator access is required to open Operations.');
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [user, admin]);
  useEffect(() => {
    if (!authorized || !user || section !== 'financial') return;
    const controller = new AbortController();
    let active = true;
    setError('');
    setBusy(true);
    if (!dates.from || !dates.to || dates.from > dates.to) {
      setReport(null);
      setError('Choose a valid date range.');
      setBusy(false);
      return;
    }
    const query = new URLSearchParams(dates);
    if (cursor) query.set('cursor', cursor);
    void api<OperationsReport>(
      '/v1/operations/financials?' + query,
      { signal: controller.signal },
      user.uid,
    )
      .then((value) => {
        if (active) setReport(value);
      })
      .catch((e) => {
        if (active) {
          setReport(null);
          setError(e instanceof Error ? e.message : 'Financial reporting is unavailable.');
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [authorized, user, dates, cursor, attempt, section]);
  const current = report?.from === dates.from && report.to === dates.to && !busy ? report : null;
  const change = (key: 'from' | 'to', value: string) => {
    setDates((d) => ({ ...d, [key]: value }));
    setCursor(undefined);
    setHistory([]);
  };
  return (
    <section className="container section operations-page">
      <div className="page-intro">
        <span className="eyebrow">ALOZURI OPERATIONS</span>
        <h1>Operations</h1>
        <p>Sales and profit before other operating expenses and taxes.</p>
      </div>
      {accessError ? (
        <p role="alert" className="error-message">
          {accessError}
        </p>
      ) : !authorized ? (
        <p role="status">Checking administrator access…</p>
      ) : (
        <>
          <div
            className="operations-tabs"
            role="tablist"
            aria-label="Operations sections"
            ref={navigation}
            onKeyDown={(event) => {
              const options = ['financial', 'pricing'] as const;
              const index = section === 'financial' ? 0 : 1;
              const next =
                event.key === 'ArrowRight' || event.key === 'ArrowLeft'
                  ? 1 - index
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? 1
                      : null;
              if (next === null) return;
              event.preventDefault();
              setSection(options[next]);
              navigation.current
                ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                [next]?.focus();
            }}
          >
            <button
              type="button"
              role="tab"
              id="operations-financial-tab"
              aria-selected={section === 'financial'}
              aria-controls="operations-financial-panel"
              tabIndex={section === 'financial' ? 0 : -1}
              onClick={() => setSection('financial')}
            >
              Financial Overview
            </button>
            <button
              type="button"
              role="tab"
              id="operations-pricing-tab"
              aria-selected={section === 'pricing'}
              aria-controls="operations-pricing-panel"
              tabIndex={section === 'pricing' ? 0 : -1}
              onClick={() => setSection('pricing')}
            >
              Pricing History
            </button>
          </div>
          <div
            role="tabpanel"
            id="operations-pricing-panel"
            aria-labelledby="operations-pricing-tab"
            hidden={section !== 'pricing'}
            tabIndex={0}
          >
            {section === 'pricing' && user && <PricingHistory uid={user.uid} />}
          </div>
          <div
            role="tabpanel"
            id="operations-financial-panel"
            aria-labelledby="operations-financial-tab"
            hidden={section !== 'financial'}
            tabIndex={0}
          >
            {section === 'financial' && (
              <>
                <div className="surface operations-dates">
                  <label>
                    From Date
                    <input
                      type="date"
                      value={dates.from}
                      max={dates.to || undefined}
                      onChange={(e) => change('from', e.target.value)}
                    />
                  </label>
                  <label>
                    To Date
                    <input
                      type="date"
                      value={dates.to}
                      min={dates.from || undefined}
                      onChange={(e) => change('to', e.target.value)}
                    />
                  </label>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => setAttempt((n) => n + 1)}
                  >
                    Refresh
                  </button>
                </div>
                <p className="fine-print">
                  Inclusive dates in Europe/London, based on order creation time. Refunds adjust the
                  original order. GBP supplier valuations use the frozen historical reference rate;
                  these are not supplier bank conversion charges. Test payments are excluded.
                </p>
                {busy && <p role="status">Loading financial report…</p>}
                {error && (
                  <p role="alert" className="error-message">
                    {error}
                  </p>
                )}
                {current && (
                  <>
                    {current.summary.provisional > 0 && (
                      <p role="status" className="notice">
                        {current.summary.provisional} paid order(s) have provisional financials.
                        Pending costs or fees prevent a final profit figure. Missing amounts are
                        never treated as zero.
                      </p>
                    )}
                    <div className="operations-metrics">
                      {[
                        ['Total Sales', String(current.summary.sales)],
                        ['Total Revenue', gbp(current.summary.revenueGbp)],
                        ['Supplier Costs', gbp(current.summary.supplierGbp)],
                        ['Stripe Fees', gbp(current.summary.feesGbp)],
                        ['Profit', gbp(current.summary.profitGbp)],
                        ['Profit Margin', margin(current.summary.marginBps)],
                      ].map(([label, value]) => (
                        <div className="surface" key={label}>
                          <h2>{label}</h2>
                          <strong>{value}</strong>
                          {label !== 'Total Sales' && (
                            <small>
                              {label === 'Profit Margin'
                                ? current.summary.provisional
                                  ? 'Provisional'
                                  : 'Percentage'
                                : current.summary.provisional
                                  ? 'Provisional · GBP'
                                  : 'GBP'}
                            </small>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="surface operations-transactions">
                      <h2>Transactions</h2>
                      <p className="fine-print">
                        Includes unpaid checkout attempts. Summary totals include confirmed payments
                        only.
                      </p>
                      <p className="fine-print operations-table-hint">
                        Scroll horizontally to see all transaction columns.
                      </p>
                      {!current.rows.length ? (
                        <p>No orders in this date range.</p>
                      ) : (
                        <div
                          className="operations-table-scroll"
                          tabIndex={0}
                          role="region"
                          aria-label="Financial transactions"
                        >
                          <table>
                            <caption className="sr-only">
                              Order financials in GBP with original currencies
                            </caption>
                            <thead>
                              <tr>
                                {[
                                  'Date',
                                  'Order',
                                  'Destination',
                                  'Package',
                                  'Supplier Cost',
                                  'Selling Price',
                                  'Stripe Fee',
                                  'Profit',
                                  'Margin',
                                  'Status',
                                ].map((h) => (
                                  <th scope="col" key={h}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {current.rows.map((r) => (
                                <tr key={r.id}>
                                  <td>
                                    {new Intl.DateTimeFormat('en-GB', {
                                      timeZone: 'Europe/London',
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    }).format(new Date(r.createdAt))}
                                  </td>
                                  <td>{r.reference}</td>
                                  <td>
                                    {r.packages.map((p, i) => (
                                      <div key={i}>
                                        <OperationsCountries countries={p.countries} />
                                      </div>
                                    ))}
                                  </td>
                                  <td>
                                    {r.packages.map((p, i) => (
                                      <div key={i}>
                                        {p.quantity} × {p.name}
                                      </div>
                                    ))}
                                  </td>
                                  <td>
                                    {r.paid ? gbp(r.supplierGbp) : '—'}
                                    <small>
                                      {!r.paid
                                        ? 'Payment not confirmed'
                                        : r.supplier.purchasedUnits === null
                                          ? 'Supplier outcome pending'
                                          : `USD ${(r.supplier.purchasedUnits / 10000).toFixed(4)}`}
                                    </small>
                                  </td>
                                  <td>
                                    {r.paid
                                      ? gbp(r.revenueGbp)
                                      : original(r.selling.amountMinor, r.selling.currency)}
                                    {!r.paid && <small>Unpaid · excluded from totals</small>}
                                    {r.paid &&
                                      (r.selling.currency !== 'GBP' ||
                                        r.selling.refundedMinor === null ||
                                        (r.selling.refundedMinor !== null &&
                                          r.selling.refundedMinor > 0)) && (
                                        <small>
                                          Paid {original(r.selling.amountMinor, r.selling.currency)}
                                          {r.selling.refundedMinor === null &&
                                            ' · refunds not reconciled'}
                                          {r.selling.refundedMinor !== null &&
                                            r.selling.refundedMinor > 0 &&
                                            ` · refunded ${original(r.selling.refundedMinor, r.selling.currency)}`}
                                        </small>
                                      )}
                                  </td>
                                  <td>
                                    {gbp(r.feesGbp)}
                                    {r.stripe.feeMinor !== null &&
                                      r.stripe.currency &&
                                      r.stripe.currency !== 'gbp' && (
                                        <small>
                                          {original(
                                            r.stripe.feeMinor,
                                            r.stripe.currency.toUpperCase(),
                                          )}
                                        </small>
                                      )}
                                  </td>
                                  <td>{r.paid ? gbp(r.profitGbp) : '—'}</td>
                                  <td>{r.paid ? margin(r.marginBps) : '—'}</td>
                                  <td>
                                    {r.paymentStatus === 'pending_payment'
                                      ? 'Awaiting payment'
                                      : r.paymentStatus.replaceAll('_', ' ')}
                                    <small>
                                      {r.paid
                                        ? `${r.fulfilmentStatus.replaceAll('_', ' ')} · ${r.calculationStatus === 'final' ? 'Final' : 'Provisional'}`
                                        : 'No confirmed sale'}
                                    </small>
                                    {r.paid && r.reasons.length > 0 && (
                                      <details>
                                        <summary>Pending details</summary>
                                        <ul>
                                          {r.reasons.map((reason) => (
                                            <li key={reason}>{reason}</li>
                                          ))}
                                        </ul>
                                      </details>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="operations-pagination">
                        <button
                          className="button"
                          disabled={!history.length || busy}
                          onClick={() => {
                            setCursor(history.at(-1));
                            setHistory((h) => h.slice(0, -1));
                          }}
                        >
                          Previous
                        </button>
                        <button
                          className="button"
                          disabled={!current.nextCursor || busy}
                          onClick={() => {
                            setHistory((h) => [...h, cursor]);
                            setCursor(current.nextCursor ?? undefined);
                          }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          {statusError && <p role="status">{statusError}</p>}
          {status && (
            <details className="surface operations-service">
              <summary>Service status</summary>
              <dl className="spec-list">
                <div>
                  <dt>Mode</dt>
                  <dd>{status.mode}</dd>
                </div>
                <div>
                  <dt>Catalogue</dt>
                  <dd>{status.catalogueCount} plans</dd>
                </div>
                <div>
                  <dt>Payments configured</dt>
                  <dd>{status.paymentsEnabled ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt>Supplier configuration</dt>
                  <dd>{status.supplierConnected ? 'Configured' : 'Not configured'}</dd>
                </div>
              </dl>
              <p className="fine-print">
                Configuration indicators are not live provider health checks.
              </p>
            </details>
          )}
        </>
      )}
    </section>
  );
}
