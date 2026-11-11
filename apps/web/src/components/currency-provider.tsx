'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SUPPORTED_CURRENCIES, type Currency } from '@voyaspan/shared';

const CurrencyContext = createContext<{
  currency: Currency;
  refresh: number;
  setCurrency: (value: Currency) => void;
  available: Currency[];
  locked: boolean;
  lock: (value: boolean) => void;
}>({
  currency: 'USD',
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
  useEffect(() => {
    let active = true;
    void api<{ supportedCurrencies?: string[] }>('/v1/config')
      .then((config) => {
        if (!active) return;
        const allowed = SUPPORTED_CURRENCIES.filter(
          (c) => c === 'USD' || config.supportedCurrencies?.includes(c),
        );
        setAvailable(allowed);
        try {
          update(allowed.find((c) => c === localStorage.getItem('alozuri-currency')) ?? 'USD');
        } catch {}
      })
      .catch(() => {});
    const tick = () => {
      if (document.visibilityState === 'visible') setRefresh((n) => n + 1);
    };
    const timer = setInterval(tick, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  function setCurrency(value: Currency) {
    if (locked || !available.includes(value)) return;
    update(value);
    try {
      localStorage.setItem('alozuri-currency', value);
    } catch {}
  }
  return (
    <CurrencyContext.Provider value={{ currency, refresh, setCurrency, available, locked, lock }}>
      {children}
    </CurrencyContext.Provider>
  );
}
export const useCurrency = () => useContext(CurrencyContext);
