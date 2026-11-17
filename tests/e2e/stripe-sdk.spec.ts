import { privacyChoice, CONSENT_COOKIE } from '../../packages/shared/src/privacy';
import { test, expect, type Frame } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { LOCALES } from '../../packages/shared/src/i18n/locales';
test.beforeEach(async ({ page }, info) => {
  const locale = LOCALES.find((value) => info.title.includes('saved ' + value + ' order')) ?? 'en';
  await page.route('http://127.0.0.1:8189/**', (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        'x-forwarded-for': '198.51.100.' + (LOCALES.indexOf(locale) + 1),
      },
    }),
  );
});
test.skip(
  process.env.STRIPE_INTEGRATION !== '1',
  'Run with npm run test:stripe and matching local Stripe test keys.',
);
test('real Stripe Payment Element declines a test card, retries the same intent and completes a sandbox payment', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.context().addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
      domain: 'localhost',
      path: '/',
    },
  ]);
  let requests = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/v2/checkout') && r.method() === 'POST') requests++;
  });
  await page.goto('/plans/' + (process.env.STRIPE_PLAN_ID || 'esim-stripe-integration'));
  const currency = process.env.STRIPE_TEST_CURRENCY || 'USD';
  if (currency !== 'USD') {
    await page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption(currency);
    await expect(page.locator('.purchase-summary small')).toHaveText(currency);
  }
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart, 1 item' })).toBeVisible();
  await page.goto('/checkout');
  await page
    .getByRole('textbox', { name: 'Email address', exact: true })
    .fill('checkout-test@example.com');
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  let paymentFrame: Frame | undefined;
  await expect
    .poll(
      async () => {
        for (const candidate of page.frames()) {
          if (
            await candidate
              .getByRole('textbox', { name: 'Card number', exact: true })
              .count()
              .catch(() => 0)
          ) {
            paymentFrame = candidate;
            return true;
          }
        }
        return false;
      },
      { timeout: 45000 },
    )
    .toBe(true);
  if (!paymentFrame) throw new Error('Stripe card form did not load.');
  // Record names/lifetimes only; never include cookie values or payment credentials.
  const observedAt = Date.now() / 1000;
  writeFileSync(
    '/tmp/alozuri-stripe-storage-audit.json',
    JSON.stringify(
      {
        environment: 'Stripe test mode with local emulator',
        observedAt: new Date().toISOString(),
        cookies: (await page.context().cookies()).map(
          ({ name, domain, expires, secure, sameSite }) => ({
            name,
            domain,
            remainingSeconds: expires < 0 ? null : Math.round(expires - observedAt),
            secure,
            sameSite,
          }),
        ),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  const frame = paymentFrame;
  const country = frame.getByRole('combobox', { name: 'Country/Territory', exact: true });
  if (await country.count()) await country.selectOption('US');
  const firstCard = frame.getByRole('textbox', { name: 'Card number', exact: true });
  await firstCard.pressSequentially('4000000000009995', { delay: 25 });
  await firstCard.press('Tab');
  await frame.getByRole('textbox', { name: /Expiration|Expiry|MM/ }).fill('1230');
  await frame.getByRole('textbox', { name: /Security code|CVC/ }).fill('123');
  const postal = frame.getByRole('textbox', { name: /ZIP|Postal/ });
  if (await postal.count()) {
    await postal.fill('10001');
    await postal.press('Tab');
  }
  await page.screenshot({ path: 'test-results/stripe-real-form.png', fullPage: true });
  await page.getByRole('button', { name: /^Pay / }).click();
  await expect(page.getByRole('alert').filter({ hasText: /declined|insufficient/i })).toContainText(
    /declined|insufficient/i,
    { timeout: 30000 },
  );
  const retryCard = frame.getByRole('textbox', { name: 'Card number', exact: true });
  await retryCard.fill('');
  // Stripe's masked input updates on individual key events; exercise a real replacement card.
  await retryCard.pressSequentially('4242424242424242', { delay: 25 });
  await retryCard.press('Tab');
  await frame.getByRole('textbox', { name: /Expiration|Expiry|MM/ }).fill('1230');
  const retryCvc = frame.getByRole('textbox', { name: 'Security code', exact: true });
  await retryCvc.fill('123');
  await retryCvc.press('Tab');
  // Stripe can expand its optional Link fields when the replacement card blurs.
  // Keyboard activation avoids racing that iframe's changing height.
  const retryPayment = page.getByRole('button', { name: /^Pay / });
  await retryPayment.focus();
  await retryPayment.press('Enter');
  await expect(page.getByRole('heading', { name: 'Your test order', exact: true })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.getByText('Payment: Paid', { exact: true })).toBeVisible({ timeout: 30000 });
  expect(requests).toBe(1);
  const documents = page.locator('details.order-documents');
  await expect(documents).not.toHaveAttribute('open', '');
  await documents.getByText('Order documents', { exact: true }).click();
  await expect(documents.getByRole('button', { name: 'Download your contract PDF' })).toBeVisible();
  await page.screenshot({ path: 'test-results/stripe-real-confirmation.png', fullPage: true });
});

// Actual Stripe sandbox, never live keys. The first English case above covers
// decline/retry; each remaining order verifies native Elements and confirmation.
for (const locale of [
  'es',
  'de',
  'fr',
  'it',
  'pt-BR',
  'ro',
  'ja',
  'ko',
  'zh-Hans',
  'ar',
  'nl',
  'pl',
] as const)
  test(`real Stripe sandbox completes a saved ${locale} order`, async ({ page }) => {
    test.setTimeout(120_000);
    const { loadMessages } = await import('../../packages/shared/src/i18n/catalogs');
    const { createTranslator } = await import('use-intl/core');
    const messages = await loadMessages(locale);
    const t = createTranslator({ locale, messages });
    await page.context().addCookies([
      {
        name: CONSENT_COOKIE,
        value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
        domain: 'localhost',
        path: '/',
      },
    ]);
    await page.setViewportSize({
      width: locale === 'ar' ? 390 : locale === 'ja' ? 375 : 1440,
      height: 900,
    });
    let checkouts = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/v2/checkout') && request.method() === 'POST') {
        checkouts++;
        expect(request.postDataJSON().locale).toBe(locale);
      }
    });
    await page.goto(
      '/' + locale + '/plans/' + (process.env.STRIPE_PLAN_ID || 'esim-stripe-integration'),
    );
    await page.getByRole('button', { name: messages.plans.add, exact: true }).click();
    await expect(page.locator('.cart-badge')).toHaveText('1');
    await page.goto('/' + locale + '/checkout');
    await page.locator('input[type="email"]').fill('checkout-test@example.com');
    await page.locator('input[type="checkbox"][required]').check();
    await page.getByRole('button', { name: messages.checkout.continue, exact: true }).click();
    let paymentFrame: Frame | undefined;
    await expect
      .poll(
        async () => {
          for (const frame of page.frames())
            if (
              await frame
                .locator('input[name="number"],input[autocomplete="cc-number"]')
                .count()
                .catch(() => 0)
            ) {
              paymentFrame = frame;
              return true;
            }
          return false;
        },
        { timeout: 45_000 },
      )
      .toBe(true);
    if (!paymentFrame) throw new Error('Native Stripe card form did not load.');
    const frame = paymentFrame;
    const country = frame.locator('select[name="country"]');
    if (await country.count()) await country.selectOption('US');
    await frame
      .locator('input[name="number"],input[autocomplete="cc-number"]')
      .first()
      .pressSequentially('4242424242424242', { delay: 20 });
    await frame.locator('input[name="expiry"],input[autocomplete="cc-exp"]').first().fill('1230');
    await frame.locator('input[name="cvc"],input[autocomplete="cc-csc"]').first().fill('123');
    const postal = frame.locator('input[name="postalCode"],input[autocomplete="postal-code"]');
    if (await postal.count()) await postal.first().fill('10001');
    const pay = page.locator('button.primary.full-width').filter({ hasText: /\d/ }).last();
    await expect(pay).toBeEnabled();
    await pay.focus();
    await pay.press('Enter');
    await expect(
      page.getByRole('heading', { name: messages.orderUi.testOrder, exact: true }),
    ).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('main')).toContainText(
      t('orderUi.paymentStatus', { status: t('status.paid') }),
      { timeout: 30_000 },
    );
    expect(checkouts).toBe(1);
    expect(new URL(page.url()).pathname).toBe('/' + locale + '/checkout/success');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/alozuri-sandbox-${locale}.png`, fullPage: true });
  });
