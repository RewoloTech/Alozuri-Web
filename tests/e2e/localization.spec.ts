import { test, expect } from '@playwright/test';
import { LOCALES, LOCALE_COOKIE } from '../../packages/shared/src/i18n/locales';
import { loadMessages } from '../../packages/shared/src/i18n/catalogs';

test('all thirteen localized home routes render native copy and preserve currency when switching', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/en/?campaign=language#planner');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
  await page.locator('.site-header .currency-select').selectOption('EUR');
  for (const locale of LOCALES) {
    const messages = await loadMessages(locale);
    await page.locator('.site-header .language-selector select').selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale === 'en' ? 'en-GB' : locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('h1')).toContainText(messages.home.heroTitleA);
    await expect(page.locator('h1')).toContainText(messages.home.heroTitleB);
    await expect(page.locator('.steps-grid')).toContainText(messages.home.stepInstallText);
    await expect(page.locator('.destination-photo').first()).toHaveAttribute(
      'alt',
      messages.photoUi.JP,
    );
    await expect(page.locator('.faq-list')).toContainText(messages.home.faqPhoneAnswer);
    await expect(page.locator('.planner-tabs')).toContainText(messages.search.single);
    await expect(page.locator('.site-header .currency-select')).toHaveValue('EUR');
    await expect(page).toHaveURL((url) => url.pathname === (locale === 'en' ? '/' : '/' + locale));
    const url = new URL(page.url());
    expect(url.pathname).toBe(locale === 'en' ? '/' : '/' + locale);
    expect(url.searchParams.get('campaign')).toBe('language');
    expect(url.hash).toBe('#planner');
    await page.reload();
    await expect(page.locator('h1')).toContainText(messages.home.heroTitleA);
    await expect(page.locator('.site-header .currency-select')).toHaveValue('EUR');
  }
  expect(errors).toEqual([]);
});

test('Arabic keeps the intentional header and card order on mobile, tablet and desktop', async ({
  page,
}) => {
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/en/');
    const original = await page.locator('.site-header .brand').boundingBox();
    await page.locator('.site-header .language-selector select').selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.nav-wrap')).toHaveAttribute('dir', 'ltr');
    const brand = await page.locator('.site-header .brand').boundingBox();
    expect(Math.abs(brand!.x - original!.x)).toBeLessThanOrEqual(1);
    const currency = await page.locator('.site-header .currency-select').boundingBox();
    const language = await page.locator('.site-header .language-selector-control').boundingBox();
    expect(language!.x).toBeGreaterThanOrEqual(currency!.x + currency!.width);
    for (const control of await page
      .locator(
        '.site-header .header-cart, .site-header .currency-select, .site-header .language-selector-control, .site-header .mobile-toggle:visible',
      )
      .all()) {
      expect((await control.boundingBox())!.height).toBe(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('.site-header').screenshot({ path: `/tmp/alozuri-ar-header-${width}.png` });
    await page.locator('.hero').screenshot({ path: `/tmp/alozuri-ar-hero-${width}.png` });
    if (width < 900) {
      await page.locator('.mobile-toggle').click();
      await expect(page.getByRole('link', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
    }
  }
});

test('localized URLs preserve English aliases and protect private routes', async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: LOCALE_COOKIE, value: 'ar', domain: 'localhost', path: '/' }]);
  for (const locale of LOCALES.filter((value) => value !== 'en')) {
    const result = await page.request.get('/' + locale + '/cart?currency=EUR');
    expect(result.status()).toBe(200);
    expect(result.headers()['x-robots-tag']).toContain('noindex');
    expect(result.headers()['cache-control']).toContain('no-store');
    const privateApi = await page.request.get('/' + locale + '/api/store/v2/orders');
    expect(privateApi.status()).toBe(404);
    const privateOperations = await page.request.get('/' + locale + '/operations');
    expect(privateOperations.status()).toBe(404);
  }
  const redirect = await page.request.get('/en/cart?currency=EUR', { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers().location).toContain('/cart?currency=EUR');
  await page.goto('/operations/languages');
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'Administrator access is required',
  );
  await expect(page.getByTitle('Order confirmation sample')).toHaveCount(0);
});

