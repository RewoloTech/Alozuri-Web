'use client';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';
import { useTranslations } from 'next-intl';

type Activation = { ac: string; iccid: string; esimTranNo: string };
export function InstallationDetails({
  orderId,
  purchaseId,
  accessToken,
}: {
  orderId: string;
  purchaseId?: string;
  accessToken?: string;
}) {
  const t = useTranslations('display');
  const installation = useTranslations('installation');
  const [activation, setActivation] = useState<Activation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  async function reveal() {
    setLoading(true);
    setError(false);
    try {
      const result = await api<{ activation: Activation }>(
        purchaseId
          ? `/v2/orders/${encodeURIComponent(purchaseId)}/units/${encodeURIComponent(orderId)}/activation`
          : `/v1/orders/${encodeURIComponent(orderId)}/activation`,
        { headers: accessToken ? { 'X-Order-Access': accessToken } : {} },
        !accessToken,
      );
      setActivation(result.activation);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  const parts = activation?.ac.split('$');
  return (
    <div className="stack">
      <h3>{installation('title')}</h3>
      <p>{t('installIntro')}</p>
      {!activation ? (
        <button className="button primary" disabled={loading} onClick={reveal}>
          {loading ? t('installLoading') : t('installShow')}
        </button>
      ) : (
        <>
          <QRCodeSVG value={activation.ac} size={240} marginSize={4} title={t('installQr')} />
          <p>{t('installInstructions')}</p>
          <dl className="spec-list">
            <div>
              <dt>{t('smdp')}</dt>
              <dd dir="ltr" style={{ overflowWrap: 'anywhere' }}>
                {parts?.[1]}
              </dd>
            </div>
            <div>
              <dt>{t('activationCode')}</dt>
              <dd dir="ltr" style={{ overflowWrap: 'anywhere' }}>
                {parts?.[2]}
              </dd>
            </div>
            {parts?.[3] && (
              <div>
                <dt>{t('confirmationCode')}</dt>
                <dd dir="ltr">{parts[3]}</dd>
              </div>
            )}
            <div>
              <dt>ICCID</dt>
              <dd dir="ltr">{activation.iccid}</dd>
            </div>
          </dl>
          <p>{t('installWarning')}</p>
        </>
      )}
      {error && (
        <p className="error-message" role="alert">
          {t('installError')}
        </p>
      )}
    </div>
  );
}
