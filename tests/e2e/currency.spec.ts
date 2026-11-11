import { createServer, type Server } from 'node:http';
import { test, expect } from '@playwright/test';
import { FEATURED_REGIONS, REGION_NAMES } from '../../packages/shared/src/featured';
import { CHECKOUT_LEGAL_ACCEPTANCE } from '../../packages/shared/src/legal';

let server: Server;
const price = (currency: string) => (currency === 'GBP' ? 900 : currency === 'EUR' ? 1100 : 1200);
const plan = (currency = 'USD') => ({
  id: 'currency-france',
  name: 'France currency test',
  countries: ['FR'],
  dataGb: 5,
  days: 30,
  priceCents: price(currency),
  currency,
  dataType: 'fixed',
  activation: 'Starts on first connection.',
  networks: [],
  fairUse: 'Fixed allowance.',
  demo: false,
  syncedAt: new Date().toISOString(),
});
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json');
    res.setHeader('access-control-allow-origin', 'http://localhost:3100');
    res.setHeader('access-control-allow-headers', 'content-type,cf-ipcountry,cf-ray');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url || '/', 'http://localhost');
    const currency = url.searchParams.get('currency') ?? 'USD';
    let data: unknown = {};
    if (url.pathname === '/v1/config')
      data = {
        supportedCurrencies: ['USD', 'GBP', 'EUR'],
        cartCheckoutMode: 'test',
        paymentMode: 'test',
      };
    else if (url.pathname === '/v1/countries')
      data = { countries: [{ code: 'FR', name: 'France', flag: '🇫🇷', region: 'Europe' }] };
    else if (url.pathname === '/v1/featured-bundles')
      data = {
        bundles: FEATURED_REGIONS.map((region) => ({
          region,
          regionName: REGION_NAMES[region],
          status: 'active',
          defaultDataGb: 10,
          updatedAt: new Date().toISOString(),
          // Match the shared server-rendered USD catalogue used by featured.spec:
          // Next's public fetch cache intentionally survives between test files.
          options: [5, 10, 20]
            .filter((gb) => region !== 'asia' || gb !== 5)
            .map((dataGb) => ({
              productId: `featured-${region}-${dataGb}`,
              dataGb,
              validityDays: dataGb === 20 ? 45 : 30,
              countryCount: dataGb === 20 ? 35 : 33,
              priceCents: (dataGb * price(currency)) / 10,
              currency,
            })),
        })),
      };
    else if (url.pathname === '/v1/packages/currency-france') data = { plan: plan(currency) };
    else if (url.pathname === '/v1/packages/match') data = { plans: [plan(currency)] };
    else if (url.pathname === '/v2/quote' || url.pathname === '/v2/checkout') {
      let text = '';
      for await (const chunk of req) text += chunk;
      const input = JSON.parse(text);
      const items = input.items.map((item: { quantity: number }) => ({
        plan: plan(input.currency),
        quantity: item.quantity,
      }));
      const total = items.reduce(
        (sum: number, item: { quantity: number }) => sum + price(input.currency) * item.quantity,
        0,
      );
      const quote = {
        items,
        currency: input.currency,
        subtotalCents: total,
        taxCents: 0,
        totalCents: total,
      };
      data = { quote };
    }
    res.end(JSON.stringify(data));
  });
  await new Promise<void>((resolve) => server.listen(8189, '127.0.0.1', resolve));
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

for (const [country, currency] of [
  ['GB', 'GBP'],
  ['JE', 'GBP'],
  ['GG', 'GBP'],
  ['IM', 'GBP'],
  ['DE', 'EUR'],
  ['CH', 'EUR'],
  ['MD', 'EUR'],
  ['US', 'USD'],
  ['CA', 'USD'],
  ['JP', 'USD'],
  ['XX', 'USD'],
])
  test(`${country} visitor starts in ${currency} without storing an automatic manual preference`, async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({ 'cf-ipcountry': country, 'cf-ray': 'a58fd7cb59b6b29c-LHR' });
    await page.goto('/');
    await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveValue(
      currency,
    );
    await expect(page.locator('.featured-price').first()).toContainText(currency);
    expect(await page.evaluate(() => localStorage.getItem('alozuri-currency'))).toBeNull();
  });

