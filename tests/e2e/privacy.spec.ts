import { createServer, type Server } from 'node:http';
import { test, expect } from '@playwright/test';
import { CONSENT_COOKIE, privacyChoice } from '../../packages/shared/src/privacy';
import { POLICIES } from '../../packages/shared/src/policies';

let catalogue: Server;
const seoPlan = {
  id: 'seo-plan',
  name: 'France SEO <script>window.__seoInjection=true</script>',
  countries: ['FR'],
  dataGb: 50,
  days: 30,
  priceCents: 2849,
  currency: 'USD',
  dataType: 'fixed',
  activation: 'Starts on first connection.',
  networks: [],
  fairUse: 'Fixed data allowance.',
  demo: false,
  syncedAt: new Date().toISOString(),
  supplierCode: 'DO_NOT_LEAK_SUPPLIER',
  supplierCostUsdCents: 1700,
};
test.beforeAll(async () => {
  catalogue = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.setHeader('access-control-allow-origin', 'http://localhost:3100');
    res.setHeader('access-control-allow-headers', 'content-type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const path = new URL(req.url || '/', 'http://localhost').pathname;
    const data =
      path === '/v1/config'
        ? { supportedCurrencies: ['USD'], cartCheckoutMode: 'test', paymentMode: 'test' }
        : path === '/v1/countries'
          ? { countries: [{ code: 'FR', name: 'France', flag: '🇫🇷', region: 'Europe' }] }
          : path === '/v1/packages/seo-plan'
            ? { plan: seoPlan }
            : path === '/v1/packages/match'
              ? { plans: [seoPlan] }
              : path === '/v1/catalogue/sitemap'
                ? { plans: [{ id: 'seo-plan', syncedAt: seoPlan.syncedAt }] }
                : null;
    if (!data) res.statusCode = 404;
    res.end(JSON.stringify(data || { error: 'Not found' }));
  });
  await new Promise<void>((resolve) => catalogue.listen(8189, '127.0.0.1', resolve));
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    catalogue.close((error) => (error ? reject(error) : resolve())),
  );
});
test('optional providers stay unloaded before consent, after rejection, acceptance and withdrawal', async ({
  page,
}) => {
  const optional: string[] = [];
  page.on('request', (request) => {
    if (
      /tawk\.|google-analytics|googletagmanager|fonts\.googleapis|fonts\.gstatic|images\.unsplash/.test(
        request.url(),
      )
    )
      optional.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Privacy choices' })).toBeVisible();
  await page.getByRole('button', { name: 'Reject optional', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Privacy choices' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Privacy choices' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cookie settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cookie settings' });
  await expect(dialog.getByRole('checkbox')).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Accept all', exact: true }).click();
  await page.goto('/contact');
  const chat = page.getByRole('link', { name: 'Open Tawk.to chat in a new tab' });
  await expect(chat).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(chat).toHaveAttribute(
    'href',
    'https://tawk.to/chat/6af3c3323853833c48d84ca1/1k7434vas',
  );
  await page.getByRole('button', { name: 'Cookie settings', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Reject optional', exact: true })
    .click();
  await expect(chat).toHaveCount(0);
  expect(optional).toEqual([]);
});

test('privacy settings support keyboard dismissal, expired consent and mobile layouts', async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(true, 0))),
      domain: 'localhost',
      path: '/',
    },
  ]);
  await page.goto('/cookies');
  await expect(page.getByRole('region', { name: 'Privacy choices' })).toBeVisible();
  await page.getByRole('button', { name: 'Customise choices' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Customise choices' })).toBeFocused();
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole('button', { name: 'Reject optional', exact: true }).click();
  await page.screenshot({ path: '/tmp/alozuri-legal-cookie-desktop.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/alozuri-legal-cookie-mobile.png', fullPage: false });
});

test('all policies contain company details, version and canonical metadata; legacy URLs redirect', async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
      domain: 'localhost',
      path: '/',
    },
  ]);
  for (const policy of Object.values(POLICIES)) {
    await page.goto(policy.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(policy.title);
    await expect(page.locator('.policy-company')).toContainText('16297656');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://alozuri.com' + policy.path,
    );
    await expect(page.locator('.policy-version')).toContainText('2026-11-11.1');
  }
  await page.goto('/legal/privacy');
  await expect(page).toHaveURL(/\/privacy$/);
  const robots = await page.request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('Disallow: /');
  const sitemap = await page.request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).not.toContain('/checkout');
  await page.goto('/checkout?order=private-test');
  expect(
    (await page.request.get('/checkout?order=private-test')).headers()['x-robots-tag'],
  ).toContain('noindex');
  const structured = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(structured.join('')).not.toContain('private-test');
});

