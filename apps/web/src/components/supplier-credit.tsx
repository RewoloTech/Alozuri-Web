'use client';
import { useState } from 'react';
import type { OperationsEsimDetails } from '@alozuri/shared/financial';
import { api } from '@/lib/api';
type Unit = OperationsEsimDetails['units'][number];
const dollars = (units: number) => 'USD ' + (units / 10000).toFixed(4);
export function SupplierCredit({ unit, uid }: { unit: Unit; uid: string }) {
  const cost = unit.supplierCost;
  const [amount, setAmount] = useState(cost ? (cost.creditUnits / 10000).toFixed(4) : '');
  const [reference, setReference] = useState(cost?.reference ?? '');
  const [version, setVersion] = useState(cost?.version ?? 0);
  const [credit, setCredit] = useState(cost?.creditUnits ?? 0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  // Preserve the request on a transport retry so an uncertain response cannot duplicate an audit entry.
  const [attempt, setAttempt] = useState<{ fingerprint: string; id: string } | null>(null);
  if (!cost || !unit.supplierOrderNo) return null;
  return (
    <details className="operations-supplier-credit">
      <summary>Supplier cost / record refund</summary>
      <p>
        Original {cost.verified ? 'verified cost' : 'cost quote (provisional)'}:{' '}
        {dollars(cost.originalUnits)}
        <br />
        Confirmed supplier credit: {dollars(credit)}
        <br />
        Net supplier cost {cost.verified ? '' : '(provisional)'}:{' '}
        {dollars(cost.originalUnits - credit)}
      </p>
      <p className="fine-print">
        Record only money already credited by the supplier. Enter the total credit for this eSIM,
        including previous credits. This does not cancel the eSIM or issue a Stripe refund. Original
        costs and change history are retained.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          setSaved(false);
          setBusy(true);
          const fingerprint = JSON.stringify([amount, reference, version]);
          const requestId = attempt?.fingerprint === fingerprint ? attempt.id : crypto.randomUUID();
          setAttempt({ fingerprint, id: requestId });
          try {
            await api(
              `/v1/operations/orders/${encodeURIComponent(unit.id)}/supplier-credit`,
              {
                method: 'POST',
                body: JSON.stringify({
                  amountUsd: amount,
                  reference,
                  expectedVersion: version,
                  requestId,
                }),
              },
              uid,
            );
            setCredit(Math.round(Number(amount) * 10000));
            setVersion((v) => v + 1);
            setAttempt(null);
            setSaved(true);
            window.dispatchEvent(new Event('alozuri-financial-updated'));
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Supplier credit could not be recorded.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Total supplier refund received (USD)
          <input
            className="commerce-input"
            type="text"
            inputMode="decimal"
            required
            pattern="[0-9]{1,10}([.][0-9]{1,4})?"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Supplier refund reference / evidence
          <input
            className="commerce-input"
            required
            maxLength={200}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <button className="button small" disabled={busy}>
          {busy ? 'Saving…' : 'Record supplier credit'}
        </button>
      </form>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {saved && <p role="status">Supplier credit recorded. Financial totals updated.</p>}
    </details>
  );
}
