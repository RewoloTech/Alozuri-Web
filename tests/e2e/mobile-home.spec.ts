import { test, expect } from '@playwright/test';
import { CONSENT_COOKIE, privacyChoice } from '../../packages/shared/src/privacy';
import { BUSINESS } from '../../packages/shared/src/legal';
import { POLICIES } from '../../packages/shared/src/policies';
import { searchPageFixture } from '../fixtures/search';
import type { Plan } from '../../packages/shared/src/index';

const plan: Plan = {
  id: 'mobile-trip',
  name: 'Europe connection',
  countries: ['FR', 'CH', 'IT'],
  dataGb: 5,
  days: 30,
  priceCents: 1499,
  currency: 'USD',
  dataType: 'fixed',
  activation: 'Starts on first connection.',
  networks: [],
  fairUse: 'Fixed total data.',
  syncedAt: new Date().toISOString(),
};
test.beforeEach(async ({ page }) => {
  await page.context().addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
      domain: 'localhost',
      path: '/',
    },
  ]);
  await page.route('http://127.0.0.1:8189/**', async (route) => {
    const url = new URL(route.request().url());
    const data =
      url.pathname === '/v1/config'
        ? {
            supportedCurrencies: ['USD', 'GBP', 'EUR'],
            paymentMode: 'test',
            cartCheckoutMode: 'test',
          }
        : url.pathname === '/v1/countries'
          ? {
              countries: [
                ['FR', 'France'],
                ['CH', 'Switzerland'],
                ['IT', 'Italy'],
                ['GS', 'South Georgia & South Sandwich Islands'],
              ].map(([code, name]) => ({ code, name, flag: '', region: 'Europe' })),
            }
          : url.pathname === '/v2/search/plans'
            ? searchPageFixture([plan])
            : { bundles: [] };
    await route.fulfill({
      json: data,
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
    });
  });
});

test('mobile hierarchy, navigation targets, footer columns and disclosures fit every requested width', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveValue('USD');
  const footer = page.locator('.site-footer');
  const hrefs = await footer
    .locator('.footer-links a')
    .evaluateAll((xs) => xs.map((x) => x.getAttribute('href')));
  expect(hrefs).toEqual([
    '/destinations',
    '/#planner',
    ...['terms', 'privacy', 'cookies', 'refunds', 'acceptable-use'].map((s) => POLICIES[s].path),
    '/help',
    POLICIES.compatibility.path,
    POLICIES.contact.path,
    '/account/esims',
    '/register',
  ]);
  await expect(footer.locator('.company-disclosure')).toContainText(BUSINESS.identity);
  await expect(footer.locator('address')).toContainText(BUSINESS.address);
  await expect(footer.locator('.company-disclosure a')).toHaveAttribute(
    'href',
    'mailto:' + BUSINESS.email,
  );
  for (const width of [320, 360, 375, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const secondary = page.locator('.hero-detail');
    if (width <= 600) {
      await expect(secondary).toBeHidden();
      await expect(page.locator('.hero-benefits > span:visible')).toHaveCount(2);
      await expect(page.locator('.hero-benefits')).toContainText('Instant delivery');
      await expect(page.locator('.hero-number-benefit')).toBeHidden();
      await expect(page.locator('.mobile-number-benefit')).toBeVisible();
      await expect(page.locator('.planner-heading p')).toBeHidden();
      const heading = await page.locator('.hero h1').evaluate((x) => getComputedStyle(x).fontSize);
      expect(heading).toBe('54px');
      for (const target of [
        page.locator('.header-cart'),
        page.getByRole('combobox', { name: 'Currency', exact: true }),
        page.getByRole('link', { name: /^Log in/ }),
        page.getByRole('button', { name: 'Open menu', exact: true }),
        page.locator('.add-country'),
        page.locator('.search-button'),
      ]) {
        const box = await target.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
      }
      await expect(page.locator('.support-shortcut')).toBeVisible();
      if (width === 390) {
        const planner = await page.locator('#planner').boundingBox(),
          cta = await page.locator('.search-button').boundingBox();
        expect(planner!.y).toBeLessThan(365);
        expect(cta!.y + cta!.height).toBeLessThan(760);
        await page.screenshot({ path: '/tmp/alozuri-mobile-after-390.png' });
        await footer.screenshot({ path: '/tmp/alozuri-footer-after-390.png' });
      }
    } else {
      await expect(secondary).toBeVisible();
      await expect(page.locator('.hero-number-benefit')).toBeVisible();
    }
    if (width >= 360 && width <= 768) {
      const explore = await page.locator('.footer-explore').boundingBox(),
        help = await page.locator('.footer-help').boundingBox(),
        legal = await page.locator('.footer-legal').boundingBox();
      expect(help!.x).toBe(explore!.x);
      expect(help!.y - explore!.y - explore!.height).toBeLessThanOrEqual(25);
      expect(legal!.x).toBeGreaterThan(explore!.x);
    }
    if (width === 1440) {
      await page.screenshot({ path: '/tmp/alozuri-mobile-after-1440.png' });
      await footer.screenshot({ path: '/tmp/alozuri-footer-after-1440.png' });
    }
  }
  for (const href of new Set(hrefs)) expect((await page.request.get(href!)).status()).toBe(200);
});

test('mobile search retains both modes, complete trip selection, currency and long country names', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/?mode=country&countries=FR');
  await page.getByRole('button', { name: 'Find my eSIM', exact: true }).click();
  await expect(page.locator('.plan-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Multi-country trip' }).click();
  for (const country of ['Switzerland', 'Italy']) {
    await page.locator('.add-country').click();
    await page.getByRole('textbox', { name: 'Search countries' }).fill(country);
    await page
      .getByRole('button', { name: new RegExp(country), exact: false })
      .last()
      .click();
  }
  await expect(page.locator('.country-chip')).toHaveCount(3);
  await page.getByRole('button', { name: 'Find my eSIM', exact: true }).click();
  await expect(page.locator('.plan-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Single destination' }).click();
  await expect(page.getByText(/Choose one country for a single-destination/)).toBeVisible();
  await page.getByRole('button', { name: 'Close country search' }).click();
  await page.getByRole('button', { name: 'Multi-country trip' }).click();
  await expect(page.locator('.country-chip')).toHaveCount(3);
  await page.getByRole('button', { name: 'Single destination' }).click();
  await page.getByRole('textbox', { name: 'Search countries' }).fill('South Georgia');
  await page
    .getByRole('button', { name: /South Georgia/ })
    .last()
    .click();
  await expect(page.locator('.country-chip')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption('GBP');
  await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveValue('GBP');
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Help centre' })
    .click();
  await expect(page).toHaveURL(/\/help$/);
});

test('mobile floating chat opens accessibly and returns keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.support-shortcut')).toBeVisible();
  const chat = page.locator('.support-shortcut');
  await chat.click();
  const dialog = page.getByRole('dialog', { name: 'Chat', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Enable chat' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(chat).toBeFocused();
  await page.goto('/e2e-fixtures/account-menu');
  const account = page.locator('main').getByRole('button', { name: 'My account', exact: true });
  await expect(account).toBeVisible();
  expect((await account.boundingBox())!.width).toBe(44);
  await account.click();
  await expect(page.getByRole('navigation', { name: 'Account navigation' })).toBeVisible();
});
