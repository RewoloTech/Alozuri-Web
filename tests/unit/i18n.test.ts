import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator } from 'use-intl/core';
import {
  LOCALES,
  PUBLISHED_LOCALES,
  localeDirection,
  resolveLocale,
  requirePublishedLocale,
  orderLocale,
  stripeElementsLocale,
  firebaseAuthLocale,
  localePath,
  navigationLocalePath,
  localeReview,
} from '../../packages/shared/src/i18n/locales.ts';
import { loadMessages } from '../../packages/shared/src/i18n/catalogs.ts';
import { validateMessages, messageVariables } from '../../packages/shared/src/i18n/validation.ts';
import { contractMoney } from '../../packages/shared/src/contract.ts';
import { legalSnapshot } from '../../apps/api/src/lib/legal.ts';
import { CHECKOUT_LEGAL_ACCEPTANCE } from '../../packages/shared/src/legal.ts';
import { transactionLocale } from '../../apps/api/src/lib/transaction-locale.ts';
import { localizationPreview } from '../../apps/api/src/lib/localization-preview.ts';
import { storeApiError } from '../../apps/web/src/lib/api-error.ts';
import { legalDocuments } from '../../packages/shared/src/i18n/legal-documents.ts';
import { destinationName } from '../../packages/shared/src/i18n/destinations.ts';
import { documentFontFiles } from '../../packages/shared/src/document-fonts.ts';