test('public products render server-side with safe Product/Offer and breadcrumb data', async ({
  page,
}) => {
  const response = await page.request.get('/plans/seo-plan');
  const html = await response.text();
  expect((await page.request.get('/plans/missing-plan')).status()).toBe(404);
  expect(html).toContain('France SEO &lt;script&gt;');
  expect(html).not.toContain('DO_NOT_LEAK_SUPPLIER');
  expect(html).not.toContain('supplierCostUsdCents');
  await page.goto('/plans/seo-plan');
  const data = await page.locator('script[type="application/ld+json"]').allTextContents();
  const product = data
    .map((text) => JSON.parse(text))
    .find((value) => value['@type'] === 'Product');
  expect(product.offers.price).toBe('28.49');
  expect(product.offers.priceCurrency).toBe('USD');
  expect(await page.evaluate(() => Object.hasOwn(window, '__seoInjection'))).toBe(false);
  await page.goto('/destinations/fr');
  await expect(page.getByRole('region', { name: 'Current local plans' })).toBeVisible();
  await expect(page.locator('.plan-card a').first()).toHaveAttribute('href', '/plans/seo-plan');
});

test('sign-up hover keeps readable text and checkbox labels align on desktop and mobile', async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
      domain: 'localhost',
      path: '/',
    },
  ]);
  await page.goto('/');
  const signup = page.getByRole('link', { name: 'Sign up', exact: true });
  await signup.hover();
  await expect
    .poll(() => signup.evaluate((node) => getComputedStyle(node).color))
    .toBe('rgb(255, 255, 255)');
  await expect
    .poll(() => signup.evaluate((node) => getComputedStyle(node).backgroundColor))
    .toBe('rgb(54, 43, 168)');
  await page.screenshot({ path: '/tmp/alozuri-signup-hover.png' });
  async function aligned(label: ReturnType<typeof page.locator>) {
    const checkbox = await label.locator('input[type="checkbox"]').boundingBox();
    const text = await label.locator('span').first().boundingBox();
    expect(checkbox).not.toBeNull();
    expect(text).not.toBeNull();
    if (!checkbox || !text) throw new Error('Checkbox label must be visible');
    expect(checkbox.x + checkbox.width).toBeLessThan(text.x);
    expect(Math.abs(checkbox.y - text.y)).toBeLessThanOrEqual(5);
  }
  for (const width of [1440, 390, 375]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/register');
    const terms = page.locator('label.checkbox-label').filter({ hasText: 'I agree to the' });
    await aligned(terms);
    await expect(terms.getByRole('link', { name: 'Terms', exact: true })).toHaveAttribute(
      'href',
      '/terms',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 390)
      await page.screenshot({ path: '/tmp/alozuri-register-checkbox-mobile.png', fullPage: true });
    await page.goto('/destinations/fr');
    const regional = page
      .locator('label.checkbox-label')
      .filter({ hasText: 'Also show regional and global plans' });
    await aligned(regional);
    await expect(regional.getByRole('checkbox')).not.toBeChecked();
    if (width === 390)
      await page.screenshot({ path: '/tmp/alozuri-regional-checkbox-mobile.png', fullPage: true });
  }
});
