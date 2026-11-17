import test from 'node:test';
import {
  sitemapEntries,
  sitemapIds,
  parseSitemapId,
  SITEMAP_PATHS_PER_SHARD,
} from '../../apps/web/src/lib/sitemap.ts';
import { createTranslator } from 'use-intl/core';
import { staticMessages } from '../../packages/shared/src/i18n/static-catalogs.ts';
import { LOCALES } from '../../packages/shared/src/i18n/locales.ts';
import assert from 'node:assert/strict';
import { productStructuredData } from '../../apps/web/src/lib/product-seo';
import { jsonLd, PRIVATE_ROUTES, publicMetadata } from '../../apps/web/src/lib/seo';
import { demoPlans } from '../../packages/shared/src/demo';
import { guides } from '../../apps/web/src/lib/guides';
import { destinationContent } from '../../apps/web/src/lib/destination-content';
for (const currency of ['USD', 'GBP', 'EUR'] as const)
  test(`Product schema matches ${currency} displayed minor units without invented stock or ratings`, () => {
    const plan = { ...demoPlans[0], demo: false, priceCents: 113, currency };
    const schema = productStructuredData(plan)!;
    assert.equal(schema.offers.price, '1.13');
    assert.equal(schema.offers.priceCurrency, currency);
    assert.equal(schema.offers.url, 'https://alozuri.com/plans/' + plan.id);
    assert.equal('availability' in schema.offers, false);
    assert.equal('aggregateRating' in schema, false);
    assert.equal(
      schema.additionalProperty.find((p) => p.name === 'Activation')?.value,
      plan.activation,
    );
  });
test('demo products do not produce commercial structured data and JSON-LD escapes script injection', () => {
  assert.equal(productStructuredData({ ...demoPlans[0], demo: true }), null);
  const escaped = jsonLd({ name: '</script><script>alert(1)</script>' });
  assert.equal(escaped.includes('<'), false);
  assert.equal(JSON.parse(escaped).name, '</script><script>alert(1)</script>');
});
test('public canonical and social URLs stay aligned; private operations remains excluded', () => {
  const m = publicMetadata('Title', 'Description', '/destinations/us');
  assert.equal(m.alternates.canonical, m.openGraph.url);
  assert.equal(m.twitter.title, m.openGraph.title);
  assert.ok(PRIVATE_ROUTES.includes('/operations'));
});
test('localised product links retain the exact recorded amount, currency and supplier identifier', () => {
  const plan = { ...demoPlans[0], demo: false, priceCents: 113, currency: 'GBP' as const };
  const schema = productStructuredData(
    plan,
    'de',
    createTranslator({ locale: 'de', messages: staticMessages('de') }),
  )!;
  assert.equal(schema.url, 'https://alozuri.com/de/plans/' + plan.id);
  assert.equal(schema.offers.url, schema.url);
  assert.equal(schema.offers.price, '1.13');
  assert.equal(schema.offers.priceCurrency, 'GBP');
  assert.equal(schema.sku, plan.id);
});
test('curated destination advice and guide routes are unique and contain useful sections', () => {
  assert.equal(new Set(guides.map((g) => g.slug)).size, 5);
  for (const g of guides) {
    assert.ok(g.sections.length >= 3);
    assert.ok(g.sections.every((s) => s.paragraphs.length >= 2));
  }
  const copy = Object.values(destinationContent);
  assert.equal(new Set(copy.map((c) => c.intro)).size, copy.length);
  for (const code of ['US', 'GB', 'JP', 'TH', 'TR', 'AE'])
    assert.ok(destinationContent[code].faq.length >= 2);
});

test('native product schema localises descriptions and properties in every language without repricing', () => {
  const plan = {
    ...demoPlans[0],
    name: 'France 1GB 7Days',
    countries: ['FR'],
    demo: false,
    priceCents: 113,
  };
  for (const locale of LOCALES) {
    const t = createTranslator({ locale, messages: staticMessages(locale) });
    const schema = productStructuredData(plan, locale, t)!;
    assert.equal(schema.offers.price, '1.13');
    assert.equal(schema.offers.priceCurrency, plan.currency);
    assert.equal(schema.sku, plan.id);
    assert.equal(schema.additionalProperty[0].name, t('plans.allowance'));
    if (locale !== 'en')
      assert.notEqual(schema.description, productStructuredData(plan)!.description);
  }
});

test('sitemap shards keep a growing multilingual catalogue bounded without dropping URLs', () => {
  const paths = Array.from({ length: SITEMAP_PATHS_PER_SHARD + 1 }, (_, i) => '/plans/sku-' + i);
  const ids = sitemapIds(paths.length);
  assert.equal(ids.length, LOCALES.length * 2);
  assert.equal(new Set(ids).size, ids.length);
  const first = sitemapEntries(paths, 'en', 0);
  const second = sitemapEntries(paths, 'en', 1);
  assert.equal(first.length, SITEMAP_PATHS_PER_SHARD);
  assert.equal(second.length, 1);
  assert.equal(new Set([...first, ...second].map((entry) => entry.url)).size, paths.length);
  assert.deepEqual(sitemapEntries(paths, 'en', 2), []);
  for (const locale of LOCALES) {
    assert.deepEqual(parseSitemapId(locale + '-0'), { locale, page: 0 });
    const [entry] = sitemapEntries(['/plans/stable-sku'], locale, 0);
    assert.equal(Object.keys(entry.alternates?.languages ?? {}).length, LOCALES.length + 1);
    assert.equal(
      entry.alternates?.languages?.['x-default'],
      'https://alozuri.com/plans/stable-sku',
    );
    assert.equal(entry.alternates?.languages?.[locale], entry.url);
  }
  for (const value of ['zh-Han-0', 'xx-0', 'en-00', 'en--1', 'en-1?x=1', 'en-999999999999'])
    assert.equal(parseSitemapId(value), null);
});
