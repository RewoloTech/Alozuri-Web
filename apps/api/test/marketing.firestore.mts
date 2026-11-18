import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Fastify from 'fastify';
import { Marketing, registerMarketing } from '../src/lib/marketing.ts';
import { Promotions } from '../src/lib/promotions.ts';
import { promotionConfigHash } from '../src/lib/promotion-policy.ts';
import { priceExchange } from '../src/lib/exchange-rates.ts';
import { pricePackage } from '../src/lib/package-pricing.ts';
import { demoPlans } from '../../../packages/shared/src/demo.ts';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8188');
const app = initializeApp({ projectId: 'demo-alozuri' }),
  db = getFirestore(app);
const marketing = new Marketing(db),
  promotions = new Promotions(db);
const startsAt = new Date(Date.now() - 60_000).toISOString();
const expiresAt = new Date(Date.now() + 3600_000).toISOString();
const product = pricePackage(
  {
    ...demoPlans[0],
    id: 'internal-france',
    countries: ['FR'],
    demo: false,
    active: true,
    supplierCode: 'original-offer',
    providerId: 'esim-access',
    wholesaleUnits: 1000,
    syncedAt: new Date().toISOString(),
  },
  { priceOverrideUsdCents: 1000 },
);
const offer = {
  code: 'AUTO_FR',
  discountPercent: 20,
  active: true,
  startsAt,
  expiresAt,
  maxUses: null,
  automatic: true,
  scope: { kind: 'products', values: [product.id], excludedProducts: [] },
};
const banner = {
  id: 'announcement',
  name: 'Offer',
  active: true,
  startsAt,
  expiresAt,
  placement: 'announcement',
  translations: { en: { heading: 'Travel for less', ctaLabel: 'Explore' } },
  ctaUrl: '/destinations',
  promotionId: offer.code,
};
test.before(async () => {
  process.env.MARKETING_ENABLED = 'true';
  await fetch(
    'http://127.0.0.1:8188/emulator/v1/projects/demo-alozuri/databases/(default)/documents',
    { method: 'DELETE' },
  );
  await db.doc('packages/' + product.id).set(product);
});
test.after(async () => {
  delete process.env.MARKETING_ENABLED;
  await deleteApp(app);
});
test('legacy code, product targeting, exclusions, schedule and currency preserve server prices', async () => {
  const { scope: _scope, ...legacyOffer } = offer;
  void _scope;
  await promotions.save({ ...legacyOffer, code: 'LEGACY', automatic: false }, true, 'admin');
  const legacy = await promotions.validate('LEGACY');
  assert.equal(legacy.discountPercent, 20);
  await promotions.save(offer, true, 'admin');
  const view = await promotions.automaticView([product], priceExchange('USD'));
  assert.equal(view[0].priceCents, 800);
  assert.equal(view[0].promotionPrice?.originalPriceCents, 1000);
  const gbp = await promotions.automaticView([{ ...product, currency: 'GBP', priceCents: 800 }], {
    ...priceExchange('USD'),
    numerator: '8',
    denominator: '10',
  });
  assert.equal(gbp[0].priceCents, 640);
  await promotions.save(
    { ...offer, scope: { ...offer.scope, excludedProducts: [product.id] } },
    false,
  );
  assert.equal(
    (await promotions.automaticView([product], priceExchange('USD')))[0].priceCents,
    1000,
  );
  await promotions.save({ ...offer, startsAt: new Date(Date.now() + 60_000).toISOString() }, false);
  assert.equal((await promotions.automatic()).length, 0);
  await promotions.save(
    { ...offer, startsAt: '2020-01-01T00:00:00Z', expiresAt: '2020-02-01T00:00:00Z' },
    false,
  );
  assert.equal((await promotions.automatic()).length, 0);
  await promotions.save(offer, false);
});
test('overlap uses priority, fixed amounts and price cannot stack; margin failures hide rather than reprice', async () => {
  await promotions.save(
    { ...offer, code: 'AUTO_HIGH', priority: 10, discount: { kind: 'fixed', value: 100 } },
    true,
  );
  assert.equal(
    (await promotions.automaticView([product], priceExchange('USD')))[0].priceCents,
    900,
  );
  await promotions.save(
    { ...offer, code: 'AUTO_HIGH', priority: 10, discount: { kind: 'price', value: 700 } },
    false,
  );
  assert.equal(
    (await promotions.automaticView([product], priceExchange('USD')))[0].priceCents,
    700,
  );
  await db.doc('packages/' + product.id).update({ wholesaleUnits: 200000 });
  assert.equal((await promotions.automaticView([product], priceExchange('USD'))).length, 0);
  await db.doc('packages/' + product.id).update({
    wholesaleUnits: 1000,
    providerId: 'equivalent-provider',
    supplierCode: 'different-offer',
  });
  assert.equal(
    (await promotions.automaticView([product], priceExchange('USD')))[0].priceCents,
    700,
  );
  await promotions.setActive('AUTO_HIGH', false);
});
test('campaign links control publish/expiry, changes are audited and inactive offers are hidden', async () => {
  const campaign = {
    id: 'summer',
    name: 'Summer',
    active: true,
    startsAt,
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
  };
  await marketing.save('campaigns', campaign, 'owner');
  await marketing.save('banners', { ...banner, campaignId: 'summer' }, 'owner');
  const published = await marketing.published();
  assert.equal(published.length, 1);
  assert.equal(published[0].expiresAt, campaign.expiresAt);
  assert.ok(!JSON.stringify(published).includes('wholesale'));
  assert.ok(!JSON.stringify(published).includes('holds'));
  await assert.rejects(marketing.remove('campaigns', 'summer', 'owner'), /Linked/);
  await marketing.save(
    'banners',
    {
      ...banner,
      campaignId: 'summer',
      translations: { en: { heading: 'Updated' }, ro: { heading: 'Oferta' } },
    },
    'owner',
  );
  assert.equal((await marketing.published())[0].translations.ro?.heading, 'Oferta');
  await marketing.save('campaigns', { ...campaign, active: false }, 'owner');
  assert.equal((await marketing.published()).length, 0);
  await marketing.save('campaigns', campaign, 'owner');
  await promotions.setActive(offer.code, false);
  assert.equal((await marketing.published()).length, 0);
  await promotions.setActive(offer.code, true);
  const audits = await db.collection('marketingAudit').where('actor', '==', 'owner').get();
  assert.ok(audits.size >= 4);
});
test('checkout transaction rejects a linked campaign paused after its quote', async () => {
  const campaign = { id: 'checkout-campaign', name: 'Checkout', active: true, startsAt, expiresAt };
  await marketing.save('campaigns', campaign, 'owner');
  await promotions.save({ ...offer, campaignId: campaign.id }, false);
  const config = (await promotions.automatic())[0];
  await marketing.save('campaigns', { ...campaign, active: false }, 'owner');
  await assert.rejects(
    db.runTransaction((t) =>
      promotions.validateAutomatic(t, [
        {
          automaticPromotion: {
            id: config.code,
            code: config.code,
            discountPercent: config.discountPercent,
            configHash: promotionConfigHash(config),
          },
        },
      ]),
    ),
    /Campaign/,
  );
  await promotions.save(offer, false);
});
test('admin routes enforce authorization and reject invalid image uploads without storage access', async () => {
  const api = Fastify();
  registerMarketing(api, async (header) => {
    if (header !== 'Bearer admin') throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    return { uid: 'owner' };
  });
  assert.equal((await api.inject({ url: '/v1/operations/marketing' })).statusCode, 403);
  const response = await api.inject({ url: '/v1/marketing' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.ok(Array.isArray(response.json().banners));
  const invalid = await api.inject({
    method: 'POST',
    url: '/v1/operations/marketing/images',
    headers: { authorization: 'Bearer admin' },
    payload: { content: Buffer.from('fake image').toString('base64'), contentType: 'image/png' },
  });
  assert.notEqual(invalid.statusCode, 200);
  const overview = await api.inject({
    url: '/v1/operations/marketing',
    headers: { authorization: 'Bearer admin' },
  });
  assert.equal(overview.statusCode, 200);
  assert.ok(overview.json().overview.activePromotions >= 1);
  await api.close();
});

test('desktop and mobile images round-trip through authenticated upload and safe immutable public IDs', async () => {
  const { Readable } = await import('node:stream');
  const files = new Map<string, { bytes: Buffer; type: string }>();
  const api = Fastify();
  registerMarketing(
    api,
    async (header) => {
      if (header !== 'Bearer admin')
        throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
      return { uid: 'owner' };
    },
    {
      save: async (id, bytes, type) => {
        files.set(id, { bytes, type });
      },
      read: (id) => Readable.from(files.get(id)!.bytes),
    },
  );
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOuoAAAAASUVORK5CYII=',
    'base64',
  );
  for (const _device of ['desktop', 'mobile']) {
    void _device;
    const result = await api.inject({
      method: 'POST',
      url: '/v1/operations/marketing/images',
      headers: { authorization: 'Bearer admin' },
      payload: { content: png.toString('base64'), contentType: 'image/png' },
    });
    assert.equal(result.statusCode, 200);
    const image = await api.inject({ url: result.json().path });
    assert.equal(image.statusCode, 200);
    assert.equal(image.headers['content-type'], 'image/png');
    assert.match(image.headers['cache-control']!, /immutable/);
    assert.deepEqual(image.rawPayload, png);
  }
  assert.equal(
    (
      await api.inject({
        method: 'POST',
        url: '/v1/operations/marketing/images',
        payload: { content: png.toString('base64'), contentType: 'image/png' },
      })
    ).statusCode,
    403,
  );
  await api.close();
});

test('percentage promotions keep the configured 30% label across penny rounding and automatic views', async () => {
  await promotions.save({ ...offer, code: 'ROUND30', discountPercent: 30, priority: 999 }, true);
  const config = await promotions.get('ROUND30');
  const fx = { ...priceExchange('USD'), numerator: '75', denominator: '100' };
  const gbp = { ...product, currency: 'GBP' as const, priceCents: 113 };
  const direct = promotions.apply(gbp, 1000, config, fx);
  assert.equal(direct.priceCents, 80);
  assert.equal(direct.promotionPrice?.discountPercent, 30);
  const automatic = await promotions.automaticView([gbp], fx);
  assert.equal(automatic[0].priceCents, 80);
  assert.equal(automatic[0].promotionPrice?.discountPercent, 30);
});
