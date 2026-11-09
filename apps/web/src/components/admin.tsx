'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from './auth-provider';
import { api, demoMode } from '@/lib/api';
type Status = {
  mode: string;
  paymentsEnabled: boolean;
  supplierConnected: boolean;
  catalogueCount: number;
};
export function Admin() {
  const { user } = useAuth();
  return <AccountAdmin key={user?.uid ?? 'signed-out'} />;
}
function AccountAdmin() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user || demoMode) return;
    let active = true;
    api<Status>('/v1/admin/status', {}, true)
      .then((r) => {
        if (active) setStatus(r);
      })
      .catch(() => {
        if (active)
          setError(
            'Operations is unavailable. Administrator access and a running API are required.',
          );
      });
    return () => {
      active = false;
    };
  }, [user]);
  return (
    <section className="container section">
      <div className="page-intro">
        <span className="eyebrow">VOYASPAN OPERATIONS</span>
        <h1>Launch overview</h1>
        <p>Server-verified administrator access is required.</p>
      </div>
      {loading ? (
        <p>Checking access…</p>
      ) : !user ? (
        <Link className="button primary" href="/login?next=/admin">
          Sign in
        </Link>
      ) : demoMode ? (
        <div className="notice">
          Operations is not connected in this storefront preview. Payments remain disabled.
        </div>
      ) : error ? (
        <p role="alert" className="error-message">
          {error}
        </p>
      ) : status ? (
        <div className="surface">
          <h2>Service status</h2>
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
              <dt>Payments</dt>
              <dd>{status.paymentsEnabled ? 'Enabled' : 'Disabled'}</dd>
            </div>
            <div>
              <dt>Supplier</dt>
              <dd>{status.supplierConnected ? 'Connected' : 'Not connected'}</dd>
            </div>
          </dl>
          <div className="notice">
            Order operations, finance exports and supplier fulfilment are not connected in this
            draft.
          </div>
        </div>
      ) : (
        <p role="status">Loading operations…</p>
      )}
    </section>
  );
}
