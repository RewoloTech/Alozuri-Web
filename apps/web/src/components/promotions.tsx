'use client';
import { useEffect, useRef, useState } from 'react';
import type { OperationsReport } from '@alozuri/shared/financial';
import { api } from '@/lib/api';
type Promotion = {
  code: string;
  discountPercent: number;
  active: boolean;
  startsAt: string;
  expiresAt: string;
  maxUses: number | null;
  redemptionCount: number;
  reservedCount: number;
  totals: Record<string, { revenueMinor: number; discountMinor: number }>;
};
type Preview = {
  originalMinor: number;
  discountMinor: number;
  finalMinor: number;
  supplierMinor: number;
  estimatedFeeMinor: number;
  contributionMinor: number;
  marginBps: number;
  warning: string;
  feeBasis: string;
};
const usd = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' }).format(n / 100);
export function PromotionsPanel({ uid }: { uid: string }) {
  const [rows, setRows] = useState<Promotion[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [cursor, setCursor] = useState<string | undefined>(),
    [next, setNext] = useState<string | null>(null);
  const [code, setCode] = useState(''),
    [percent, setPercent] = useState(10),
    [active, setActive] = useState(true),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [limit, setLimit] = useState(''),
    [editing, setEditing] = useState(false);
  const [packageSearch, setPackageSearch] = useState(''),
    [packages, setPackages] = useState<{ id: string; name: string }[]>([]),
    [packageId, setPackageId] = useState(''),
    [preview, setPreview] = useState<Preview | null>(null);
  const selection = useRef('');
  useEffect(() => {
    selection.current = JSON.stringify([packageId, percent]);
  }, [packageId, percent]);
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    const params = new URLSearchParams({ q });
    if (status) params.set('active', status);
    if (cursor) params.set('after', cursor);
    setBusy(true);
    setError('');
    void api<{ rows: Promotion[]; nextCursor: string | null }>(
      '/v1/operations/promotions?' + params,
      { signal: controller.signal },
      uid,
    )
      .then((r) => {
        if (live) {
          setRows(r.rows);
          setNext(r.nextCursor);
        }
      })
      .catch((e: unknown) => {
        if (live) {
          setRows([]);
          setError(e instanceof Error ? e.message : 'Could not load promotions.');
        }
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [uid, q, status, cursor, attempt]);
  async function check() {
    setError('');
    setPreview(null);
    try {
      const requested = selection.current;
      const result = await api<Preview>(
        '/v1/operations/promotions/preview',
        { method: 'POST', body: JSON.stringify({ packageId, discountPercent: percent }) },
        uid,
      );
      if (selection.current === requested) setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    }
  }
  async function save() {
    setSaved(false);
    const missing: string[] = [];
    if (!/^[A-Z0-9_-]{3,32}$/.test(code.trim()))
      missing.push('Enter a code of 3–32 letters, numbers, hyphens or underscores.');
    if (!Number.isInteger(percent) || percent < 1 || percent > 50)
      missing.push('Choose a whole-number discount between 1% and 50%.');
    const starts = Date.parse(start + 'Z'),
      expires = Date.parse(end + 'Z');
    if (!Number.isFinite(starts)) missing.push('Set the start date and time (UTC).');
    if (!Number.isFinite(expires)) missing.push('Set the expiry date and time (UTC).');
    if (Number.isFinite(starts) && Number.isFinite(expires) && starts >= expires)
      missing.push('Set an expiry later than the start date.');
    if (limit && (!Number.isSafeInteger(Number(limit)) || Number(limit) <= 0))
      missing.push('Enter a positive whole-number usage limit, or leave it empty.');
    if (!preview)
      missing.push(
        'Choose a package and click Preview impact before saving. Profitability warnings do not prevent saving.',
      );
    setSaveError(missing.join(' '));
    if (missing.length) return;
    setBusy(true);
    setError('');
    try {
      await api(
        '/v1/operations/promotions',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify({
            code,
            discountPercent: percent,
            active,
            startsAt: new Date(start + 'Z').toISOString(),
            expiresAt: new Date(end + 'Z').toISOString(),
            maxUses: limit ? Number(limit) : null,
          }),
        },
        uid,
      );
      setSaved(true);
      setAttempt((n) => n + 1);
      setCode('');
      setEditing(false);
      setPreview(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="promotions-panel">
      <h2>Promotions</h2>
      <p>One code per order. Maximum discount 50%. Profitability warnings are advisory.</p>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="surface">
        <label>
          Find code
          <input
            className="commerce-input"
            value={q}
            maxLength={32}
            onChange={(e) => {
              setQ(e.target.value.toUpperCase());
              setCursor(undefined);
            }}
          />
        </label>
        <label>
          Status
          <select
            className="commerce-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setCursor(undefined);
            }}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        {busy && <p role="status">Loading…</p>}
        {rows.map((p) => (
          <div key={p.code}>
            <h3>
              {p.code} · {p.discountPercent}% · {p.active ? 'Active' : 'Inactive'}
            </h3>
            <p>
              {p.redemptionCount} paid redemptions · {p.reservedCount} pending reservations
            </p>
            {Object.entries(p.totals).map(([c, t]) => (
              <p key={c}>
                {c}: gross revenue {(t.revenueMinor / 100).toFixed(2)} · discounts granted{' '}
                {(t.discountMinor / 100).toFixed(2)}
              </p>
            ))}
            <button
              className="button"
              onClick={() => {
                setCode(p.code);
                setPercent(p.discountPercent);
                setActive(p.active);
                setStart(p.startsAt.slice(0, 16));
                setEnd(p.expiresAt.slice(0, 16));
                setLimit(p.maxUses?.toString() ?? '');
                setEditing(true);
                setPreview(null);
              }}
            >
              Edit / change status
            </button>
          </div>
        ))}
        {!busy && !rows.length && <p>No promotions found.</p>}
        <div className="operations-pagination">
          <button className="button" disabled={!cursor} onClick={() => setCursor(undefined)}>
            First page
          </button>
          <button
            className="button"
            disabled={!next || busy}
            onClick={() => setCursor(next ?? undefined)}
          >
            Next codes
          </button>
        </div>
      </div>
      <div className="surface">
        <h3>{editing ? 'Edit promotion' : 'Create promotion'}</h3>
        <label>
          Code
          <input
            className="commerce-input"
            value={code}
            disabled={editing}
            maxLength={32}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </label>
        <label>
          Discount % (1–50)
          <input
            className="commerce-input"
            type="number"
            min={1}
            max={50}
            step={1}
            value={percent}
            onChange={(e) => {
              setPercent(Number(e.target.value));
              setPreview(null);
            }}
          />
        </label>
        <div className="operations-esim-search">
          {[5, 10, 15, 20, 25, 30, 40, 50].map((n) => (
            <button
              type="button"
              className="button small"
              key={n}
              onClick={() => {
                setPercent(n);
                setPreview(null);
              }}
            >
              {n}%
            </button>
          ))}
        </div>
        <label>
          Starts at (UTC)
          <input
            className="commerce-input"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Expires at (UTC)
          <input
            className="commerce-input"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label>
          Maximum paid uses (optional)
          <input
            className="commerce-input"
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
        <h3>Check a package’s estimated profitability</h3>
        <label>
          Package name prefix
          <input
            className="commerce-input"
            value={packageSearch}
            onChange={(e) => setPackageSearch(e.target.value)}
          />
        </label>
        <button
          className="button"
          onClick={async () => {
            try {
              const r = await api<{ rows: { id: string; name: string }[] }>(
                '/v1/operations/promotions/packages?q=' + encodeURIComponent(packageSearch),
                {},
                uid,
              );
              setPackages(r.rows);
            } catch {
              setError('Package search failed.');
            }
          }}
        >
          Find packages
        </button>
        <label>
          Package
          <select
            className="commerce-input"
            value={packageId}
            onChange={(e) => {
              setPackageId(e.target.value);
              setPreview(null);
            }}
          >
            <option value="">Choose a package</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button"
          disabled={!packageId || percent < 1 || percent > 50}
          onClick={check}
        >
          Preview impact
        </button>
        {preview && (
          <div className={preview.warning === 'normal' ? 'notice' : 'error-message'} role="status">
            <strong>
              {preview.warning === 'critical'
                ? 'Critical: zero or negative contribution'
                : preview.warning === 'low'
                  ? 'Low margin: below 20%'
                  : preview.warning === 'reduced'
                    ? 'Reduced profitability: below 25%'
                    : 'Normal profitability'}
            </strong>
            <p>Estimate for the selected package only; margins vary by plan.</p>
            <dl className="spec-list">
              {[
                ['Original price', preview.originalMinor],
                ['Discount', preview.discountMinor],
                ['Final price', preview.finalMinor],
                ['Supplier cost (rounded up)', preview.supplierMinor],
                ['Estimated Stripe fees', preview.estimatedFeeMinor],
                ['Estimated contribution', preview.contributionMinor],
              ].map(([label, n]) => (
                <div key={String(label)}>
                  <dt>{label}</dt>
                  <dd>{usd(Number(n))}</dd>
                </div>
              ))}
            </dl>
            <p>
              Contribution margin {(preview.marginBps / 100).toFixed(2)}% · {preview.feeBasis}
            </p>
          </div>
        )}
        <button
          className="button primary"
          disabled={busy}
          onClick={save}
          aria-describedby={saveError ? 'promotion-save-error' : undefined}
        >
          Save promotion
        </button>
        {saveError && (
          <p id="promotion-save-error" className="error-message" role="alert">
            {saveError}
          </p>
        )}
        {saved && <p role="status">Promotion saved.</p>}
        {editing && (
          <button
            className="button"
            onClick={() => {
              setEditing(false);
              setCode('');
              setPreview(null);
            }}
          >
            New code
          </button>
        )}
      </div>
    </section>
  );
}

export function PromotionPerformance({
  rows,
}: {
  rows: NonNullable<OperationsReport['promotions']>;
}) {
  const money = (amount: number | null, currency = 'GBP') =>
    amount === null
      ? 'Pending'
      : new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount / 100);
  return (
    <details className="surface operations-transactions">
      <summary>Promotion performance</summary>
      <p className="fine-print">
        Selected order dates, Europe/London. Revenue includes refunds; discounts are amounts
        originally granted. Contribution is before other operating expenses and taxes. Pending
        values are not zero.
      </p>
      {!rows.length ? (
        <p>No paid promoted orders in this date range.</p>
      ) : (
        <div
          className="operations-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Promotion performance"
        >
          <table>
            <thead>
              <tr>
                {[
                  'Code / usage by date',
                  'Paid orders',
                  'Net revenue',
                  'Discounts granted',
                  'Supplier costs (GBP)',
                  'Stripe fees (GBP)',
                  'Contribution (GBP)',
                ].map((label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.code + row.currency}>
                  <td>
                    <strong>{row.code}</strong>
                    <details>
                      <summary>Usage by date</summary>
                      {row.usage.map((day) => (
                        <p key={day.date}>
                          {day.date}: {day.sales} paid order(s)
                        </p>
                      ))}
                    </details>
                  </td>
                  <td>{row.sales}</td>
                  <td>{money(row.revenueMinor, row.currency)}</td>
                  <td>{money(row.discountMinor, row.currency)}</td>
                  <td>{money(row.supplierGbp)}</td>
                  <td>{money(row.feesGbp)}</td>
                  <td>
                    {money(row.profitGbp)}
                    <small>{row.provisional ? 'Provisional / estimated' : 'Final'}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
