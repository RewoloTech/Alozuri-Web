'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useStatusCopy } from '@/lib/use-status-copy';
import { useEffect, useState } from 'react';
import { dataSizeLabel } from '@alozuri/shared';
import type { EsimUsage } from '@alozuri/shared/esim-usage';
import { api } from '@/lib/api';

export function EsimUsagePanel({
  purchaseId,
  unitId,
  accessToken,
}: {
  purchaseId: string;
  unitId: string;
  accessToken?: string;
}) {
  const t = useTranslations('usageUi');
  const site = useTranslations('site');
  const locale = useLocale();
  const status = useStatusCopy();
  const volume = (bytes: number | null) =>
    bytes === null ? status.notReported : dataSizeLabel(bytes / 1073741824);
  const date = (value: string) =>
    new Date(value).toLocaleString(locale === 'en' ? 'en-GB' : locale);
  const [usage, setUsage] = useState<EsimUsage | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void api<{ usage: EsimUsage }>(
      `/v2/orders/${encodeURIComponent(purchaseId)}/units/${encodeURIComponent(unitId)}/usage`,
      { signal: controller.signal, headers: accessToken ? { 'X-Order-Access': accessToken } : {} },
      !accessToken,
    )
      .then((result) => {
        if (active) setUsage(result.usage);
      })
      .catch(() => {
        if (active) setError(true);
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
    <section className="esim-usage" aria-label={site('usage')} aria-busy={loading}>
      <h3>{site('usage')}</h3>
      {loading && <p role="status">{t('checking')}</p>}
      {snapshot ? (
        <>
          <dl className="spec-list">
            <div>
              <dt>{t('used')}</dt>
              <dd dir="ltr">{volume(snapshot.usedBytes)}</dd>
            </div>
            {snapshot.kind === 'fixed' && (
              <>
                <div>
                  <dt>{t('remaining')}</dt>
                  <dd dir="ltr">{volume(snapshot.remainingBytes)}</dd>
                </div>
                <div>
                  <dt>{t('total')}</dt>
                  <dd dir="ltr">{volume(snapshot.totalBytes)}</dd>
                </div>
              </>
            )}
            <div>
              <dt>{t('installation')}</dt>
              <dd>{status.installation(snapshot.smdpStatus)}</dd>
            </div>
            {snapshot.esimTranNo && (
              <div>
                <dt>{t('tran')}</dt>
                <dd dir="ltr">{snapshot.esimTranNo}</dd>
              </div>
            )}
            <div>
              <dt>{t('supplierStatus')}</dt>
              <dd>{status.profile(snapshot.profileStatus)}</dd>
            </div>
            <div>
              <dt>{t('expiry')}</dt>
              <dd>{snapshot.expiresAt ? date(snapshot.expiresAt) : t('notYet')}</dd>
            </div>
          </dl>
          {snapshot.kind === 'fixed' &&
            snapshot.totalBytes !== null &&
            snapshot.usedBytes !== null && (
              <progress
                aria-label={t('used')}
                max={snapshot.totalBytes}
                value={Math.min(snapshot.usedBytes, snapshot.totalBytes)}
              />
            )}
          {snapshot.kind !== 'fixed' && <p>{t('nonFixed')}</p>}
          <p className="fine-print">
            <time dateTime={snapshot.checkedAt}>
              {t('lastChecked', { date: date(snapshot.checkedAt) })}
            </time>
          </p>
          {usage.stale && <p role="status">{t('stale')}</p>}
        </>
      ) : (
        !loading && (
          <p role="status">{usage?.state === 'pending' ? t('pending') : t('unavailable')}</p>
        )
      )}
      {error && <p role="alert">{t('error')}</p>}
      <p className="fine-print">{t('delay')}</p>
      <button
        className="button small"
        disabled={loading}
        onClick={() => setRefresh((value) => value + 1)}
      >
        {t('refresh')}
      </button>
    </section>
  );
}
