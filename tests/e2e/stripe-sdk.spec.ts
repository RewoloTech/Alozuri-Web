import { test, expect, type Frame } from '@playwright/test';
test.skip(
  process.env.STRIPE_INTEGRATION !== '1',
  'Run with npm run test:stripe and matching local Stripe test keys.',
);
test('real Stripe Payment Element declines a test card, retries the same intent and completes a sandbox payment', async ({
  page,
}) => {
  test.setTimeout(120000);
  let requests = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/v2/checkout') && r.method() === 'POST') requests++;
  });
  await page.goto('/plans/esim-stripe-integration');
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart, 1 item' })).toBeVisible();
  await page.goto('/checkout');
  await page
    .getByRole('textbox', { name: 'Email address', exact: true })
    .fill('checkout-test@example.com');
  await page
    .getByRole('textbox', { name: 'Confirm email address' })
    .fill('checkout-test@example.com');
  await page.getByRole('checkbox').check();
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
  const frame = paymentFrame;
  const country = frame.getByRole('combobox', { name: 'Country/Territory', exact: true });
  if (await country.count()) await country.selectOption('US');
  await frame.getByRole('textbox', { name: 'Card number', exact: true }).fill('4000000000009995');
  await frame.getByRole('textbox', { name: /Expiration|Expiry|MM/ }).fill('1230');
  await frame.getByRole('textbox', { name: /Security code|CVC/ }).fill('123');
  const postal = frame.getByRole('textbox', { name: /ZIP|Postal/ });
  if (await postal.count()) await postal.fill('10001');
  await page.screenshot({ path: 'test-results/stripe-real-form.png', fullPage: true });
  await page.getByRole('button', { name: 'Pay securely', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /declined|insufficient/i })).toContainText(
    /declined|insufficient/i,
    { timeout: 30000 },
  );
  await frame.getByRole('textbox', { name: 'Card number', exact: true }).fill('4242424242424242');
  await frame.getByRole('textbox', { name: /Expiration|Expiry|MM/ }).fill('1230');
  await frame.getByRole('textbox', { name: 'Security code', exact: true }).fill('123');
  await page.getByRole('button', { name: 'Pay securely', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your test order', exact: true })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.getByText('Payment: paid', { exact: true })).toBeVisible({ timeout: 30000 });
  expect(requests).toBe(1);
  await page.screenshot({ path: 'test-results/stripe-real-confirmation.png', fullPage: true });
});
