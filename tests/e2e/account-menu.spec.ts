import { test, expect } from '@playwright/test';
import { CONSENT_COOKIE, privacyChoice } from '../../packages/shared/src/privacy';

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
      domain: 'localhost',
      path: '/',
    },
  ]);
  await page.route('http://127.0.0.1:8189/v1/config', (route) =>
    route.fulfill({
      json: { supportedCurrencies: ['USD', 'GBP', 'EUR'] },
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
    }),
  );
});

test('account navigation supports keyboard dismissal, mobile layouts and working links', async ({
  page,
}) => {
  await page.goto('/e2e-fixtures/account-menu');
  const trigger = page.locator('main').getByRole('button', { name: 'My account', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const nav = page.getByRole('navigation', { name: 'Account navigation' });
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.getByRole('link', { name: 'My eSIMs' })).toHaveAttribute(
    'href',
    '/account/esims',
  );
  await expect(nav.getByRole('link', { name: 'Data usage', exact: true })).toHaveAttribute(
    'href',
    '/account/usage',
  );
  await expect(nav.getByRole('link', { name: 'Orders', exact: true })).toHaveAttribute(
    'href',
    '/account/orders',
  );
  await expect(nav.getByRole('link', { name: 'Account settings' })).toHaveAttribute(
    'href',
    '/dashboard#account-settings',
  );
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('link', { name: 'My eSIMs' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nav).toHaveCount(0);
  await expect(trigger).toBeFocused();
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await trigger.click();
    await expect(nav.getByRole('button', { name: 'Log out', exact: true })).toBeVisible();
    const box = await nav.boundingBox();
    if (!box) throw new Error('Account navigation must be visible');
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await nav.screenshot({ path: `/tmp/alozuri-account-menu-${width}.png` });
    await page.getByRole('button', { name: 'Outside account navigation' }).click();
    await expect(nav).toHaveCount(0);
  }
});

test('logout calls the supplied action once, shows pending state and clears the signed-in menu', async ({
  page,
}) => {
  await page.goto('/e2e-fixtures/account-menu');
  await page.locator('main').getByRole('button', { name: 'My account', exact: true }).click();
  const button = page.getByRole('button', { name: 'Log out', exact: true });
  await button.click();
  await expect(page.getByRole('status').filter({ hasText: 'Signed out' })).toBeVisible();
  await expect(page.getByText('Logout attempts: 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Account navigation' })).toHaveCount(0);
});

test('failed logout shows a helpful retryable error without pretending the user is signed out', async ({
  page,
}) => {
  await page.goto('/e2e-fixtures/account-menu?failure=1');
  await page.locator('main').getByRole('button', { name: 'My account', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Account navigation' }).getByRole('alert'),
  ).toContainText('Could not log out');
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeEnabled();
});

test('unverified customers retain verification navigation and can log out', async ({ page }) => {
  await page.goto('/e2e-fixtures/account-menu?unverified=1');
  await page.locator('main').getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(
    page
      .getByRole('navigation', { name: 'Account navigation' })
      .getByRole('link', { name: 'Verify email' }),
  ).toHaveAttribute('href', '/verify-email');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Signed out' })).toBeVisible();
});
