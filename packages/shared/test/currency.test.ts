import assert from 'node:assert/strict';
import test from 'node:test';
import { currencyForCountry, preferredCurrency } from '../src/currency.ts';
import { GET } from '../../../apps/web/src/app/api/currency/route.ts';

test('initial currencies cover the UK dependencies, European non-EU countries and worldwide fallback', () => {
  for (const code of ['GB', 'JE', 'GG', 'IM']) assert.equal(currencyForCountry(code), 'GBP');
  for (const code of ['DE', 'CH', 'MD', 'NO', 'IS', 'UA', 'RS', 'AL', 'ME', 'MK', 'BA'])
    assert.equal(currencyForCountry(code), 'EUR');
  for (const code of ['US', 'CA', 'JP', 'ZZ', 'XX', 'T1', '', 'GBR'])
    assert.equal(currencyForCountry(code), 'USD');
  assert.equal(currencyForCountry(undefined), 'USD');
  assert.equal(currencyForCountry(null), 'USD');
  assert.equal(currencyForCountry(' ch '), 'EUR');
});

test('transcontinental and territory policy is explicit and independent of EU membership', () => {
  for (const code of ['RU', 'TR', 'GE', 'AM', 'AZ', 'KZ', 'CY', 'FO', 'AX', 'SJ', 'GI', 'XK'])
    assert.equal(currencyForCountry(code), 'EUR');
  for (const code of ['GL', 'GF', 'GP', 'MQ', 'RE', 'YT', 'AW', 'CW', 'FK'])
    assert.equal(currencyForCountry(code), 'USD');
});

test('saved manual currency wins over geography and unsupported values cannot select arbitrary currencies', () => {
  const available = ['USD', 'GBP', 'EUR'] as const;
  assert.equal(preferredCurrency('USD', 'GBP', available), 'USD');
  assert.equal(preferredCurrency('EUR', 'USD', available), 'EUR');
  assert.equal(preferredCurrency(null, 'GBP', available), 'GBP');
  assert.equal(preferredCurrency('invalid', 'EUR', available), 'EUR');
  assert.equal(preferredCurrency('EUR', 'GBP', ['USD']), 'USD');
});

test('country endpoint requires provider opt-in and Cloudflare metadata, isolates responses and stores no IP/country', async () => {
  const previous = process.env.CURRENCY_GEO_PROVIDER;
  const request = (country: string, ray = 'a58fd7cb59b6b29c-LHR') =>
    new Request('https://alozuri.com/api/currency', {
      headers: { 'cf-ipcountry': country, 'cf-ray': ray },
    });
  try {
    delete process.env.CURRENCY_GEO_PROVIDER;
    assert.deepEqual(await GET(request('GB')).json(), { currency: 'USD' });
    process.env.CURRENCY_GEO_PROVIDER = 'cloudflare';
    assert.deepEqual(await GET(request('GB', '')).json(), { currency: 'USD' });
    const uk = GET(request('GB'));
    assert.equal(uk.headers.get('cache-control'), 'private, no-store, max-age=0');
    assert.deepEqual(await uk.json(), { currency: 'GBP' });
    assert.deepEqual(await GET(request('DE')).json(), { currency: 'EUR' });
    assert.deepEqual(await GET(request('US')).json(), { currency: 'USD' });
    assert.deepEqual(await GET(request('unknown')).json(), { currency: 'USD' });
  } finally {
    if (previous === undefined) delete process.env.CURRENCY_GEO_PROVIDER;
    else process.env.CURRENCY_GEO_PROVIDER = previous;
  }
});
