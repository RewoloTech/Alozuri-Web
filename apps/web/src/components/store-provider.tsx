'use client';
import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { searchState, readSearch } from '@voyaspan/shared';
import { CurrencyProvider } from './currency-provider';
import { makeStore, restoreSearch } from '@/lib/store';
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);
  useEffect(() => {
    const fromUrl = readSearch(new URLSearchParams(window.location.search));
    if (fromUrl) store.dispatch(restoreSearch(fromUrl));
    else if (!store.getState().itinerary.initialized) {
      try {
        const saved = JSON.parse(sessionStorage.getItem('alozuri-search') || 'null');
        if (saved && typeof saved.single !== 'undefined' && Array.isArray(saved.trip))
          store.dispatch(
            restoreSearch(
              searchState(saved.single, saved.trip, saved.mode === 'trip' ? 'trip' : 'country'),
            ),
          );
      } catch {}
    }
    return store.subscribe(() => {
      try {
        const s = store.getState().itinerary;
        if (s.initialized) sessionStorage.setItem('alozuri-search', JSON.stringify(s));
      } catch {}
    });
  }, [store]);
  return (
    <CurrencyProvider>
      <Provider store={store}>{children}</Provider>
    </CurrencyProvider>
  );
}
