'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCurrency } from './currency-provider';
import { useLocale } from 'next-intl';
import { localePath, isLocale } from '@alozuri/shared/i18n';
type Profile = {
  id: string;
  maskedIccid: string;
  expiresAt: string;
  purchasedAt: string;
  packageName: string;
  packageType?: 'fixed' | 'daily' | 'unlimited';
};
export function BuyAgain({ orderId }: { orderId: string }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(false),
    router = useRouter(),
    locale = useLocale();
  const { currency } = useCurrency();
  async function check() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ profiles: Profile[] }>(
        '/v2/buy-again/options',
        { method: 'POST', body: JSON.stringify({ orderId }) },
        true,
      );
      setProfiles(result.profiles);
      setSelected(
        result.profiles.length === 1
          ? result.profiles[0].id
          : result.profiles.length
            ? null
            : 'new',
      );
    } catch {
      setError('We could not check your existing eSIM. Please try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function checkout() {
    if (!selected || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ id: string; productId: string }>(
        '/v2/buy-again/quote',
        {
          method: 'POST',
          body: JSON.stringify({
            orderId,
            currency,
            ...(selected !== 'new' ? { profileOrderId: selected } : {}),
          }),
        },
        true,
      );
      router.push(
        localePath('/checkout', isLocale(locale) ? locale : 'en') +
          '?buy=' +
          encodeURIComponent(result.productId) +
          '&repeatQuote=' +
          result.id,
      );
    } catch {
      setError('Checkout could not be prepared. Check availability and try again.');
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="surface stack" aria-busy={busy}>
      {profiles === null ? (
        <button className="button" disabled={busy} onClick={() => void check()}>
          {busy ? 'Checking existing eSIM and top-up availability…' : 'Buy Again'}
        </button>
      ) : (
        <>
          <h3>{selected && selected !== 'new' ? 'Top up existing eSIM' : 'Buy again'}</h3>
          <p>
            {profiles.length
              ? 'Choose an existing eSIM to recharge, or buy a new one.'
              : 'Your previous eSIM is no longer eligible for a top-up. A new eSIM will be issued.'}
          </p>
          <fieldset disabled={busy}>
            <legend>Choose your eSIM</legend>
            {profiles.map((profile) => (
              <label className="checkbox-label" key={profile.id}>
                <input
                  type="radio"
                  name={'profile-' + orderId}
                  checked={selected === profile.id}
                  onChange={() => setSelected(profile.id)}
                />
                {profile.packageName} · {profile.maskedIccid} · Purchased {profile.purchasedAt} ·
                Expires {profile.expiresAt}
              </label>
            ))}
            <label className="checkbox-label">
              <input
                type="radio"
                name={'profile-' + orderId}
                checked={selected === 'new'}
                onChange={() => setSelected('new')}
              />
              Buy a new eSIM
            </label>
          </fieldset>
          {selected && selected !== 'new' && (
            <p>
              Add this package to your existing eSIM. No new QR code is required.
              {['daily', 'unlimited'].includes(
                profiles.find((profile) => profile.id === selected)?.packageType ?? '',
              ) && ' Daily extensions increase validity, not the daily high-speed allowance.'}
            </p>
          )}
          <button
            type="button"
            className="button primary"
            disabled={busy || !selected}
            onClick={() => void checkout()}
          >
            {busy ? 'Preparing checkout…' : 'Continue to checkout'}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
