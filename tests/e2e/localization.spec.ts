import { test, expect } from '@playwright/test';
import { LOCALES, LOCALE_COOKIE } from '../../packages/shared/src/i18n/locales';

test('draft locales stay private and English routes preserve navigation and currency preferences', async ({
  page,
}) => {
  await page
    .context()
    .addCookies([{ name: LOCALE_COOKIE, value: 'ar', domain: 'localhost', path: '/' }]);
  for (const locale of LOCALES.filter((value) => value !== 'en')) {
    const result = await page.request.get('/' + locale + '/cart?currency=EUR');
    expect(result.status()).toBe(404);
    expect(result.headers()['x-robots-tag']).toContain('noindex');
    expect(result.headers()['cache-control']).toContain('no-store');
  }
  const redirect = await page.request.get('/en/cart?currency=EUR', { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers().location).toContain('/cart?currency=EUR');
  await page.goto('/en/cart?from=language#details');
  await expect(page).toHaveURL(/\/cart\?from=language#details$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  const language = page.getByRole('combobox', { name: 'Language', exact: true });
  await expect(language).toBeVisible();
  await expect(language).toHaveValue('en');
  await expect(language.locator('option:enabled')).toHaveCount(1);
  await expect(language.locator('option:disabled')).toHaveCount(12);
  await page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption('EUR');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveValue('EUR');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  const currency = page.getByRole('combobox', { name: 'Currency', exact: true });
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await language.focus();
    await expect(language).toBeFocused();
    const currencyBox = await currency.boundingBox();
    const languageBox = await language.boundingBox();
    expect(languageBox!.x).toBeGreaterThanOrEqual(currencyBox!.x + currencyBox!.width);
    expect(languageBox!.width).toBeGreaterThanOrEqual(44);
    expect(languageBox!.height).toBeGreaterThanOrEqual(44);
    for (const control of await page
      .locator(
        '.site-header .header-cart, .site-header .currency-select, .site-header .language-selector-control, .site-header .mobile-toggle:visible',
      )
      .all()) {
      expect((await control.boundingBox())!.height).toBe(44);
    }
    await page
      .locator('.site-header')
      .screenshot({ path: `/tmp/alozuri-language-header-${width}.png` });
  }
  await language.selectOption('en');
  await expect(currency).toHaveValue('EUR');
  await expect(page).toHaveURL(/\/cart\?from=language#details$/);
});

test('language review page does not grant anonymous access to private previews', async ({
  page,
}) => {
  await page.goto('/operations/languages');
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'Administrator access is required',
  );
  await expect(page.getByTitle('Draft language email preview')).toHaveCount(0);
});