for (const [country, manual] of [
  ['GB', 'USD'],
  ['US', 'EUR'],
])
  test(`${country} visitor can choose ${manual} on mobile/desktop and retain it on return`, async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({ 'cf-ipcountry': country, 'cf-ray': 'a58fd7cb59b6b29c-LHR' });
    let detections = 0;
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/api/currency') detections++;
    });
    await page.goto('/');
    const selector = page.getByRole('combobox', { name: 'Currency', exact: true });
    await expect(selector).toBeEnabled();
    // Development Strict Mode may start and abort the first effect request.
    const initialDetections = detections;
    expect(initialDetections).toBeGreaterThan(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await selector.selectOption(manual);
    await expect(selector).toHaveValue(manual);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(selector).toHaveValue(manual);
    await page.getByRole('link', { name: 'Help centre', exact: true }).first().click();
    await expect(selector).toHaveValue(manual);
    expect(detections).toBe(initialDetections);
    await page.reload();
    await expect(selector).toHaveValue(manual);
    expect(detections).toBe(initialDetections);
    expect(await page.evaluate(() => localStorage.getItem('alozuri-currency'))).toBe(manual);
  });

test('delayed geography never exposes initial USD prices and failed detection falls back without blocking shopping', async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/currency', async (route) => {
    await gate;
    await route.fulfill({ json: { currency: 'GBP' } });
  });
  await page.goto('/');
  await expect(page.locator('.featured-price').first()).not.toContainText('$');
  await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveValue('GBP');
  await expect(page.locator('.featured-price').first()).toContainText('£9.00');
  await page.unroute('**/api/currency');
  await page.route('**/api/currency', (route) => route.abort());
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveValue('USD');
  await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toBeEnabled();
  await expect(page.locator('.featured-price').first()).toContainText('$12.00');
});

test('UK geography is independent of French destination and currency changes preserve cart items and checkout totals', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'cf-ipcountry': 'GB', 'cf-ray': 'a58fd7cb59b6b29c-LHR' });
  await page.goto('/plans/currency-france');
  await expect(page.locator('.purchase-summary h2')).toContainText('£9.00');
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page
      .locator('.purchase-summary')
      .screenshot({ path: `/tmp/alozuri-currency-gbp-${width}.png` });
  }
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart, 1 item' })).toBeVisible();
  await page.getByRole('link', { name: 'Shopping cart, 1 item' }).click();
  await expect(page.locator('.commerce-total')).toContainText('£9.00');
  await page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption('EUR');
  await expect(page.locator('.commerce-total')).toContainText('€11.00');
  await expect(page.getByRole('link', { name: 'Shopping cart, 1 item' })).toBeVisible();
  await page.getByRole('link', { name: /Secure checkout/ }).click();
  await page
    .getByRole('textbox', { name: 'Email address', exact: true })
    .fill('currency@example.test');
  await page.getByRole('textbox', { name: 'Confirm email address' }).fill('currency@example.test');
  await page.getByRole('checkbox').check();
  await expect(page.locator('.commerce-total')).toContainText('€11.00');
  const request = page.waitForRequest(
    (r) => r.url().endsWith('/v2/checkout') && r.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Continue to payment', exact: true }).click();
  const input = (await request).postDataJSON();
  expect(input.currency).toBe('EUR');
  expect(input.expectedTotalCents).toBe(1100);
  expect(input.legal).toEqual(CHECKOUT_LEGAL_ACCEPTANCE);
  expect(input.items).toEqual([{ planId: 'currency-france', quantity: 1 }]);
});
