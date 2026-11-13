import test from 'node:test';
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
