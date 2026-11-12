// Only storefront operations may use the same-origin transport. No internal jobs,
// webhooks, arbitrary hosts or privileged credentials are forwarded.
export function allowedStoreRequest(method: string, path: string): boolean {
  const id = '[a-zA-Z0-9_-]{1,100}';
  const reads = [
    '^/v1/(config|countries|featured-bundles|packages|packages/match)$',
    `^/v1/packages/${id}$`,
    '^/v2/search/plans$',
    '^/v2/(cart|orders)$',
    `^/v2/orders/${id}(/contract\\.pdf|/units/${id}/(activation|usage))?$`,
    `^/v1/orders(/${id}(/activation|/payment-status)?)?$`,
  ];
  if (method === 'GET') return reads.some((pattern) => new RegExp(pattern).test(path));
  if (method === 'POST') return ['/v2/quote', '/v2/checkout', '/v2/cart/merge'].includes(path);
  return method === 'PUT' && path === '/v2/cart';
}

export function allowedStoreOrigin(
  origin: string | null,
  requestOrigin: string,
  publicSite?: string,
): boolean {
  const configured = publicSite ? new URL(publicSite).origin : undefined;
  return !origin || origin === requestOrigin || origin === configured;
}
