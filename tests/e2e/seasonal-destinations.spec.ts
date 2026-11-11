import { test, expect } from '@playwright/test';

test('seasonal grid restores Japan and has four visible cards without carousel controls', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-11T12:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const carousel = page.getByRole('region', { name: 'Seasonal destination inspiration' });

  const cards = carousel.locator('.destination-card');
  await expect(cards).toHaveCount(4);
  await expect(carousel.getByRole('link', { name: /France/ })).toHaveAttribute(
    'href',
    '/destinations/fr',
  );
  await expect(carousel.getByRole('link', { name: /United States/ })).toHaveAttribute(
    'href',
    '/destinations/us',
  );
  await expect(carousel.getByRole('img', { name: /Cappadocia/ })).toHaveAttribute(
    'src',
    /turkey-cappadocia/,
  );
  for (const width of [375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await carousel.scrollIntoViewIfNeeded();
    await expect(carousel.getByRole('button')).toHaveCount(0);
    await expect(carousel.locator('.destination-card').first()).toHaveAttribute(
      'href',
      '/destinations/jp',
    );
    for (let i = 0; i < 4; i++) {
      const img = cards.nth(i).locator('img');
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          img.evaluate(
            (element) =>
              element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
          ),
        )
        .toBe(true);
      if (width === 375 || width === 1440) {
        const href = await cards.nth(i).getAttribute('href');
        await cards.nth(i).screenshot({
          path: `/tmp/alozuri-seasonal-card-${href?.split('/').pop()}-${width}.png`,
        });
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await carousel.screenshot({ path: `/tmp/alozuri-seasonal-${width}.png` });
  }
  expect(errors).toEqual([]);
});

test('static homepage refreshes its four cards for the season and keeps a stable order on reload', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2027-04-12T12:00:00Z'));
  await page.goto('/');
  const carousel = page.getByRole('region', { name: 'Seasonal destination inspiration' });
  await expect(carousel.getByRole('link', { name: /Italy/ })).toBeVisible();
  await expect(carousel.getByRole('link', { name: /Japan/ })).toHaveAttribute(
    'href',
    '/destinations/jp',
  );
  const before = await carousel
    .locator('.destination-card')
    .evaluateAll((cards) => cards.map((card) => card.getAttribute('href')));
  await page.reload();
  await expect(carousel.getByRole('link', { name: /Italy/ })).toBeVisible();
  expect(
    await carousel
      .locator('.destination-card')
      .evaluateAll((cards) => cards.map((card) => card.getAttribute('href'))),
  ).toEqual(before);
  await carousel.getByRole('link', { name: /Turkey/ }).focus();
  await expect(carousel.getByRole('link', { name: /Turkey/ })).toBeInViewport();
});
