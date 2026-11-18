'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCurrency } from './currency-provider';
import { useLocale, useTranslations, useFormatter } from 'next-intl';
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
  const t = useTranslations('buyAgain');
  const format = useFormatter();
  const date = (value: string) =>
    Number.isFinite(Date.parse(value))
      ? format.dateTime(new Date(value), { dateStyle: 'medium', timeZone: 'UTC' })
      : '—';
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
      setError(t('checkError'));
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
      setError(t('checkoutError'));
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="surface stack" aria-busy={busy}>
      {profiles === null ? (
        <button className="button" disabled={busy} onClick={() => void check()}>
          {busy ? t('checking') : t('title')}
        </button>
      ) : (
        <>
          <h3>{t(selected && selected !== 'new' ? 'topup' : 'title')}</h3>
          <p>{profiles.length ? t('chooseIntro') : t('newIntro')}</p>
          <fieldset disabled={busy}>
            <legend>{t('choose')}</legend>
            {profiles.map((profile) => (
              <label className="checkbox-label" key={profile.id}>
                <input
                  type="radio"
                  name={'profile-' + orderId}
                  checked={selected === profile.id}
                  onChange={() => setSelected(profile.id)}
                />
                <span>
                  {profile.packageName} ·{' '}
                  <bdi style={{ whiteSpace: 'nowrap' }}>{profile.maskedIccid}</bdi> ·{' '}
                  {t('profileDates', {
                    purchased: date(profile.purchasedAt),
                    expires: date(profile.expiresAt),
                  })}
                </span>
              </label>
            ))}
            <label className="checkbox-label">
              <input
                type="radio"
                name={'profile-' + orderId}
                checked={selected === 'new'}
                onChange={() => setSelected('new')}
              />
              {t('newEsim')}
            </label>
          </fieldset>
          {selected && selected !== 'new' && (
            <p>
              {t('topupHint')}{' '}
              {['daily', 'unlimited'].includes(
                profiles.find((profile) => profile.id === selected)?.packageType ?? '',
              ) && t('dailyHint')}
            </p>
          )}
          <button
            type="button"
            className="button primary"
            disabled={busy || !selected}
            onClick={() => void checkout()}
          >
            {busy ? t('preparing') : t('continue')}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