test('all twenty-one catalogues have exact typed keys, valid ICU and identical variables', async () => {
  assert.equal(LOCALES.length, 21);
  for (const locale of LOCALES) validateMessages(await loadMessages(locale), locale);
  const source = await loadMessages('de');
  const bad = { ...source, emails: { ...source.emails, reference: 'Bestellung {wrong}' } };
  assert.throws(() => validateMessages(bad), /variables differ/);
  bad.emails.reference = '<script>unsafe</script>';
  assert.throws(() => validateMessages(bad), /Invalid translation/);
  assert.throws(() => messageVariables('{count, plural, one {broken}}'));
  assert.throws(
    () => validateMessages({ ...source, common: { ...source.common, save: 'Save' } }, 'de'),
    /Untranslated English/,
  );
  const arabic = await loadMessages('ar');
  assert.throws(
    () =>
      validateMessages(
        { ...arabic, common: { ...arabic.common, language: '\u2066Language\u2069' } },
        'ar',
      ),
    /Untranslated English placeholder/,
  );
  assert.throws(
    () =>
      validateMessages(
        { ...arabic, plans: { ...arabic.plans, days: '{count, plural, one {يوم} other {أيام}}' } },
        'ar',
      ),
    /plural categories/,
  );
});
test('every manual language outranks account, browser and detection preferences', () => {
  for (const locale of LOCALES) {
    assert.equal(
      resolveLocale({ explicit: locale, account: 'de', guest: 'fr', browser: ['ja'] }),
      locale,
    );
    assert.equal(resolveLocale({ account: locale, guest: 'fr', browser: ['ja'] }), locale);
    assert.equal(resolveLocale({ guest: locale, browser: ['ja'] }), locale);
  }
  assert.equal(resolveLocale({ browser: ['unsupported', 'de-DE'] }), 'de');
  assert.equal(resolveLocale({ browser: ['unsupported'] }), 'en');
  assert.equal(resolveLocale({ browser: ['ptbanana'] }), 'en');
  for (const [regional, locale] of [
    ['tr-TR', 'tr'],
    ['ru-RU', 'ru'],
    ['vi-VN', 'vi'],
    ['id-ID', 'id'],
    ['hi-IN', 'hi'],
    ['th-TH', 'th'],
    ['uk-UA', 'uk'],
  ] as const) {
    assert.equal(resolveLocale({ browser: [regional] }), locale);
    assert.equal(localeDirection(locale), 'ltr');
    assert.equal(resolveLocale({ explicit: 'en', account: locale, browser: [regional] }), 'en');
  }
  assert.equal(resolveLocale({ browser: ['zh-Hant'] }), 'zh-Hant');
  assert.equal(stripeElementsLocale('hi'), 'en');
  assert.equal(stripeElementsLocale('uk'), 'en');
  for (const locale of ['tr', 'ru', 'vi', 'id', 'th'] as const)
    assert.equal(stripeElementsLocale(locale), locale);
});
test('navigation respects explicit language URLs while language selection replaces their prefix', () => {
  for (const requested of LOCALES) {
    const path = `/${requested}/checkout?currency=EUR#payment`;
    for (const current of LOCALES) {
      assert.equal(navigationLocalePath(path, current), path);
      assert.equal(
        localePath(path, current),
        `${current === 'en' ? '' : '/' + current}/checkout?currency=EUR#payment`,
      );
    }
    assert.equal(
      navigationLocalePath('/checkout?currency=GBP', requested),
      `${requested === 'en' ? '' : '/' + requested}/checkout?currency=GBP`,
    );
    assert.equal(navigationLocalePath('/operations', requested), '/operations');
  }
});
test('selection priority is independent of currencies and every complete language is enabled', () => {
  assert.deepEqual(PUBLISHED_LOCALES, LOCALES);
  assert.equal(
    resolveLocale({ explicit: 'fr', account: 'de', guest: 'ja', browser: ['pl'] }, LOCALES),
    'fr',
  );
  assert.equal(resolveLocale({ account: 'de', guest: 'ja', browser: ['pl'] }, LOCALES), 'de');
  assert.equal(resolveLocale({ guest: 'ja', browser: ['pl'] }, LOCALES), 'ja');
  assert.equal(resolveLocale({ browser: ['pt-PT'] }, LOCALES), 'pt-BR');
  assert.equal(resolveLocale({ browser: ['zh-CN'] }, LOCALES), 'zh-Hans');
  assert.equal(resolveLocale({ browser: ['zh-Hant', 'en'] }, LOCALES), 'zh-Hant');
  assert.equal(resolveLocale({ account: 'de', browser: ['ar'] }), 'de');
  for (const locale of LOCALES.filter((value) => value !== 'en')) {
    assert.equal(localeReview(locale).legal, 'published');
    assert.equal(requirePublishedLocale(locale), locale);
  }
  assert.equal(localePath('/cart?currency=EUR#summary', 'de'), '/de/cart?currency=EUR#summary');
  assert.equal(localePath('/de/cart?currency=GBP', 'fr'), '/fr/cart?currency=GBP');
  assert.equal(localePath('/de?currency=EUR#plans', 'en'), '/?currency=EUR#plans');
  assert.equal(localePath('/operations?from=2026-11-01', 'de'), '/operations?from=2026-11-01');
  assert.equal(localePath('/api/store/v2/checkout', 'de'), '/api/store/v2/checkout');
});
test('Chinese script and regional detection keep both catalogues independent of manual choice and provider language codes', async () => {
  for (const browser of ['zh-TW', 'zh-HK', 'zh-MO', 'ZH-hAnT', 'zh-Hant-HK', 'zh-Hant-CN'])
    assert.equal(resolveLocale({ browser: [browser] }), 'zh-Hant');
  for (const browser of ['zh-CN', 'zh-SG', 'zh', 'zh-Hans', 'zh-Hans-TW'])
    assert.equal(resolveLocale({ browser: [browser] }), 'zh-Hans');
  for (const locale of ['zh-Hans', 'zh-Hant'] as const) {
    assert.equal(resolveLocale({ explicit: locale, account: 'en', browser: ['zh-HK'] }), locale);
    assert.equal(resolveLocale({ account: locale, guest: 'en', browser: ['zh-SG'] }), locale);
    assert.equal(resolveLocale({ guest: locale, browser: ['zh-CN'] }), locale);
    assert.equal(localeDirection(locale), 'ltr');
    assert.equal(orderLocale(locale), locale);
    assert.equal(localePath('/checkout?currency=GBP', locale), `/${locale}/checkout?currency=GBP`);
  }
  assert.equal(resolveLocale({ explicit: 'en', browser: ['zh-TW'] }), 'en');
  assert.equal(resolveLocale({ browser: ['zh-TW', 'fr'] }, ['en', 'fr']), 'fr');
  assert.equal(stripeElementsLocale('zh-Hans'), 'zh');
  assert.equal(stripeElementsLocale('zh-Hant'), 'zh-TW');
  assert.equal(firebaseAuthLocale('zh-Hans'), 'zh-CN');
  assert.equal(firebaseAuthLocale('zh-Hant'), 'zh-TW');
  assert.equal(firebaseAuthLocale('en'), 'en');
  assert.equal(documentFontFiles('zh-Hans').Inter, 'NotoSansSC-Regular.woff2');
  assert.equal(documentFontFiles('zh-Hant').Inter, 'NotoSansTC-Regular.woff2');
  assert.equal(documentFontFiles('zh-Hant').InterBold, 'NotoSansTC-Bold.woff2');
  const hans = await loadMessages('zh-Hans');
  const hant = await loadMessages('zh-Hant');
  assert.equal(hans.checkout.title, '结算');
  assert.equal(hant.checkout.title, '結帳');
  assert.equal(hant.authUi.email, '電子郵件地址');
  assert.match(hant.display.installInstructions, /流動網絡/);
  assert.match(hant.display.installInstructions, /行動服務/);
  assert.match(hant.planInfo.deviceNotice, /未受電信業者鎖定/);
});
test('Polish and Arabic plural forms are grammatical categories, with opaque recorded amounts', async () => {
  const pl = createTranslator({ locale: 'pl', messages: await loadMessages('pl') });
  assert.match(pl('plans.days', { count: 1 }), /dzień/);
  assert.match(pl('plans.days', { count: 2 }), /dni/);
  assert.match(pl('plans.days', { count: 5 }), /dni/);
  const ar = createTranslator({ locale: 'ar', messages: await loadMessages('ar') });
  for (const [count, word] of [
    [0, 'لا أيام'],
    [1, 'يوم واحد'],
    [2, 'يومان'],
    [3, 'أيام'],
    [11, 'يومًا'],
  ] as const)
    assert.match(ar('plans.days', { count }), new RegExp(word));
  const original = contractMoney(113, 'GBP');
  for (const locale of LOCALES) {
    const t = createTranslator({ locale, messages: await loadMessages(locale) });
    assert.ok(t('checkout.pay', { amount: original }).includes(original));
  }
  assert.equal(localeDirection('ar'), 'rtl');
  assert.equal(stripeElementsLocale('zh-Hans'), 'zh');
  assert.equal(destinationName('DE', 'de'), 'Deutschland');
  assert.equal(destinationName('JP', 'ja'), '日本');
  assert.equal(destinationName('GB', 'en'), 'United Kingdom');
  assert.equal(destinationName('EG', 'ro'), 'Egypt');
  assert.equal(destinationName('EG', 'es'), 'Egipto');
  assert.throws(() => destinationName('invalid', 'en'));
  assert.equal(stripeElementsLocale('pt-BR'), 'pt-BR');
});
test('order and legal locale are immutable inputs, with reproducible legal hashes and no foreign fallback', () => {
  assert.equal(orderLocale(undefined), 'en');
  assert.throws(() => orderLocale('xx'));
  const a = legalSnapshot(CHECKOUT_LEGAL_ACCEPTANCE, '2026-11-16T12:00:00Z');
  const b = legalSnapshot(CHECKOUT_LEGAL_ACCEPTANCE, '2026-11-16T13:00:00Z');
  assert.equal(a.locale, 'en');
  assert.match(a.contentHash ?? '', /^[a-f0-9]{64}$/);
  assert.equal(a.contentHash, b.contentHash);
  assert.equal(transactionLocale({ locale: 'en', legal: a }), 'en');
  assert.equal(legalSnapshot(CHECKOUT_LEGAL_ACCEPTANCE, undefined, 'de').locale, 'de');
  assert.equal(transactionLocale({ locale: 'de', legal: { locale: 'de' } }), 'de');
  assert.throws(() => transactionLocale({ locale: 'en', legal: { locale: 'fr' } }));
  assert.ok(legalDocuments('en').some((document) => document.slug === 'terms'));
  assert.equal(legalDocuments('de').length, 7);
  assert.throws(() => legalDocuments('de', '2026-11-13.1'));
  assert.throws(() => requirePublishedLocale('unknown'));
  assert.throws(() => legalDocuments('en', 'unknown-version'));
});
test('internal email sample is RTL-safe and preserves the sample currency', async () => {
  const preview = await localizationPreview('ar');
  assert.equal(preview.published, true);
  assert.equal(preview.legal.status, 'published');
  assert.match(preview.email.html, /dir="rtl"/);
  assert.doesNotMatch(preview.email.html, /DRAFT|not available yet/);
  assert.equal(preview.legal.documents.length, 7);
  assert.equal(preview.legal.professionalReviewRequired, true);
  assert.match(preview.email.html, /data:image\/png;base64,/);
  assert.match(preview.email.html, /<bdi dir="ltr">GBP 1.13<\/bdi>/);
});
test('structured customer error mapping is safe for unknown codes and does not expose backend diagnostics', async () => {
  const error = await storeApiError(
    { error: { code: 'PROMO_CODE_EXPIRED', params: {}, requestId: 'req-1' } },
    400,
  );
  assert.equal(error.code, 'PROMO_CODE_EXPIRED');
  assert.match(error.message, /expired/);
  const notApplicable = await storeApiError(
    { errorDetails: { code: 'PROMO_CODE_NOT_APPLICABLE' } },
    409,
  );
  assert.match(notApplicable.message, /cannot be applied to this order/);
  assert.doesNotMatch(notApplicable.message, /not valid|margin|contribution/);
  const unknown = await storeApiError(
    { error: { code: 'UNKNOWN_ERROR', message: 'database secret diagnostics' } },
    503,
  );
  assert.equal(unknown.code, 'INTERNAL_ERROR');
  assert.doesNotMatch(unknown.message, /database|secret/);
  const legacy = await storeApiError({ error: 'private backend validation diagnostic' }, 400);
  assert.doesNotMatch(legacy.message, /private|backend|diagnostic/);
  const validation = await storeApiError(
    {
      error: {
        code: 'VALIDATION_FAILED',
        field: 'email',
        requestId: 'req-123',
        params: { count: 2, nested: { secret: true }, invalid: Infinity },
      },
    },
    400,
  );
  assert.equal(validation.field, 'email');
  assert.equal(validation.requestId, 'req-123');
  assert.deepEqual(validation.params, { count: 2 });
});

