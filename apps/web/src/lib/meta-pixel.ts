import { CONSENT_COOKIE, readPrivacyChoice } from '@alozuri/shared/privacy';
import {
  META_PIXEL_ID,
  metaEventId,
  metaSafeUrl,
  type MetaData,
  type MetaEventName,
} from './meta-events';
type Pixel = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push?: Pixel;
  loaded: boolean;
  version: string;
};
declare global {
  interface Window {
    fbq?: Pixel;
    _fbq?: Pixel;
  }
}
let enabled = false;
const sent = new Set<string>();
let libraryReady = false;
const readyListeners = new Set<() => void>();
export function pixelLibraryReady() {
  libraryReady = true;
  for (const listener of readyListeners) listener();
}
export function onPixelReady(listener: () => void) {
  readyListeners.add(listener);
  if (libraryReady) listener();
  return () => {
    readyListeners.delete(listener);
  };
}
export function marketingConsentNow() {
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(CONSENT_COOKIE + '='))
    ?.slice(CONSENT_COOKIE.length + 1);
  return readPrivacyChoice(raw)?.marketing === true;
}
export function enablePixel(allowed: boolean) {
  enabled = allowed && marketingConsentNow() && metaSafeUrl(location.href);
  if (!enabled) {
    window.fbq?.('consent', 'revoke');
    // Drop queued hits if consent is withdrawn before the library finishes loading.
    if (window.fbq && !window.fbq.callMethod)
      window.fbq.queue = [
        ['consent', 'revoke'],
        ['set', 'autoConfig', false, META_PIXEL_ID],
        ['init', META_PIXEL_ID],
      ];
    return false;
  }
  if (!window.fbq) {
    const pixel: Pixel = Object.assign(
      function (...args: unknown[]) {
        if (pixel.callMethod) pixel.callMethod(...args);
        else pixel.queue.push(args);
      },
      { queue: [] as unknown[][], loaded: true, version: '2.0' },
    );
    pixel.push = pixel;
    window.fbq = window._fbq = pixel;
    pixel('set', 'autoConfig', false, META_PIXEL_ID);
    pixel('init', META_PIXEL_ID);
  }
  window.fbq('consent', 'grant');
  return true;
}
export async function trackMeta(
  name: MetaEventName,
  data: MetaData,
  key: string,
  persistent = false,
) {
  try {
    if (!enabled || !marketingConsentNow() || !metaSafeUrl(location.href)) return;
    const eventID = await metaEventId(name, key);
    if (!enabled || !marketingConsentNow() || !metaSafeUrl(location.href) || sent.has(eventID))
      return;
    const storageKey = 'alozuri-meta-' + eventID;
    if (persistent) {
      try {
        if (localStorage.getItem(storageKey)) return;
      } catch {
        /* memory fallback */
      }
    }
    window.fbq?.('track', name, data, { eventID });
    sent.add(eventID);
    if (persistent) {
      try {
        localStorage.setItem(storageKey, '1');
      } catch {
        /* tracking never blocks checkout */
      }
    }
  } catch {
    /* Advertising failure must never interrupt shopping. */
  }
}
