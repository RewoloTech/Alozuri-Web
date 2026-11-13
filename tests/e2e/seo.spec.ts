import { test, expect } from '@playwright/test';
import type { Server } from 'node:http';
import { createSeoApi } from '../fixtures/seo-api';
import { CONSENT_COOKIE, privacyChoice } from '../../packages/shared/src/privacy';
let api: Server;
test.beforeAll(async () => {
  api = createSeoApi();
  await new Promise<void>((resolve) => api.listen(8189, '127.0.0.1', resolve));
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => api.close((err) => (err ? reject(err) : resolve())));
});
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'Cache-Control': 'no-cache' });
  await context.addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
      domain: 'localhost',
      path: '/',
    },
  ]);
});
test('destination directory and priority landings contain useful crawlable server HTML', async ({
  page,
}) => {
  const directory = await page.request.get('/destinations', {
    headers: { 'Cache-Control': 'no-cache' },
  });
  const html = await directory.text();
  expect(html).toContain('href="/destinations/us"');
  expect(html).toContain('href="/destinations/gb"');
  for (const code of ['us', 'gb', 'jp', 'th', 'tr', 'ae']) {
    const response = await page.request.get('/destinations/' + code);
    expect(response.status()).toBe(200);
    const source = await response.text();
    expect(source).toContain('Common questions');
    expect(source).toContain('Verified fixture network');
    expect(source).toContain('$12.00');
    await page.goto('/destinations/' + code);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://alozuri.com/destinations/' + code,
    );
  }
});
test('Europe landing states its actual itinerary and guides remain readable on mobile', async ({
  page,
}) => {
  await page.goto('/destinations/europe');
  await expect(page.locator('h1')).toContainText('Europe');
  await expect(page.getByText('France, Germany and Italy', { exact: true })).toBeVisible();
  await expect(page.locator('.country-plan-conditions')).toContainText('France, Germany, Italy');
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.goto('/guides');
  await page
    .getByRole('link', {
      name: 'How much mobile data do you need for a 7-day or 14-day holiday?',
      exact: true,
    })
    .click();
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('article.travel-guide')).toContainText('3.5 GB');
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 390 || width === 1440)
      await page.screenshot({ path: `/tmp/alozuri-guide-${width}.png`, fullPage: true });
  }
});
test('product price and schema agree in SSR and after supported currency changes', async ({
  page,
}) => {
  const response = await page.request.get('/plans/seo-us', {
    headers: { 'Cache-Control': 'no-cache' },
  });
  const source = await response.text();
  expect(source).toContain('$12.00');
  expect(source).toContain('"price":"12.00"');
  await page.addInitScript(() => localStorage.setItem('alozuri-currency', 'USD'));
  await page.goto('/plans/seo-us');
  await expect(page.locator('.purchase-summary h2')).toContainText('$12.00');
  for (const [currency, price] of [
    ['GBP', '9.00'],
    ['EUR', '11.00'],
    ['USD', '12.00'],
  ]) {
    await page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption(currency);
    await expect(page.locator('.purchase-summary h2')).toContainText(currency);
    await expect
      .poll(async () => {
        const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
        return scripts.map((s) => JSON.parse(s)).find((s) => s['@type'] === 'Product')?.offers;
      })
      .toMatchObject({ price, priceCurrency: currency });
  }
  const missing = await page.request.get('/plans/seo-nonexistent', {
    headers: { 'User-Agent': 'Googlebot', 'Cache-Control': 'no-cache' },
  });
  expect(missing.status()).toBe(404);
  const uppercase = await page.request.get('/destinations/US', {
    maxRedirects: 0,
    headers: { 'User-Agent': 'Googlebot', 'Cache-Control': 'no-cache' },
  });
  expect(uppercase.status()).toBe(308);
  expect(uppercase.headers().location).toBe('/destinations/us');
});
test('private pages and duplicate filters have noindex headers; optional advertising stays off', async ({
  page,
}) => {
  for (const path of ['/operations', '/checkout', '/account/orders', '/cart']) {
    const response = await page.request.get(path);
    expect(response.headers()['x-robots-tag']).toContain('noindex');
  }
  expect(
    (await page.request.get('/destinations/us?allowance=10')).headers()['x-robots-tag'],
  ).toContain('noindex');
  const requested: string[] = [];
  page.on('request', (r) => {
    if (/facebook\.com|facebook\.net|google-analytics\.com/.test(r.url())) requested.push(r.url());
  });
  await page.goto('/destinations/us?utm_source=facebook&utm_medium=paid_social');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://alozuri.com/destinations/us',
  );
  expect(requested).toEqual([]);
});