test('localized destination, guide and partner pages render native body and metadata in every language', async ({
  page,
}) => {
  test.setTimeout(600_000);
  for (const locale of LOCALES) {
    const messages = await loadMessages(locale);
    const prefix = locale === 'en' ? '' : '/' + locale;
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(prefix + '/destinations/us');
    await expect(page.locator('.page-intro p')).toHaveText(messages.destinationCopy.USIntro);
    await expect(page).toHaveTitle(messages.destinationCopy.USTitle + ' | Alozuri');
    await page.locator('.faq-list details').last().locator('summary').click();
    await expect(page.locator('.faq-list').last()).toContainText(
      messages.destinationCopy.USAnswer2,
    );
    expect(
      await page.evaluate(() =>
        Array.from(document.querySelectorAll('body *')).flatMap((element) => {
          const r = element.getBoundingClientRect();
          return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1)
            ? [
                {
                  tag: element.tagName,
                  class: element.className,
                  text: element.textContent?.slice(0, 80),
                  x: r.x,
                  width: r.width,
                },
              ]
            : [];
        }),
      ),
    ).toEqual([]);
    await page
      .locator('.page-intro')
      .screenshot({ path: `/tmp/alozuri-country-${locale}-390.png` });
    await page.goto(prefix + '/guides/holiday-data-budget');
    await expect(page.locator('h1')).toHaveText(messages.guideCopy.budgetTitle);
    await expect(page.locator('.travel-guide')).toContainText(messages.guideCopy.budgetParagraph1B);
    await expect(page).toHaveTitle(messages.guideCopy.budgetTitle + ' | Alozuri');
    expect(
      await page.evaluate(() =>
        Array.from(document.querySelectorAll('body *')).flatMap((element) => {
          const r = element.getBoundingClientRect();
          return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1)
            ? [
                {
                  tag: element.tagName,
                  class: element.className,
                  text: element.textContent?.slice(0, 80),
                  x: r.x,
                  width: r.width,
                },
              ]
            : [];
        }),
      ),
    ).toEqual([]);
    await page.goto(prefix + '/partners');
    await expect(page.locator('h1')).toHaveText(messages.partnersUi.title);
    await expect(page).toHaveTitle(messages.partnersUi.metaTitle);
    await page.locator('.faq-list details').nth(4).locator('summary').click();
    await expect(page.locator('main')).toContainText(messages.partnersUi.termExcluded);
    await expect(page.locator('main')).toContainText(messages.partnersUi.a5);
    expect(
      await page.evaluate(() =>
        Array.from(document.querySelectorAll('body *')).flatMap((element) => {
          const r = element.getBoundingClientRect();
          return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1)
            ? [
                {
                  tag: element.tagName,
                  class: element.className,
                  text: element.textContent?.slice(0, 80),
                  x: r.x,
                  width: r.width,
                },
              ]
            : [];
        }),
      ),
    ).toEqual([]);
    await page.locator('main').screenshot({ path: `/tmp/alozuri-partners-${locale}-390.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(
      await page.evaluate(() =>
        Array.from(document.querySelectorAll('body *')).flatMap((element) => {
          const r = element.getBoundingClientRect();
          return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1)
            ? [
                {
                  tag: element.tagName,
                  class: element.className,
                  text: element.textContent?.slice(0, 80),
                  x: r.x,
                  width: r.width,
                },
              ]
            : [];
        }),
      ),
    ).toEqual([]);
  }
});

test('account forms render native labels and password controls in every language without mobile or desktop overflow', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const { privacyChoice, CONSENT_COOKIE } = await import('../../packages/shared/src/privacy');
  await page.context().addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
      domain: 'localhost',
      path: '/',
    },
  ]);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const locale of LOCALES) {
    const m = await loadMessages(locale);
    const prefix = locale === 'en' ? '' : '/' + locale;
    for (const [path, title] of [
      ['login', m.authUi.loginTitle],
      ['register', m.authUi.registerTitle],
      ['forgot-password', m.authUi.resetTitle],
    ] as const) {
      await page.setViewportSize({ width: 375, height: 900 });
      await page.goto(prefix + '/' + path);
      await expect(page.locator('h1')).toHaveText(title);
      const ageNotice = page.locator('.auth-panel > p.fine-print');
      await expect(ageNotice).toHaveCount(path === 'register' ? 1 : 0);
      if (path === 'register') {
        await expect(ageNotice.locator('a[href="' + prefix + '/terms"]')).toHaveText(m.legal.terms);
        await expect(ageNotice.locator('a[href="' + prefix + '/privacy"]')).toHaveText(
          m.legal.privacy,
        );
      }
      await expect(page.locator('.auth-panel')).toContainText(m.authUi.unconfigured);
      await expect(page.locator('input[name="email"]')).toHaveAttribute(
        'placeholder',
        m.authUi.email,
      );
      await expect(page.locator('input[name="email"]')).toHaveAttribute('dir', 'ltr');
      if (path === 'register') {
        await expect(page.locator('input[name="firstName"]')).toHaveAttribute(
          'placeholder',
          m.authUi.first,
        );
        await expect(page.locator('.name-fields label').first()).toHaveAttribute(
          'dir',
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        await expect(page.locator('label.checkbox-label')).toHaveAttribute('dir', 'ltr');
        await expect(page.locator('.support-shortcut')).toHaveCSS('position', 'static');
        await expect(
          page.locator('label.checkbox-label a[href="' + prefix + '/terms"]'),
        ).toHaveText(m.legal.terms);
        const password = page.locator('input[name="password"]');
        await password.fill('synthetic-only-password');
        await page.getByRole('button', { name: m.authUi.show, exact: true }).click();
        await expect(password).toHaveAttribute('type', 'text');
        await page.getByRole('button', { name: m.authUi.hide, exact: true }).click();
        await expect(password).toHaveAttribute('type', 'password');
      }
      for (const width of [375, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        if (locale === 'ar' && path === 'register' && [375, 1440].includes(width))
          await page.screenshot({
            path: `/tmp/alozuri-native-register-ar-${width}.png`,
            fullPage: true,
          });
      }
    }
  }
  expect(errors).toEqual([]);
});

test('manual English persists across visits, browser languages and currency changes', async ({
  browser,
}) => {
  const first = await browser.newContext({
    locale: 'de-DE',
    viewport: { width: 390, height: 844 },
  });
  const page = await first.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page).toHaveURL(/\/de$/);
  await page.locator('.site-header .language-selector select').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
  await expect(page).toHaveURL('http://localhost:3100/');
  await page.locator('.site-header .currency-select').selectOption('EUR');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
  await expect(page.locator('.site-header .currency-select')).toHaveValue('EUR');
  const cookies = await first.cookies();
  const manual = cookies.find((cookie) => cookie.name === 'alozuri_locale_explicit');
  expect(manual?.value).toBe('1');
  expect(manual!.expires).toBeGreaterThan(Date.now() / 1000 + 179 * 86400);
  await first.close();
  const returning = await browser.newContext({ locale: 'ja-JP' });
  await returning.addCookies(cookies);
  const next = await returning.newPage();
  await next.goto('/help');
  await expect(next.locator('html')).toHaveAttribute('lang', 'en-GB');
  await expect(next).toHaveURL('http://localhost:3100/help');
  await next.goto('/fr/help');
  await expect(next.locator('html')).toHaveAttribute('lang', 'fr');
  await next.goto('/en/help');
  await expect(next.locator('html')).toHaveAttribute('lang', 'en-GB');
  await returning.close();
});

test('client navigation honours explicitly requested languages and keeps checkout in that language', async ({
  page,
}) => {
  await page.goto('/en/e2e-fixtures/language-navigation');
  await page.locator('.site-header .currency-select').selectOption('EUR');
  await page.getByRole('link', { name: 'French URL', exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/e2e-fixtures\/language-navigation\?currency=EUR#links$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.getByRole('button', { name: 'Japanese URL', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await page.goBack();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.getByRole('link', { name: 'English URL', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
  await expect(page).toHaveURL(/\/e2e-fixtures\/language-navigation\?currency=EUR$/);
  await page.getByRole('button', { name: 'Japanese URL', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('link', { name: 'Checkout', exact: true })).toHaveAttribute(
    'href',
    '/ja/checkout',
  );
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  await expect(page).toHaveURL(/\/ja\/checkout$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.locator('.site-header .currency-select')).toHaveValue('EUR');
});
