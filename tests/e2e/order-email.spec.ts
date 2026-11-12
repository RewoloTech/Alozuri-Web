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
  const logo = page.getByRole('img', { name: 'Alozuri', exact: true });
  await expect(logo).toHaveCSS('padding-left', '16px');
  await expect(logo).toHaveCSS('padding-right', '16px');
  await expect(logo).toHaveCSS('border-radius', '12px');
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

test('ready email shows scannable QR codes and manual installation inside the existing section', async ({
  page,
}) => {
  const { installationConfirmationEmail } =
    await import('../../apps/api/src/lib/order-email-installation');
  const { sampleInstallations } = await import('../fixtures/order-confirmation');
  const { PNG } = await import('pngjs');
  const { default: jsQR } = await import('jsqr');
  const order = sampleConfirmation();
  const units = sampleInstallations(order);
  const email = await installationConfirmationEmail(
    order,
    `https://alozuri.com/checkout/success?order=${order.id}#access=synthetic-private-test`,
    units,
  );
  // A browser has no MIME resolver: substitute only the fixture CID images for preview.
  // The real provider payload retains CID references and private inline PNG attachments.
  let preview = email.html;
  for (const image of email.attachments ?? [])
    preview = preview.replace(
      `cid:${image.content_id}`,
      `data:${image.content_type};base64,${image.content}`,
    );
  await page.route('https://alozuri.com/images/alozuri-email-logo.png', async (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: await readFile('apps/web/public/images/alozuri-email-logo.png'),
    }),
  );
  await page.setContent(preview);
  await expect(
    page.getByRole('heading', { name: 'Install when you are ready', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Installation details for eSIM 1', exact: true }),
  ).toContainText('SM-DP+ address');
  await expect(
    page.getByRole('group', { name: 'Installation details for eSIM 1', exact: true }),
  ).toContainText('Confirmation code');
  await expect(
    page.getByRole('group', { name: 'Installation details for eSIM 2', exact: true }),
  ).not.toContainText('Confirmation code');
  await expect(
    page.getByText(
      'Do not delete the eSIM after installing unless support asks you to. Some profiles can only be installed once.',
    ),
  ).toBeVisible();
  const firstQr = page.getByRole('img', {
    name: 'Private installation QR code for eSIM 1',
    exact: true,
  });
  for (const width of [320, 375, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(firstQr).toHaveJSProperty('naturalWidth', 480);
    const screenshot = PNG.sync.read(await firstQr.screenshot());
    const decoded = jsQR(
      new Uint8ClampedArray(screenshot.data),
      screenshot.width,
      screenshot.height,
    );
    expect(decoded?.data).toBe(units[0].activation.ac);
    if (width === 390 || width === 1024)
      await page
        .getByRole('group', { name: 'Installation details for eSIM 1', exact: true })
        .screenshot({ path: `/tmp/alozuri-inline-email-install-${width}.png` });
  }
  await writeFile('/tmp/alozuri-inline-email-preview.html', preview);
});
