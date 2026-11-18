import { test, expect } from '@playwright/test';
import { LOCALES, localePath } from '../../packages/shared/src/i18n/locales';
import { loadMessages } from '../../packages/shared/src/i18n/catalogs';
import { localizedPolicies } from '../../packages/shared/src/i18n/legal-documents';
import { localizationPreview } from '../../apps/api/src/lib/localization-preview';

test('every language renders full legal pages with matching SEO alternates and readable mobile content', async ({
  page,
}) => {
  test.setTimeout(600_000);
  for (const locale of LOCALES) {
    const policies = localizedPolicies(locale);
    for (const slug of ['terms', 'refunds', 'cookies']) {
      const policy = policies[slug];
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto(localePath(policy.path, locale));
      await expect(page.locator('h1')).toHaveText(policy.title);
      await expect(page.locator('main')).toContainText(policy.sections.at(-1)!.paragraphs[0]);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://alozuri.com' + localePath(policy.path, locale),
      );
      for (const language of [...LOCALES, 'x-default'])
        await expect(page.locator(`link[rel="alternate"][hreflang="${language}"]`)).toHaveAttribute(
          'href',
          'https://alozuri.com' +
            localePath(
              policy.path,
              language === 'x-default' ? 'en' : LOCALES.find((value) => value === language)!,
            ),
        );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.screenshot({ path: `/tmp/alozuri-legal-${locale}-390.png`, fullPage: true });
  }
});

test('actual order email templates render in all languages at mobile and desktop sizes', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.route('https://**/*', (route) => route.abort());
  await page.route('https://alozuri.com/images/alozuri-email-logo-padded-v2.png', (route) =>
    route.fulfill({
      path: 'apps/web/public/images/alozuri-email-logo-padded-v2.png',
      contentType: 'image/png',
    }),
  );
  for (const locale of LOCALES) {
    const sample = await localizationPreview(locale);
    const messages = await loadMessages(locale);
    for (const width of [375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(sample.email.html);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('h1')).toHaveText(messages.emails.confirmed);
      await expect(page.locator('body')).toContainText(messages.transactionUi.thanks);
      await expect(page.locator('img[src^="data:image/png"]')).toHaveCount(1);
      await expect
        .poll(() =>
          page
            .locator('img[alt="Alozuri"]')
            .evaluate(
              (image) =>
                image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
            ),
        )
        .toBe(true);
      await expect(page.locator('body')).toContainText('GBP 1.13');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390 || (locale === 'ar' && width === 1440))
        await page.screenshot({ path: `/tmp/alozuri-email-${locale}-${width}.png` });
    }
  }
});
