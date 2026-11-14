import { test, expect } from '@playwright/test';
test('package sales search finds plans outside the top eight, paginates and respects changed data', async ({
  page,
}) => {
  await page.goto('/e2e-fixtures/operations-plan-sales');
  await page.getByRole('button', { name: 'Reject optional', exact: true }).click();
  const plans = page.getByRole('region', { name: 'Top-selling plans', exact: true });
  await expect(plans.getByRole('listitem')).toHaveCount(8);
  await expect(plans).not.toContainText('Japan 1GB 7Days');
  await plans.getByRole('searchbox', { name: 'Find a package' }).fill('japan 1gb');
  await expect(plans.getByRole('listitem')).toHaveCount(1);
  await expect(plans).toContainText('Japan 1GB 7Days');
  await expect(plans).toContainText('1 sold');
  await plans.getByRole('searchbox', { name: 'Find a package' }).fill('JP');
  await expect(plans.getByRole('listitem')).toHaveCount(1);
  await plans.getByRole('searchbox', { name: 'Find a package' }).fill('united kingdom');
  await expect(plans).toContainText('11 matching packages');
  await plans.getByRole('button', { name: 'Next packages', exact: true }).click();
  await expect(plans.getByRole('listitem')).toHaveCount(3);
  await expect(plans).toContainText('Page 2 of 2');
  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 390 || width === 1440)
      await plans.screenshot({ path: `/tmp/alozuri-plan-sales-${width}.png` });
  }
  await plans.getByRole('searchbox', { name: 'Find a package' }).fill('not-a-sold-plan');
  await expect(plans.getByRole('status')).toContainText('No recorded paid sales match');
  await plans.getByRole('button', { name: 'Clear package search', exact: true }).click();
  await expect(plans.getByRole('listitem')).toHaveCount(8);
  await plans.getByRole('button', { name: 'Browse all sold packages', exact: true }).click();
  await expect(plans).toContainText('12 matching packages');
  await plans.getByRole('button', { name: 'Next packages', exact: true }).click();
  await expect(plans.getByRole('listitem')).toHaveCount(4);
  await expect(plans).toContainText('Japan 1GB 7Days');
  await page.getByRole('button', { name: 'Use empty date range', exact: true }).click();
  await expect(plans).toContainText('No paid orders in this date range.');
  await page.getByRole('button', { name: 'Restore date range', exact: true }).click();
  await plans.getByRole('button', { name: 'Show top eight', exact: true }).click();
  await expect(plans.getByRole('listitem')).toHaveCount(8);
});
