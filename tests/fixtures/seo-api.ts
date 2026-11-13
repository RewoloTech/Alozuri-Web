import { createServer } from 'node:http';
import { countries, type Currency } from '../../packages/shared/src/index';
const priority = ['US', 'GB', 'FR', 'DE', 'IT', 'JP', 'TH', 'TR', 'AE'];
export function seoPlan(id: string, codes: string[], currency: Currency = 'USD') {
  return {
    id,
    name: `${codes.join(' / ')} travel data`,
    countries: codes,
    dataGb: 10,
    days: 30,
    priceCents: currency === 'GBP' ? 900 : currency === 'EUR' ? 1100 : 1200,
    currency,
    dataType: 'fixed',
    activation: 'Starts on first supported network connection.',
    networks: ['Verified fixture network'],
    fairUse: 'Fixed data allowance.',
    demo: false,
    syncedAt: '2026-11-13T00:00:00Z',
  };
}
export function createSeoApi() {
  return createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.setHeader('access-control-allow-origin', 'http://localhost:3100');
    res.setHeader('access-control-allow-headers', 'content-type');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost'),
      currency: Currency =
        url.searchParams.get('currency') === 'GBP'
          ? 'GBP'
          : url.searchParams.get('currency') === 'EUR'
            ? 'EUR'
            : 'USD';
    let data: unknown = {};
    if (url.pathname === '/v1/config')
      data = {
        supportedCurrencies: ['USD', 'GBP', 'EUR'],
        paymentMode: 'test',
        cartCheckoutMode: 'test',
      };
    else if (url.pathname === '/v1/countries')
      data = { countries: countries.filter((c) => priority.includes(c.code)) };
    else if (url.pathname === '/v1/catalogue/sitemap')
      data = { plans: [{ id: 'seo-us' }, { id: 'seo-gb' }, { id: 'seo-europe' }] };
    else if (url.pathname === '/v1/packages/match') {
      const codes = (url.searchParams.get('countries') ?? 'US').split(',');
      data = {
        plans: [
          seoPlan(
            codes.length > 1 ? 'seo-europe' : 'seo-' + codes[0].toLowerCase(),
            codes,
            currency,
          ),
        ],
      };
    } else if (url.pathname.startsWith('/v1/packages/seo-')) {
      const id = url.pathname.split('/').at(-1)!;
      if (!['seo-us', 'seo-gb', 'seo-europe'].includes(id)) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Plan unavailable.' }));
        return;
      }
      data = {
        plan: seoPlan(
          id,
          id === 'seo-europe' ? ['FR', 'DE', 'IT'] : [id.slice(4).toUpperCase()],
          currency,
        ),
      };
    } else if (url.pathname === '/v2/search/plans')
      data = { plans: [], total: 0, nextCursor: null, allowances: [], dataTypes: [] };
    else if (url.pathname === '/v1/featured-bundles') data = { bundles: [] };
    else {
      res.statusCode = 404;
      data = { error: 'Plan unavailable.' };
    }
    res.end(JSON.stringify(data));
  });
}
