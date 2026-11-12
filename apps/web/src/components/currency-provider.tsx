'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SUPPORTED_CURRENCIES, type Currency } from '@alozuri/shared';
import { preferredCurrency } from '@alozuri/shared/currency';

const CurrencyContext = createContext<{
  currency: Currency;
  ready: boolean;
  refresh: number;
  setCurrency: (value: Currency) => void;
  available: Currency[];
  locked: boolean;
  lock: (value: boolean) => void;
}>({
  currency: 'USD',
  ready: false,
  refresh: 0,
  setCurrency: () => {},
  available: ['USD'],
  locked: false,
  lock: () => {},
});
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [available, setAvailable] = useState<Currency[]>(['USD']);
  const [locked, lock] = useState(false);
  const [currency, update] = useState<Currency>('USD');
  const [refresh, setRefresh] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('alozuri-currency');
    } catch {}
    const configuration = api<{ supportedCurrencies?: string[] }>('/v1/config', {
      signal: controller.signal,
    })
      .then((config) =>
        SUPPORTED_CURRENCIES.filter((c) => c === 'USD' || config.supportedCurrencies?.includes(c)),
      )
      .catch<Currency[]>(() =>
        process.env.NEXT_PUBLIC_DEMO_MODE === 'false' ? [...SUPPORTED_CURRENCIES] : ['USD'],
      );
    // Existing localStorage preferences always win. Automatic suggestions are
    // never saved as a manual preference. The root provider survives navigation.
    const suggestion: Promise<Currency> = SUPPORTED_CURRENCIES.some((c) => c === saved)
      ? Promise.resolve('USD')
      : fetch('/api/currency', { cache: 'no-store', signal: controller.signal })
          .then(async (response) => {
            if (!response.ok) return 'USD' as const;
            const data: unknown = await response.json();
            if (!data || typeof data !== 'object' || !('currency' in data)) return 'USD' as const;
            return SUPPORTED_CURRENCIES.find((c) => c === data.currency) ?? 'USD';
          })
          .catch(() => 'USD');
    void Promise.all([configuration, suggestion]).then(([allowed, suggested]) => {
      if (!active) return;
      setAvailable(allowed);
      update(preferredCurrency(saved, suggested, allowed));
      setReady(true);
      clearTimeout(timeout);
    });
    const tick = () => {
      if (document.visibilityState === 'visible') setRefresh((n) => n + 1);
    };
    const timer = setInterval(tick, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  function setCurrency(value: Currency) {
    if (!ready || locked || !available.includes(value)) return;
    update(value);
    try {
      localStorage.setItem('alozuri-currency', value);
    } catch {}
  }
  return (
    <CurrencyContext.Provider
      value={{ currency, ready, refresh, setCurrency, available, locked: locked || !ready, lock }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}
export const useCurrency = () => useContext(CurrencyContext);
