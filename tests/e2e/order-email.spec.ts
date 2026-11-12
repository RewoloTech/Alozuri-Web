import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { sampleConfirmation } from '../fixtures/order-confirmation';
import { confirmationEmail } from '../../apps/api/src/lib/order-email';

test('complete order email preserves the full accepted contract and stays readable at mobile widths', async ({
  page,
}) => {
  const order = sampleConfirmation();
  const secureUrl = `https://alozuri.com/checkout/success?order=${order.id}#access=synthetic-private-test`;
  const email = confirmationEmail(order, secureUrl, 'email-v2-ready');
  await page.route('https://alozuri.com/images/alozuri-email-logo.png', async (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: await readFile('apps/web/public/images/alozuri-email-logo.png'),
    }),
  );
  await page.setContent(email.html);
  await expect(page.getByText('Your eSIM is ready.', { exact: false })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Your order is confirmed!', exact: true }),
  ).toBeVisible();
  const button = page.getByRole('link', { name: 'View & Install Your eSIM', exact: true });
  await expect(button).toHaveAttribute('href', secureUrl);
  const contract = page.getByRole('region', { name: 'Your Purchase Contract' });
  const normal = (text: string) => text.replace(/\s+/g, ' ').trim();
  const visibleContract = normal(await contract.innerText());
  expect(visibleContract).toContain(normal(order.legal.termsText));
  expect(visibleContract).toContain(normal(order.legal.refundText));
  expect(visibleContract).not.toContain('synthetic-private-test');
  expect(await page.locator('ol li').count()).toBe(6);
  const hrefs = await page
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  for (const path of [
    '/terms',
    '/privacy',
    '/cookies',
    '/refund-policy',
    '/contact',
    '/esim-compatibility',
  ])
    expect(hrefs).toContain('https://alozuri.com' + path);
  for (const width of [320, 375, 390, 600, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if (width === 390 || width === 1024)
      await page.screenshot({ path: `/tmp/alozuri-order-email-${width}.png` });
  }
  await writeFile('/tmp/alozuri-order-email-preview.html', email.html);
  await writeFile('/tmp/alozuri-order-email-preview.txt', email.text);
});
