'use client';
import { useEffect, useState } from 'react';
import { dataSizeLabel } from '@alozuri/shared';
import type { EsimUsage } from '@alozuri/shared/esim-usage';
import { api } from '@/lib/api';

const labels: Record<string, string> = {
  CREATE: 'Preparing',
  PAYING: 'Preparing',
  PAID: 'Preparing',
  GETTING_RESOURCE: 'Preparing',
  GOT_RESOURCE: 'Ready',
  IN_USE: 'Active',
  USED_UP: 'Data depleted',
  UNUSED_EXPIRED: 'Expired',
  USED_EXPIRED: 'Expired',
  CANCEL: 'Cancelled',
  SUSPENDED: 'Suspended',
  REVOKE: 'Revoked',
};
const volume = (bytes: number | null) =>
  bytes === null ? 'Not reported' : dataSizeLabel(bytes / 1073741824);

export function EsimUsagePanel({
  purchaseId,
  unitId,
  accessToken,
}: {
  purchaseId: string;
  unitId: string;
  accessToken?: string;
}) {
  const [usage, setUsage] = useState<EsimUsage | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void api<{ usage: EsimUsage }>(
      `/v2/orders/${encodeURIComponent(purchaseId)}/units/${encodeURIComponent(unitId)}/usage`,
      { signal: controller.signal, headers: accessToken ? { 'X-Order-Access': accessToken } : {} },
      !accessToken,
    )
      .then((result) => {
        if (active) setUsage(result.usage);
      })
      .catch(() => {
        if (active) setError('Usage could not be checked. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [purchaseId, unitId, accessToken, refresh]);
  const snapshot = usage?.snapshot;
  return (
    <section className="esim-usage" aria-label="Data usage" aria-busy={loading}>
      <h3>Data usage</h3>
      {loading && <p role="status">Checking data usage…</p>}
      {snapshot ? (
        <>
          <dl className="spec-list">
            <div>
              <dt>Used data</dt>
              <dd>{volume(snapshot.usedBytes)}</dd>
            </div>
            {snapshot.kind === 'fixed' && (
              <>
                <div>
                  <dt>Remaining data</dt>
                  <dd>{volume(snapshot.remainingBytes)}</dd>
                </div>
                <div>
                  <dt>Total allowance</dt>
                  <dd>{volume(snapshot.totalBytes)}</dd>
                </div>
              </>
            )}
            <div>
              <dt>Supplier status</dt>
              <dd>{labels[snapshot.profileStatus] ?? 'Not reported'}</dd>
            </div>
            <div>
              <dt>Expiry</dt>
              <dd>
                {snapshot.expiresAt
                  ? new Date(snapshot.expiresAt).toLocaleString('en-GB')
                  : 'Not reported yet'}
              </dd>
            </div>
          </dl>
          {snapshot.kind === 'fixed' &&
            snapshot.totalBytes !== null &&
            snapshot.usedBytes !== null && (
              <progress
                aria-label="Data used"
                max={snapshot.totalBytes}
                value={Math.min(snapshot.usedBytes, snapshot.totalBytes)}
              />
            )}
          {snapshot.kind !== 'fixed' && (
            <p>
              This {snapshot.kind} plan shows supplier-reported usage. A remaining high-speed
              balance is not reported here.
            </p>
          )}
          <p className="fine-print">
            Last checked:{' '}
            <time dateTime={snapshot.checkedAt}>
              {new Date(snapshot.checkedAt).toLocaleString('en-GB')}
            </time>
          </p>
          {usage.stale && <p role="status">Showing an older reading. Check again shortly.</p>}
        </>
      ) : (
        !loading && (
          <p role="status">
            {usage?.state === 'pending'
              ? 'Usage has not been reported yet, or a check is in progress. Try again shortly.'
              : 'Usage is temporarily unavailable. Please try again later.'}
          </p>
        )
      )}
      {error && <p role="alert">{error}</p>}
      <p className="fine-print">
        Supplier readings can be delayed by 2–3 hours. Daily and unlimited plans follow their own
        allowance and fair-use rules.
      </p>
      <button
        className="button small"
        disabled={loading}
        onClick={() => setRefresh((value) => value + 1)}
      >
        Refresh usage
      </button>
    </section>
  );
}
