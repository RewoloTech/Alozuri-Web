'use client';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';

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
  const [activation, setActivation] = useState<Activation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function reveal() {
    setLoading(true);
    setError('');
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
      setError(
        'Installation details could not be loaded. Try again or contact support with your order reference.',
      );
    } finally {
      setLoading(false);
    }
  }
  const parts = activation?.ac.split('$');
  return (
    <div className="stack">
      <h3>Install your eSIM</h3>
      <p>
        Connect to Wi-Fi before installing. Follow your plan’s activation rule and keep these
        details private.
      </p>
      {!activation ? (
        <button className="button primary" disabled={loading} onClick={reveal}>
          {loading ? 'Loading installation details…' : 'Show installation details'}
        </button>
      ) : (
        <>
          <QRCodeSVG
            value={activation.ac}
            size={240}
            marginSize={4}
            title="Your private eSIM installation QR code"
          />
          <p>
            On your phone, open Settings → Mobile/Cellular → Add eSIM. Scan this QR code from
            another screen, or enter the details below manually.
          </p>
          <dl className="spec-list">
            <div>
              <dt>SM-DP+ address</dt>
              <dd style={{ overflowWrap: 'anywhere' }}>{parts?.[1]}</dd>
            </div>
            <div>
              <dt>Activation code</dt>
              <dd style={{ overflowWrap: 'anywhere' }}>{parts?.[2]}</dd>
            </div>
            {parts?.[3] && (
              <div>
                <dt>Confirmation code</dt>
                <dd>{parts[3]}</dd>
              </div>
            )}
            <div>
              <dt>ICCID</dt>
              <dd>{activation.iccid}</dd>
            </div>
          </dl>
          <p>
            Do not delete the eSIM after installing unless support asks you to. Some profiles can
            only be installed once.
          </p>
        </>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
