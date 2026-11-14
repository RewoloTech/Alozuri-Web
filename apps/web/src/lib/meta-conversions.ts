import { readPrivacyChoice, CONSENT_COOKIE } from '@alozuri/shared/privacy';
import { META_PIXEL_ID, confirmedMetaPurchase, metaEventId } from './meta-events';
import { allowedStoreOrigin } from './store-proxy';
export async function sendMetaPurchase(request: Request, send: typeof fetch = fetch) {
  const reply = (status: number, result: string) =>
    Response.json(
      { result },
      {
        status,
        headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
      },
    );
  try {
    const url = new URL(request.url);
    if (
      !request.headers.get('origin') ||
      !allowedStoreOrigin(
        request.headers.get('origin'),
        url.origin,
        process.env.NEXT_PUBLIC_SITE_URL,
      ) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      return reply(403, 'forbidden');
    const cookies = new Map(
      (request.headers.get('cookie') ?? '').split('; ').map((c) => {
        const index = c.indexOf('=');
        return [c.slice(0, index), c.slice(index + 1)];
      }),
    );
    if (!readPrivacyChoice(cookies.get(CONSENT_COOKIE))?.marketing) return reply(200, 'no consent');
    const token = process.env.META_CONVERSIONS_API_TOKEN;
    const version = process.env.META_GRAPH_API_VERSION;
    const fbp = cookies.get('_fbp');
    // No token in browser configuration; no server transmission until explicitly configured.
    if (
      !token ||
      !version ||
      !/^v\d+\.0$/.test(version) ||
      !fbp ||
      !/^fb\.\d\.\d{13}\.\d{1,30}$/.test(fbp)
    )
      return reply(200, 'disabled');
    if (
      !request.headers.get('content-type')?.startsWith('application/json') ||
      Number(request.headers.get('content-length') ?? 0) > 200
    )
      return reply(400, 'invalid');
    const reader = request.body?.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    if (reader)
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 200) {
          await reader.cancel();
          return reply(413, 'too large');
        }
        chunks.push(chunk.value);
      }
    const input: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (
      !input ||
      typeof input !== 'object' ||
      !('orderId' in input) ||
      typeof input.orderId !== 'string' ||
      !/^purchase_[a-f0-9]{48}$/.test(input.orderId)
    )
      return reply(400, 'invalid');
    const base = new URL(process.env.ALOZURI_API_URL || process.env.NEXT_PUBLIC_API_URL || '');
    if (
      base.username ||
      base.password ||
      base.pathname !== '/' ||
      base.search ||
      base.hash ||
      (base.protocol !== 'https:' &&
        !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)))
    )
      return reply(503, 'unavailable');
    const headers = new Headers();
    for (const key of ['authorization', 'x-order-access']) {
      const value = request.headers.get(key);
      if (value) headers.set(key, value);
    }
    if (!headers.has('authorization') && !headers.has('x-order-access'))
      return reply(403, 'forbidden');
    const response = await send(base.origin + '/v2/orders/' + input.orderId, {
      headers,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return reply(403, 'forbidden');
    const order: unknown = await response.json();
    if (
      !order ||
      typeof order !== 'object' ||
      !('id' in order) ||
      order.id !== input.orderId ||
      !('paidAt' in order) ||
      typeof order.paidAt !== 'string' ||
      !('test' in order) ||
      typeof order.test !== 'boolean' ||
      !('status' in order) ||
      typeof order.status !== 'string' ||
      !('totalCents' in order) ||
      typeof order.totalCents !== 'number' ||
      !('currency' in order) ||
      typeof order.currency !== 'string'
    )
      return reply(200, 'not confirmed');
    const data = confirmedMetaPurchase({
      id: order.id,
      paidAt: order.paidAt,
      test: order.test,
      status: order.status,
      totalCents: order.totalCents,
      currency: order.currency,
    });
    if (!data) return reply(200, 'not confirmed');
    const result = await send(`https://graph.facebook.com/${version}/${META_PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        access_token: token,
        data: [
          {
            event_name: 'Purchase',
            event_time: Math.floor(Date.parse(order.paidAt) / 1000),
            event_id: await metaEventId('Purchase', order.id),
            action_source: 'website',
            event_source_url: 'https://alozuri.com/checkout/success',
            user_data: { fbp, client_user_agent: request.headers.get('user-agent') ?? '' },
            custom_data: data,
          },
        ],
        ...(process.env.META_TEST_EVENT_CODE
          ? { test_event_code: process.env.META_TEST_EVENT_CODE }
          : {}),
      }),
    });
    // Never return Meta's response, tokens, order data or errors to the browser or logs.
    const receipt: unknown = result.ok ? await result.json() : null;
    const accepted = Boolean(
      receipt &&
      typeof receipt === 'object' &&
      'events_received' in receipt &&
      receipt.events_received === 1,
    );
    return reply(accepted ? 200 : 503, accepted ? 'accepted' : 'unavailable');
  } catch {
    return reply(503, 'unavailable');
  }
}
