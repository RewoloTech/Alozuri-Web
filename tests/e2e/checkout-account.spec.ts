import { test, expect } from '@playwright/test';
import { CONSENT_COOKIE, privacyChoice } from '../../packages/shared/src/privacy';

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
      domain: 'localhost',
      path: '/',
    },
  ]);
});

test('optional account creation reuses the delivery email and keeps checkout open', async ({
  page,
}) => {
  await page.goto('/e2e-fixtures/checkout-account');
  const email = page.getByRole('textbox', { name: 'Email address', exact: true });
  await expect(page.locator('input[type=email]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByText('Or check out as a guest', { exact: true })).toBeVisible();
  await expect(
    page.getByText('We’ll email your eSIM details. No account needed.', { exact: true }),
  ).toBeVisible();
  await email.fill('new@example.test');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByRole('button', { name: 'Create account and stay at checkout' }).click();
  await expect(page.locator('.checkout-account').getByRole('alert')).toContainText(
    'at least 8 characters',
  );
  const password = page.getByLabel('Password', { exact: true });
  await password.fill('example-test-password');
  await password.press('Enter');
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  await expect(page.getByText('Signed in as new@example.test.', { exact: false })).toBeVisible();
  await expect(email).toHaveValue('new@example.test');
  await expect(page.getByText('Authentication attempts: 1')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Verify your email' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Payment continues with' }),
  ).toContainText('Payment continues with new@example.test');
  await expect(page).toHaveURL(/e2e-fixtures\/checkout-account$/);
});

test('Google sign-in fills its account email and avoids duplicate attempts', async ({ page }) => {
  await page.goto('/e2e-fixtures/checkout-account');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveValue(
    'google@example.test',
  );
  await expect(page.getByText('Authentication attempts: 1')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Verify your email' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Payment continues with' }),
  ).toContainText('Payment continues with google@example.test');
});

test('blocked Google popup and failed login leave guest checkout available', async ({ page }) => {
  await page.goto('/e2e-fixtures/checkout-account?failure=1');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.locator('.checkout-account').getByRole('alert')).toContainText(
    'blocked Google sign-in',
  );
  await page.getByRole('textbox', { name: 'Email address' }).fill('guest@example.test');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByLabel('Password', { exact: true }).fill('incorrect-example');
  await page.getByRole('button', { name: 'Log in and stay at checkout' }).click();
  await expect(page.locator('.checkout-account').getByRole('alert')).toContainText(
    'email or password is incorrect',
  );
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Payment continues with' }),
  ).toContainText('Payment continues with guest@example.test');
});

test('unfinished signup and unavailable sign-in do not add required guest details', async ({
  page,
}) => {
  await page.goto('/e2e-fixtures/checkout-account');
  await page.getByRole('textbox', { name: 'Email address' }).fill('guest@example.test');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Password', { exact: true }).fill('short');
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const create = await page
      .getByRole('button', { name: 'Create an account', exact: true })
      .boundingBox();
    const login = await page.getByRole('button', { name: 'Log in', exact: true }).boundingBox();
    if (!create || !login) throw new Error('Account actions must be visible');
    expect(Math.abs(create.y - login.y)).toBeLessThan(2);
    expect(login.x - (create.x + create.width)).toBeGreaterThanOrEqual(31);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('.checkout-account')
      .screenshot({ path: `/tmp/alozuri-checkout-account-${width}.png` });
  }
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Payment continues with' }),
  ).toContainText('Payment continues with guest@example.test');
  await expect(page.getByText('Authentication attempts: 0')).toBeVisible();
  await page.goto('/e2e-fixtures/checkout-account?unconfigured=1');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Email address' }).fill('guest@example.test');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Payment continues with' }),
  ).toContainText('Payment continues with guest@example.test');
});
