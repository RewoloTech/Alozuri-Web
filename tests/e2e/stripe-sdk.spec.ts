import { privacyChoice, CONSENT_COOKIE } from '../../packages/shared/src/privacy';
import { test, expect, type Frame } from '@playwright/test';
import { writeFileSync } from 'node:fs';
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
  await expect(page.getByText('Payment: paid', { exact: true })).toBeVisible({ timeout: 30000 });
  expect(requests).toBe(1);
  const documents = page.locator('details.order-documents');
  await expect(documents).not.toHaveAttribute('open', '');
  await documents.getByText('Order documents', { exact: true }).click();
  await expect(documents.getByRole('button', { name: 'Download your contract' })).toBeVisible();
  await page.screenshot({ path: 'test-results/stripe-real-confirmation.png', fullPage: true });
});
