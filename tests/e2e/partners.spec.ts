import { test, expect } from '@playwright/test';

test('partners page exposes safe application links, keyboard FAQs and footer discovery', async ({
  page,
}) => {
  const response = await page.goto('/partners');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Alozuri Affiliate Programme | Become a Partner');
  await expect(page.locator('h1')).toHaveText('Partner with Alozuri');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://alozuri.com/partners',
  );
  const applications = page.locator('main a[target="_blank"]');
  await expect(applications).toHaveCount(2);
  for (const link of await applications.all()) {
    await expect(link).toHaveAttribute('href', 'https://alozuricom-1c30.endorsely.com');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await expect(page.locator('main form')).toHaveCount(0);
  await expect(
    page.locator('header').getByRole('link', { name: 'Partners', exact: true }),
  ).toHaveCount(0);
  for (const summary of await page.locator('main summary').all()) {
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(summary.locator('..')).toHaveAttribute('open', '');
    await expect(summary.locator('..').locator('p')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(summary.locator('..')).not.toHaveAttribute('open');
  }
  await page.getByRole('button', { name: 'Reject optional', exact: true }).click();
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(applications.first()).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath(`partners-${width}.png`),
      fullPage: true,
    });
  }
  await page.goto('/help');
  await expect(page.locator('h1')).toHaveText('Let’s get you connected.');
  await page.locator('footer').getByRole('link', { name: 'Partners', exact: true }).click();
  await expect(page).toHaveURL('/partners');
});
