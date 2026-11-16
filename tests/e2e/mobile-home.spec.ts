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
  await expect(page.locator('.hero h1')).toHaveText('One eSIM.Every stop.');
  await expect(page.locator('.hero-benefits')).toHaveText('Instant deliveryNo roaming surprises');
  await expect(page.getByText('BUILT FOR THE WAY YOU TRAVEL')).toHaveCount(0);
  await expect(page.locator('.hero-description')).toHaveCount(0);
  await expect(page.locator('.planner-heading')).toHaveCount(0);
  await expect(page.locator('.country-field > .field-label')).toHaveCount(0);
  await expect(page.getByText('Coverage checked for every selected country')).toHaveCount(0);
  const footer = page.locator('.site-footer');
  const hrefs = await footer
    .locator('.footer-links a')
    .evaluateAll((xs) => xs.map((x) => x.getAttribute('href')));
  expect(hrefs).toEqual([
    '/destinations',
    '/#planner',
    '/destinations/europe',
    '/guides',
    '/partners',
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
    if (width <= 1000) {
      await expect(page.locator('.nav-actions > .header-login')).toBeHidden();
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      const login = page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Log in', exact: true });
      await expect(login).toBeVisible();
      await expect(login).toHaveAttribute('href', '/login');
      expect((await login.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const signup = page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Sign up', exact: true });
      await expect(signup).toBeVisible();
      await expect(signup).toHaveAttribute('href', '/register');
      expect((await signup.boundingBox())!.y).toBe((await login.boundingBox())!.y);
      expect((await signup.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(page.locator('.nav-actions > .nav-signup')).toBeHidden();
      if (width === 390)
        await page.locator('.main-nav').screenshot({ path: '/tmp/alozuri-mobile-menu-signup.png' });
      await page.getByRole('button', { name: 'Close menu', exact: true }).click();
    } else {
      await expect(page.locator('.nav-actions > .header-login')).toBeVisible();
      await expect(page.locator('.mobile-menu-login')).toBeHidden();
    }
    await expect(page.getByRole('button', { name: 'Multi-country trip', exact: true })).toHaveText(
      'Multi-country',
    );
    const benefit = page.locator('.promise-strip span').first();
    expect(await benefit.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
    if (width <= 600) {
      expect((await page.locator('.promise-strip').boundingBox())!.height).toBeLessThanOrEqual(139);
      await expect(page.locator('.hero-benefits > span:visible')).toHaveCount(2);
      await expect(page.locator('.hero-benefits')).toContainText('Instant delivery');
      await expect(page.locator('.mobile-number-benefit')).toBeVisible();
      const allowance = page.getByRole('combobox', { name: 'Data allowance', exact: true });
      await expect(allowance).toBeVisible();
      expect((await allowance.boundingBox())!.height).toBeLessThanOrEqual(50);
      const heading = await page.locator('.hero h1').evaluate((x) => getComputedStyle(x).fontSize);
      expect(heading).toBe('54px');
      for (const target of [
        page.locator('.header-cart'),
        page.getByRole('combobox', { name: 'Currency', exact: true }),
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
        expect(planner!.y).toBeLessThan(280);
        expect(cta!.y + cta!.height).toBeLessThan(620);
        await page.screenshot({ path: '/tmp/alozuri-mobile-after-390.png' });
        await footer.screenshot({ path: '/tmp/alozuri-footer-after-390.png' });
      }
    } else {
      await expect(page.locator('.hero-benefits > span')).toHaveCount(2);
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
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const chip of await page.locator('.country-chip').all()) await expect(chip).toBeVisible();
    await page
      .locator('#planner')
      .screenshot({ path: `/tmp/alozuri-planner-selected-${width}.png` });
  }
  await page.setViewportSize({ width: 320, height: 812 });

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
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Log in', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Sign up', exact: true })
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
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

test('sort labels fit completely on mobile and desktop and keep working', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/v2/search/plans') requests.push(url.searchParams.get('sort') || '');
  });
  await page.goto('/?mode=country&countries=FR');
  await page.getByRole('button', { name: 'Find my eSIM', exact: true }).click();
  const sort = page.getByRole('combobox', { name: 'Sort plans', exact: true });
  for (const width of [320, 360, 375, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const value of ['recommended', 'value', 'price', 'data']) {
      await sort.selectOption(value);
      await expect(sort).toHaveValue(value);
      const dimensions = await sort.evaluate((node: HTMLSelectElement) => {
        const style = getComputedStyle(node);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Text measurement unavailable');
        context.font = style.font;
        return {
          available:
            node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          needed: context.measureText(node.selectedOptions[0].text).width,
          height: node.getBoundingClientRect().height,
        };
      });
      expect(dimensions.available).toBeGreaterThanOrEqual(dimensions.needed);
      expect(dimensions.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    if (width === 390 || width === 1440) {
      await sort.selectOption('recommended');
      await page
        .locator('.results-heading')
        .screenshot({ path: `/tmp/alozuri-sort-labels-${width}.png` });
    }
  }
  for (const value of ['recommended', 'value', 'price', 'data']) expect(requests).toContain(value);
});
