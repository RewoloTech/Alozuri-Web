import { currencyForCountry } from '@alozuri/shared/currency';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  // Opt in only behind Cloudflare with IP Geolocation enabled. This is a
  // display preference, never an identity, tax, access or price authority.
  const cloudflare =
    process.env.CURRENCY_GEO_PROVIDER === 'cloudflare' &&
    /^[a-f\d]{16,32}-[A-Z]{3}$/i.test(request.headers.get('cf-ray') ?? '');
  return Response.json(
    { currency: currencyForCountry(cloudflare ? request.headers.get('cf-ipcountry') : null) },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'CF-IPCountry' } },
  );
}
