import { createServer, type Server } from 'node:http';
import { test, expect } from '@playwright/test';
import {
  FEATURED_REGIONS,
  REGION_NAMES,
  type FeaturedBundle,
} from '../../packages/shared/src/featured';
import { privacyChoice, CONSENT_COOKIE } from '../../packages/shared/src/privacy';
let server: Server;
let failCurrency = '',
  emptyAsia = false,
  scans = 0;
function bundles(currency: string): FeaturedBundle[] {
  return FEATURED_REGIONS.map((region) => ({
    region,
    regionName: REGION_NAMES[region],
    status: emptyAsia && region === 'asia' ? 'unavailable' : 'active',
    defaultDataGb: emptyAsia && region === 'asia' ? null : 10,
    updatedAt: new Date().toISOString(),
    options:
      emptyAsia && region === 'asia'
        ? []
        : [5, 10, 20]
            .filter((gb) => region !== 'asia' || gb !== 5)
            .map((dataGb) => ({
              productId: `featured-${region}-${dataGb}`,
              dataGb: dataGb === 5 ? 5 : dataGb === 10 ? 10 : 20,
              validityDays: dataGb === 20 ? 45 : 30,
              countryCount: dataGb === 20 ? 35 : 33,
              priceCents: dataGb * (currency === 'GBP' ? 100 : currency === 'EUR' ? 140 : 120),
              currency: currency === 'GBP' ? 'GBP' : currency === 'EUR' ? 'EUR' : 'USD',
            })),
  }));
}
function plan(id: string, currency: string) {
  for (const bundle of bundles(currency)) {
    const option = bundle.options.find((option) => option.productId === id);
    if (option)
      return {
        id,
        name: bundle.regionName + ' ' + option.dataGb + ' GB',
        countries: ['FR', 'DE', 'IT'],
        dataGb: option.dataGb,
        days: option.validityDays,
        priceCents: option.priceCents,
        currency: option.currency,
        dataType: 'fixed',
        activation: 'Starts on first connection.',
        fairUse: 'Fixed allowance.',
        networks: [],
        syncedAt: new Date().toISOString(),
        demo: false,
      };
  }
  return null;
}
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3100');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    const url = new URL(req.url || '/', 'http://localhost'),
      currency = url.searchParams.get('currency') || 'USD';
    let data: unknown;
    if (url.pathname === '/v1/config')
      data = {
        supportedCurrencies: ['USD', 'GBP', 'EUR'],
        cartCheckoutMode: 'test',
        paymentMode: 'test',
      };
    else if (url.pathname === '/v1/featured-bundles') {
      if (currency === failCurrency) {
        res.statusCode = 503;
        data = { error: 'Fixture exchange rates unavailable' };
      } else data = { bundles: bundles(currency) };
    } else if (url.pathname === '/v1/countries')
      data = { countries: [{ code: 'FR', name: 'France', flag: '🇫🇷', region: 'Europe' }] };
    else if (url.pathname.startsWith('/v1/packages/')) {
      const row = plan(url.pathname.split('/').at(-1) || '', currency);
      if (!row) res.statusCode = 404;
      data = { plan: row };
    } else if (url.pathname === '/v2/quote') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const input = JSON.parse(body),
        items = input.items.map((item: { planId: string; quantity: number }) => ({
          plan: plan(item.planId, input.currency),
          quantity: item.quantity,
        }));
      const total = items.reduce(
        (sum: number, item: { plan: { priceCents: number }; quantity: number }) =>
          sum + item.plan.priceCents * item.quantity,
        0,
      );
      data = {
        quote: {
          items,
          currency: input.currency,
          totalCents: total,
          subtotalCents: total,
          taxCents: 0,
        },
      };
    } else {
      if (url.pathname === '/v1/packages') scans++;
      res.statusCode = 404;
      data = { error: 'Not found' };
    }
    res.end(JSON.stringify(data));
  });
  await new Promise<void>((resolve) => server.listen(8189, '127.0.0.1', resolve));
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
test.beforeEach(async ({ context }) => {
  failCurrency = '';
  emptyAsia = false;
  scans = 0;
  await context.addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
      domain: 'localhost',
      path: '/',
    },
  ]);
});
test('homepage server-renders four precomputed cards above destinations without catalogue scans', async ({
  page,
}) => {
  const response = await page.request.get('/');
  const html = await response.text();
  expect(html.indexOf('Explore Regional')).toBeLessThan(html.indexOf('Where to next?'));
  expect(html).toContain('featured-europe-10');
  await page.goto('/');
  await expect(page.locator('.featured-card')).toHaveCount(4);
  await expect(page.locator('.featured-card h3')).toHaveText([
    'Europe',
    'Asia',
    'North America',
    'Global',
  ]);
  const asia = page
    .locator('.featured-card')
    .filter({ has: page.getByRole('heading', { name: 'Asia', exact: true }) });
  await expect(asia.getByRole('button', { name: '5 GB', exact: true })).toHaveCount(0);
  expect(scans).toBe(0);
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const cards = await page.locator('.featured-grid').boundingBox();
    const nextSection = await page.locator('.destinations-section .eyebrow').boundingBox();
    if (!cards || !nextSection) throw new Error('Homepage sections must be visible.');
    const sectionGap = nextSection.y - (cards.y + cards.height);
    expect(sectionGap).toBeGreaterThanOrEqual(0);
    expect(sectionGap).toBeLessThanOrEqual(64);
    if (width === 390)
      await page.screenshot({ path: '/tmp/alozuri-featured-mobile.png', fullPage: true });
    if (width === 1440)
      await page.screenshot({ path: '/tmp/alozuri-featured-desktop.png', fullPage: true });
  }
});
test('allowance updates the actual variant, price, validity and coverage while currency and cart flow remain consistent', async ({
  page,
}) => {
  await page.goto('/');
  const europe = page
    .locator('.featured-card')
    .filter({ has: page.getByRole('heading', { name: 'Europe', exact: true }) });
  await europe.getByRole('button', { name: '20 GB', exact: true }).click();
  await expect(europe).toContainText('20 GB · 45 days');
  await expect(europe).toContainText('Covers 35 countries');
  for (const [currency, price] of [
    ['GBP', '£20.00'],
    ['EUR', '€28.00'],
    ['USD', '$24.00'],
  ]) {
    await page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption(currency);
    await expect(europe.locator('.featured-price')).toContainText(price);
    await expect(europe.getByRole('button', { name: '20 GB', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
  await page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption('GBP');
  await expect(europe.locator('.featured-price')).toContainText('£20.00');
  await europe.getByRole('link', { name: 'View Europe 20 GB plan' }).click();
  await expect(page).toHaveURL(/\/plans\/featured-europe-20$/);
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart, 1 item' })).toBeVisible();
  await page.goto('/cart');
  await expect(page.locator('.commerce-total')).toContainText('£20.00');
  await expect(page.getByRole('link', { name: 'Secure checkout →', exact: true })).toHaveAttribute(
    'aria-disabled',
    'false',
  );
});
test('missing regions and unavailable currency never expose fictional options or converted prices', async ({
  page,
}) => {
  emptyAsia = true;
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption('EUR');
  const asia = page
    .locator('.featured-card')
    .filter({ has: page.getByRole('heading', { name: 'Asia', exact: true }) });
  await expect(asia).toContainText('Plans currently unavailable');
  await expect(asia.getByRole('link')).toHaveCount(0);
  failCurrency = 'GBP';
  await page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption('GBP');
  await expect(
    page.getByText('Bundle prices are temporarily unavailable. Please try again later.'),
  ).toBeVisible();
  await expect(page.locator('.featured-card a').first()).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.featured-price').first()).not.toContainText('$');
});
