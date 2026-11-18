import { test, expect, type Page } from '@playwright/test';
import { CONSENT_COOKIE, privacyChoice } from '../../packages/shared/src/privacy';
const start = new Date(Date.now() - 60_000).toISOString();
const end = new Date(Date.now() + 3600_000).toISOString();
const base = {
  id: 'top',
  revision: 'v1',
  placement: 'announcement',
  targets: [],
  homepageOnly: false,
  desktop: true,
  mobile: true,
  background: '#4338CA',
  foreground: '#FFFFFF',
  startsAt: start,
  expiresAt: end,
  dismissible: true,
  translations: {
    en: {
      heading: 'Explore our travel offers',
      description: '',
      ctaLabel: 'Explore',
      dismissLabel: 'Dismiss offer',
    },
    ro: {
      heading: 'Descoperă ofertele',
      description: '',
      ctaLabel: 'Descoperă',
      dismissLabel: 'Închide oferta',
    },
  },
  ctaUrl: '/destinations',
};
async function setup(page: Page, getBanners: () => unknown[]) {
  await page.context().addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(JSON.stringify(privacyChoice(false))),
      domain: 'localhost',
      path: '/',
    },
  ]);
  await page.route('http://127.0.0.1:8189/**', async (route) => {
    const url = new URL(route.request().url());
    let data: unknown = {};
    if (url.pathname === '/v1/marketing')
      data = { banners: getBanners(), revision: JSON.stringify(getBanners()) };
    else if (url.pathname === '/v1/countries') data = { countries: [] };
    else if (url.pathname === '/v1/config')
      data = { paymentMode: 'test', supportedCurrencies: ['USD', 'GBP', 'EUR'] };
    else if (url.pathname === '/v1/featured-bundles') data = { bundles: [] };
    await route.fulfill({
      json: data,
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:3100',
        'Access-Control-Allow-Headers': 'content-type,authorization',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
      },
    });
  });
}
for (const width of [375, 390, 768, 1440])
  test(`announcement and homepage banner remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setup(page, () => [
      base,
      {
        ...base,
        id: 'home',
        placement: 'homepage',
        dismissible: false,
        translations: {
          en: {
            heading: 'A banner for your next trip',
            description: 'Selected destinations',
            ctaLabel: 'Find a plan',
            dismissLabel: '',
          },
        },
      },
    ]);
    await page.goto('/');
    await expect(page.getByText('Explore our travel offers')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A banner for your next trip' })).toBeVisible();
    await page.screenshot({
      path: `/tmp/alozuri-marketing-published-${width}.png`,
      fullPage: false,
    });
    const announcement = page.locator('.marketing-announcement');
    expect((await announcement.boundingBox())!.height).toBeLessThan(140);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Dismiss offer' }).focus();
    await page.keyboard.press('Enter');
    await expect(announcement).toHaveCount(0);
    await page.reload();
    await expect(announcement).toHaveCount(0);
    await page.screenshot({ path: `/tmp/alozuri-marketing-${width}.png`, fullPage: false });
    expect(errors).toEqual([]);
  });
test('publication edits refresh, expiry hides, homepage targeting and device visibility work', async ({
  page,
}) => {
  let banners = [{ ...base, homepageOnly: true }];
  await setup(page, () => banners);
  await page.goto('/');
  await expect(page.getByText(base.translations.en.heading)).toBeVisible();
  banners = [
    {
      ...base,
      homepageOnly: true,
      revision: 'v2',
      translations: {
        ...base.translations,
        en: { ...base.translations.en, heading: 'Updated campaign' },
      },
    },
  ];
  await expect(page.getByText('Updated campaign')).toBeVisible({ timeout: 12000 });
  await page.goto('/how-it-works');
  await expect(page.locator('.marketing-announcement')).toHaveCount(0);
  banners = [{ ...base, desktop: false, mobile: true }];
  await page.goto('/');
  await expect(page.locator('.marketing-announcement')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.marketing-announcement')).toBeVisible();
  banners = [{ ...base, expiresAt: new Date(Date.now() - 1000).toISOString() }];
  await expect(page.locator('.marketing-announcement')).toHaveCount(0, { timeout: 12000 });
});
test('Romanian content, English fallback and future scheduling', async ({ page }) => {
  let banners = [base];
  await setup(page, () => banners);
  await page.goto('/ro');
  await expect(page.getByText('Descoperă ofertele')).toBeVisible();
  await page.goto('/fr');
  await expect(page.getByText(base.translations.en.heading)).toBeVisible();
  banners = [{ ...base, startsAt: new Date(Date.now() + 60_000).toISOString() }];
  await page.reload();
  await expect(page.locator('.marketing-announcement')).toHaveCount(0);
});

test('destination and regional targeting use existing pages and responsive image variants', async ({
  page,
}) => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOuoAAAAASUVORK5CYII=',
    'base64',
  );
  await page.route('**/marketing-*.png', (route) =>
    route.fulfill({ contentType: 'image/png', body: png }),
  );
  const destination = {
    ...base,
    id: 'france',
    placement: 'destination',
    targets: ['FR'],
    dismissible: false,
    desktopImage: '/marketing-desktop.png',
    mobileImage: '/marketing-mobile.png',
  };
  const region = {
    ...destination,
    id: 'europe',
    placement: 'region',
    desktopImage: undefined,
    targets: ['europe'],
    translations: { en: { ...base.translations.en, heading: 'Europe offers' } },
  };
  await setup(page, () => [destination, region]);
  await page.goto('/destinations/fr');
  await expect(page.locator('.marketing-page-banner')).toBeVisible();
  await expect
    .poll(() => page.locator('.marketing-image').evaluate((e: HTMLImageElement) => e.currentSrc))
    .toContain('marketing-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.locator('.marketing-image').evaluate((e: HTMLImageElement) => e.currentSrc))
    .toContain('marketing-mobile.png');
  await page.goto('/destinations/ch');
  await expect(page.locator('.marketing-page-banner')).toHaveCount(0);
  await page.goto('/destinations/europe');
  await expect(page.getByRole('heading', { name: 'Europe offers', exact: true })).toBeVisible();
  await expect(page.locator('.marketing-image')).toBeVisible();
});

test('session dismissal survives refresh polling when banner storage is blocked', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('alozuri-banner:')) throw new DOMException('Blocked', 'SecurityError');
      return original.call(this, key, value);
    };
  });
  let reads = 0;
  await setup(page, () => {
    reads++;
    return [base];
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Dismiss offer' }).click();
  const before = reads;
  await expect.poll(() => reads, { timeout: 12000 }).toBeGreaterThan(before);
  await expect(page.locator('.marketing-announcement')).toHaveCount(0);
});
