import { allowedStoreRequest, allowedStoreOrigin } from '@/lib/store-proxy';
function storeApiBase(): string {
  const value =
    process.env.ALOZURI_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '');
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
  ) {
    throw new Error('Invalid store API configuration');
  }
  return url.origin;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const LIMIT = 64 * 1024;
const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
};
function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers: privateHeaders });
}
async function relay(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;
  const path = '/' + segments.join('/');
  if (!allowedStoreRequest(request.method, path)) return failure('Unknown store operation.', 404);
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  // App Hosting may give Next.js an internal URL. The configured public origin
  // is trusted server configuration; client-supplied forwarded hosts are not.
  try {
    if (
      !allowedStoreOrigin(origin, url.origin, process.env.NEXT_PUBLIC_SITE_URL) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      return failure('Request origin not allowed.', 403);
  } catch {
    return failure('Store configuration is temporarily unavailable.', 503);
  }
  if (Number(request.headers.get('content-length') || 0) > LIMIT)
    return failure('Request is too large.', 413);
  let body: string | undefined;
  if (request.method !== 'GET') {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
      return failure('JSON request required.', 415);
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > LIMIT) {
          await reader.cancel();
          return failure('Request is too large.', 413);
        }
        chunks.push(chunk.value);
      }
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  for (const name of ['authorization', 'x-order-access']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(storeApiBase() + path + url.search, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
    });
    const responseHeaders = new Headers(privateHeaders);
    responseHeaders.set('Content-Type', 'application/json');
    const retryAfter = upstream.headers.get('retry-after');
    if (retryAfter) responseHeaders.set('Retry-After', retryAfter);
    if (!upstream.headers.get('content-type')?.includes('application/json'))
      return failure('The store service is temporarily unavailable. Please retry.', 502);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return failure(
      'We could not connect to the store. Your cart is saved. Please retry shortly.',
      503,
    );
  }
}
export { relay as GET, relay as POST, relay as PUT };
