'use client';
import { SupplierCredit } from './supplier-credit';
import { useEffect, useId, useState } from 'react';
import type { OperationsEsimDetails, OperationsOrderSearch } from '@alozuri/shared/financial';
import { installationLabel } from '@alozuri/shared/esim-usage';
import { dataSizeLabel } from '@alozuri/shared';
import { api } from '@/lib/api';

function CopyReference({ value, label }: { value: string; label: string }) {
  const [message, setMessage] = useState('');
  return (
    <span className="operations-reference">
      <span>{value}</span>
      <button
        type="button"
        className="button small"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage('Copied');
          } catch {
            setMessage('Copy failed. Select the reference to copy it.');
          }
        }}
      >
        Copy
      </button>
      <span role="status" className="fine-print">
        {message}
      </span>
    </span>
  );
}
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount / 100);
const date = (at: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(at));

function Reading({
  data,
  showReference,
  uid,
}: {
  data: OperationsEsimDetails;
  showReference: boolean;
  uid: string;
}) {
  const bytes = (n: number | null) => (n === null ? 'Not reported' : dataSizeLabel(n / 1073741824));
  return (
    <div className="operations-esim-reading">
      {showReference && <CopyReference value={data.reference} label="Alozuri order reference" />}
      <p>
        {data.email ?? 'Email not recorded'}
        <br />
        Purchased: {date(data.createdAt)}
        <br />
        Payment: {data.paymentStatus.replaceAll('_', ' ')} · Fulfilment:{' '}
        {data.fulfilmentStatus.replaceAll('_', ' ')}
        <br />
        Order total: {money(data.amountMinor, data.currency)} ({data.currency})
      </p>
      <div className="operations-stripe-payment">
        <strong>Stripe payment ID (PaymentIntent)</strong>
        {data.stripePayment ? (
          <>
            <CopyReference value={data.stripePayment.paymentIntentId} label="Stripe payment ID" />
            <a
              className="text-link"
              href={data.stripePayment.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open payment in Stripe ↗
            </a>
          </>
        ) : (
          <p className="fine-print">Not recorded for this order.</p>
        )}
      </div>
      <details>
        <summary>Internal order ID</summary>
        <CopyReference value={data.purchaseId} label="internal order ID" />
      </details>
      {!data.units.length && (
        <>
          <p>{data.items.map((i) => `${i.quantity} × ${i.name}`).join('; ')}</p>
          <p>No eSIM has been allocated to this order yet.</p>
        </>
      )}
      {data.units.map((unit) => (
        <section key={unit.id} aria-label={unit.name}>
          <h3>{unit.name}</h3>
          <SupplierCredit unit={unit} uid={uid} />
          <dl className="spec-list">
            <div>
              <dt>Supplier</dt>
              <dd>{unit.supplier.name}</dd>
            </div>
            <div>
              <dt>Selling price</dt>
              <dd>
                {money(unit.amountMinor, unit.currency)} ({unit.currency})
              </dd>
            </div>
            <div>
              <dt>eSIM Tran No</dt>
              <dd>
                {unit.esimTranNo ? (
                  <CopyReference value={unit.esimTranNo} label={`eSIM Tran No for ${unit.name}`} />
                ) : (
                  'Not reported'
                )}
              </dd>
            </div>
            <div>
              <dt>Supplier order number</dt>
              <dd>
                {unit.supplierOrderNo ? (
                  <CopyReference
                    value={unit.supplierOrderNo}
                    label={`supplier order number for ${unit.name}`}
                  />
                ) : (
                  'Not reported'
                )}
              </dd>
            </div>
            <div>
              <dt>Fulfilment</dt>
              <dd>{unit.fulfilmentStatus.replaceAll('_', ' ')}</dd>
            </div>
            <div>
              <dt>Installation</dt>
              <dd>{installationLabel(unit.usage.snapshot?.smdpStatus)}</dd>
            </div>
            <div>
              <dt>Supplier status</dt>
              <dd>
                {unit.usage.snapshot?.profileStatus &&
                unit.usage.snapshot.profileStatus !== 'UNKNOWN'
                  ? unit.usage.snapshot.profileStatus
                  : 'Not reported'}
              </dd>
            </div>
            {unit.usage.snapshot && (
              <>
                <div>
                  <dt>Used data</dt>
                  <dd>{bytes(unit.usage.snapshot.usedBytes)}</dd>
                </div>
                <div>
                  <dt>Remaining data</dt>
                  <dd>
                    {unit.usage.snapshot.kind === 'fixed'
                      ? bytes(unit.usage.snapshot.remainingBytes)
                      : 'Not reported for this plan type'}
                  </dd>
                </div>
                <div>
                  <dt>Last checked</dt>
                  <dd>
                    {new Date(unit.usage.snapshot.checkedAt).toLocaleString('en-GB', {
                      timeZone: 'Europe/London',
                    })}
                    {unit.usage.stale ? ' · older reading' : ''}
                  </dd>
                </div>
              </>
            )}
          </dl>
          {!unit.usage.snapshot && <p>Supplier status and usage are not available yet.</p>}
        </section>
      ))}
      <p className="fine-print">
        Checks are cached for 15 minutes. Supplier usage may lag by 2–3 hours. Missing status is not
        proof that an eSIM is uninstalled or unused.
      </p>
    </div>
  );
}
function Details({
  id,
  uid,
  showReference = true,
}: {
  id: string;
  uid: string;
  showReference?: boolean;
}) {
  const [data, setData] = useState<OperationsEsimDetails | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setBusy(true);
    setError('');
    setData(null);
    void api<OperationsEsimDetails>(
      `/v1/operations/orders/${encodeURIComponent(id)}/esims`,
      { signal: controller.signal },
      uid,
    )
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setError('eSIM details could not be loaded. Retry or check Operations access.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, uid, attempt]);
  return (
    <div aria-busy={busy}>
      {busy && <p role="status">Checking eSIM details…</p>}
      {error && <p role="alert">{error}</p>}
      {data && <Reading data={data} showReference={showReference} uid={uid} />}
      <button className="button small" disabled={busy} onClick={() => setAttempt((n) => n + 1)}>
        Refresh eSIM details
      </button>
    </div>
  );
}
export function OperationsEsimDisclosure({ id, uid }: { id: string; uid: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="operations-esim-details" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>eSIM details</summary>
      {open && <Details id={id} uid={uid} />}
    </details>
  );
}
export function OperationsEsimLookup({ uid }: { uid: string }) {
  const inputId = useId();
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState('');
  const [data, setData] = useState<OperationsOrderSearch | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0),
    [cursor, setCursor] = useState<string | undefined>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  useEffect(() => {
    if (!search) return;
    const controller = new AbortController();
    let active = true;
    setData(null);
    setSelected(null);
    setError('');
    setBusy(true);
    const params = new URLSearchParams({ q: search });
    if (cursor) params.set('cursor', cursor);
    void api<OperationsOrderSearch>(
      `/v1/operations/orders/search?${params}`,
      { signal: controller.signal },
      uid,
    )
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Order search failed. Please retry.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [search, uid, cursor, attempt]);
  return (
    <section className="surface operations-esim-lookup" aria-label="Order search" aria-busy={busy}>
      <h2>Orders</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
          setCursor(undefined);
          setPrevious([]);
          setAttempt((n) => n + 1);
        }}
      >
        <label htmlFor={inputId}>Search orders</label>
        <p id={`${inputId}-help`} className="fine-print">
          Exact order reference, eSIM Tran No, supplier order number or customer email.
        </p>
        <div className="operations-esim-search">
          <input
            className="commerce-input"
            type="search"
            id={inputId}
            aria-describedby={`${inputId}-help`}
            value={query}
            required
            maxLength={254}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="button" disabled={busy}>
            Search
          </button>
        </div>
      </form>
      {busy && <p role="status">Searching orders…</p>}
      {error && (
        <>
          <p role="alert">{error}</p>
          <button className="button small" onClick={() => setAttempt((n) => n + 1)}>
            Retry search
          </button>
        </>
      )}
      {data && (
        <>
          {!data.rows.length && (
            <p role="status">
              {data.nextCursor
                ? 'More matching records are available on the next page.'
                : 'No matching orders found.'}
            </p>
          )}
          <ul className="operations-order-results">
            {data.rows.map((row) => (
              <li key={row.id}>
                <CopyReference value={row.reference} label={`order reference ${row.reference}`} />
                <button
                  className="operations-order-result"
                  aria-label={`Open order ${row.reference}`}
                  aria-expanded={selected === row.id}
                  onClick={() => setSelected(selected === row.id ? null : row.id)}
                >
                  <strong>View order details</strong>
                  <span>
                    {date(row.createdAt)} · {row.email ?? 'Email not recorded'}
                  </span>
                  <span>{row.plans.map((i) => `${i.quantity} × ${i.name}`).join('; ')}</span>
                  <span>
                    {money(row.amountMinor, row.currency)} ({row.currency}) ·{' '}
                    {row.paymentStatus.replaceAll('_', ' ')}
                  </span>
                </button>
                {row.esims?.map((esim) => (
                  <div className="operations-provider-reference" key={esim.id}>
                    <strong>{esim.supplier.name}</strong>
                    <span>{esim.name}</span>
                    <span>eSIM Tran No</span>
                    {esim.esimTranNo ? (
                      <CopyReference
                        value={esim.esimTranNo}
                        label={`eSIM Tran No ${esim.esimTranNo} from ${esim.supplier.name}`}
                      />
                    ) : (
                      <span>Not reported</span>
                    )}
                  </div>
                ))}
                {selected === row.id && (
                  <Details key={row.id} id={row.id} uid={uid} showReference={false} />
                )}
              </li>
            ))}
          </ul>
          {(previous.length > 0 || data.nextCursor) && (
            <div className="operations-pagination">
              <button
                className="button"
                disabled={busy || !previous.length}
                onClick={() => {
                  setCursor(previous.at(-1));
                  setPrevious((p) => p.slice(0, -1));
                }}
              >
                Previous results
              </button>
              <button
                className="button"
                disabled={busy || !data.nextCursor}
                onClick={() => {
                  setPrevious((p) => [...p, cursor]);
                  setCursor(data.nextCursor ?? undefined);
                }}
              >
                Next results
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
