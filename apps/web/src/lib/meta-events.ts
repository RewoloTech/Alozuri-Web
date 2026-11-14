// No personal information or payment/supplier credentials belong in these payloads.
export const META_PIXEL_ID = '1814512106538733';
export type MetaEventName = 'PageView' | 'ViewContent' | 'InitiateCheckout' | 'Purchase';
export type MetaData = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: 'product';
  num_items?: number;
};
export function metaMoney(totalCents: number, currency: string): MetaData | null {
  return Number.isSafeInteger(totalCents) && totalCents >= 0 && /^(GBP|USD|EUR)$/.test(currency)
    ? { value: totalCents / 100, currency }
    : null;
}
export function confirmedMetaPurchase(
  order: {
    id: string;
    paidAt?: string;
    test: boolean;
    status: string;
    totalCents: number;
    currency: string;
  },
  now = Date.now(),
): MetaData | null {
  const at = Date.parse(order.paidAt ?? '');
  // Do not turn old order lookups, refunds or Stripe test payments into new sales.
  if (
    !/^purchase_[a-f0-9]{48}$/.test(order.id) ||
    order.test ||
    !['paid', 'attention'].includes(order.status) ||
    !Number.isFinite(at) ||
    at > now ||
    now - at > 24 * 60 * 60 * 1000
  )
    return null;
  return metaMoney(order.totalCents, order.currency);
}
export async function metaEventId(name: MetaEventName, key: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${name}:${key}`));
  return (
    'alozuri_' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  );
}
export function metaSafeUrl(value: string) {
  const url = new URL(value);
  // Never load on account, sign-in, operations, private links or unrecognised queries.
  if (
    (url.hash !== '' && !['#planner', '#how-it-works'].includes(url.hash)) ||
    !/^\/(?:$|plans\/[^/]+$|destinations(?:\/[^/]+)?$|cart$|checkout$|checkout\/success$|help$|guides(?:\/[^/]+)?$|contact$|cookies$|privacy$|terms$|refund-policy$|acceptable-use$|esim-compatibility$)/.test(
      url.pathname,
    )
  )
    return false;
  const allowed =
    url.pathname === '/checkout/success'
      ? ['order']
      : [
          'countries',
          'country',
          'mode',
          'currency',
          'buy',
          'plan',
          'fbclid',
          'utm_source',
          'utm_medium',
          'utm_campaign',
          'utm_content',
          'utm_term',
        ];
  return [...url.searchParams].every(
    ([key, val]) => allowed.includes(key) && /^[a-zA-Z0-9_,. -]{0,200}$/.test(val),
  );
}