test('native supplier daily and unlimited titles translate known descriptions while leaving product identifiers unchanged', async () => {
  const { planDisplayCopy } = await import('../../packages/shared/src/i18n/plan-copy');
  for (const locale of LOCALES.filter((value) => value !== 'en')) {
    const t = createTranslator({ locale, messages: await loadMessages(locale) });
    const copy = planDisplayCopy(locale, t);
    assert.equal(
      copy.activation(
        'Starts on first connection to a supported network. Check your purchased plan before installation.',
      ),
      t('cart.activationLegacyNetwork'),
    );
    const title = copy.title({ name: 'United Kingdom 1GB/Day 7Days', countries: ['GB'], days: 7 });
    assert.ok(!title.includes('/Day'));
    assert.ok(title.includes(t('plans.days', { count: 7 })));
    assert.ok(
      copy
        .title({ name: 'Global Unlimited 7Days', countries: ['GB', 'FR'], days: 7 })
        .includes(t('display.unlimited')),
    );
  }
});

test('photograph translations preserve the actual photographed subjects and every curated destination', async () => {
  const { inspirationDestinations } =
    await import('../../packages/shared/src/destination-inspiration');
  const { inspirationPhotoCodes } = await import('../../packages/shared/src/i18n/places');
  assert.deepEqual([...inspirationPhotoCodes].sort(), Object.keys(inspirationDestinations).sort());
  const english = await loadMessages('en');
  for (const code of inspirationPhotoCodes)
    assert.equal(english.photoUi[code], inspirationDestinations[code].alt);
  for (const locale of LOCALES.filter((value) => value !== 'en')) {
    const messages = await loadMessages(locale);
    for (const code of inspirationPhotoCodes)
      assert.notEqual(messages.photoUi[code], english.photoUi[code]);
  }
});
