'use client';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useMarketingConsent } from './privacy-provider';
import { enablePixel, pixelLibraryReady, trackMeta } from '@/lib/meta-pixel';
export function MetaTracking() {
  const allowed = useMarketingConsent();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [load, setLoad] = useState(false);
  const visit = useRef({ route: '', id: '' });
  useEffect(() => {
    const active = enablePixel(allowed);
    setLoad(active);
    const route = pathname + '?' + search;
    if (active) {
      if (visit.current.route !== route) visit.current = { route, id: crypto.randomUUID() };
      void trackMeta('PageView', {}, visit.current.id);
    } else visit.current.route = '';
  }, [allowed, pathname, search]);
  return load ? (
    <Script
      id="alozuri-meta-pixel"
      src="https://connect.facebook.net/en_US/fbevents.js"
      strategy="afterInteractive"
      onReady={pixelLibraryReady}
    />
  ) : null;
}
