import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator } from 'use-intl/core';
import { LOCALES } from '../../packages/shared/src/i18n/locales.ts';
import { loadMessages } from '../../packages/shared/src/i18n/catalogs.ts';
import {
  supplierCopyMessage,
  translateSupplierCopy,
} from '../../packages/shared/src/i18n/supplier-copy.ts';

test('supplier translation recognises verified templates and preserves exact data quantities and rates', async () => {
  const sources = [
    '500 MB high-speed per day, then reduced speed (384Kbps).',
    '1.5 GB high-speed per day, then reduced speed (500 Kbps).',
  ];
  for (const locale of LOCALES) {
    const t = createTranslator({
      locale,
      messages: await loadMessages(locale),
      namespace: 'supplierCopy',
    });
    for (const source of sources) {
      const message = supplierCopyMessage(source);
      assert.equal(message?.key, 'reduced');
      const rendered = translateSupplierCopy(source, t);
      assert.ok(rendered.includes(String(message!.params.size)));
      assert.ok(rendered.includes(String(message!.params.speed)));
    }
  }
  assert.equal(
    supplierCopyMessage('1 GB per day. Service stops at the daily limit. ')?.key,
    'cutoff',
  );
  assert.equal(
    supplierCopyMessage('1 GB high-speed per day, then reduced speed (unknown speed).'),
    null,
  );
  assert.equal(
    supplierCopyMessage('1 GB per day. Service stops at the daily limit. UNVERIFIED CONDITION'),
    null,
  );
  const unrecognised = 'Supplier-specific future condition must not be invented.';
  assert.equal(
    translateSupplierCopy(unrecognised, () =>
      assert.fail('Unknown conditions cannot select a guessed translation'),
    ),
    unrecognised,
  );
});
test('supplier restrictions stay separate from merchant policy and minimum prices are opaque source text', async () => {
  const source =
    'SM-DP+ Status: Online SM-DP+ status inquiry is not supported.\nCheck Usage: Online usage inquiry is not supported.\nRefund Policy: Once purchased, the eSIM status changes to IN USE. Refunds are not available, including for unused eSIMs.';
  for (const locale of LOCALES) {
    const messages = await loadMessages(locale);
    const t = createTranslator({ locale, messages, namespace: 'supplierCopy' });
    const result = translateSupplierCopy(source, t);
    assert.ok(result.includes(messages.supplierCopy.refundInUse));
    assert.equal(result.split('\n').length, 3);
  }
  const sales =
    'Sales Policy: Resellers must ensure that the retail price to end customers is no less than USD 29.3, in compliance with this minimum retail price policy by carrier supplier, otherwise the plan reselling may be stopped.';
  assert.deepEqual(supplierCopyMessage(sales), { key: 'salesMinimum', params: { amount: '29.3' } });
  assert.equal(supplierCopyMessage('__proto__'), null);
});

test('shared display rules localise verified plan descriptions without changing the stored plan or amounts', async () => {
  const { planDisplayCopy } = await import('../../packages/shared/src/i18n/plan-copy.ts');
  const plan = Object.freeze({
    id: 'verified-uk-plan',
    name: 'United Kingdom 1GB 7Days',
    countries: ['GB'],
    dataGb: 1,
    days: 7,
    currency: 'GBP' as const,
    priceCents: 113,
    dataType: 'fixed' as const,
    activation: 'Starts on first connection to a supported mobile network.',
    fairUse: 'Fixed total data allowance. Data only; no local phone number.',
    networks: [],
    syncedAt: '2026-11-16T00:00:00Z',
  });
  const before = JSON.stringify(plan);
  for (const locale of LOCALES) {
    const messages = await loadMessages(locale);
    const t = createTranslator({ locale, messages });
    const copy = planDisplayCopy(locale, t);
    assert.equal(copy.activation(plan.activation), messages.cart.activationNetwork);
    assert.equal(copy.fairUse(plan.fairUse), messages.cart.fairFixed);
    assert.equal(
      copy.activation('Unrecognised supplier activation trigger'),
      'Unrecognised supplier activation trigger',
    );
    assert.ok(copy.title(plan).includes(copy.country('GB')));
    if (locale === 'en') assert.equal(copy.title(plan), plan.name);
    else assert.ok(copy.title(plan).includes(t('plans.days', { count: 7 })));
    assert.equal(copy.title({ ...plan, name: 'Roamer Premium 5G' }), 'Roamer Premium 5G');
    assert.ok(copy.allowance(plan).includes('1 GB'));
    assert.equal(copy.allowance({ ...plan, dataType: 'unlimited' }), messages.display.unlimited);
    assert.equal(
      copy.allowance({ ...plan, dataType: 'daily' }),
      t('display.daily', { size: copy.isolate('1 GB') }),
    );
    assert.equal(
      copy.allowance({ ...plan, dataType: 'daily', dailyPolicy: 'reduced' }),
      t('display.reduced', { size: copy.isolate('1 GB') }),
    );
  }
  assert.equal(JSON.stringify(plan), before);
});

test('all translated guides preserve English structure, destinations and substantive paragraphs', async () => {
  const { localizedGuides } = await import('../../apps/web/src/lib/localized-guides.ts');
  const { guides } = await import('../../apps/web/src/lib/guides.ts');
  assert.deepEqual(await localizedGuides('en'), guides);
  for (const locale of LOCALES) {
    const translated = await localizedGuides(locale);
    assert.equal(translated.length, guides.length);
    translated.forEach((guide, index) => {
      assert.equal(guide.slug, guides[index].slug);
      assert.equal(guide.destination, guides[index].destination);
      assert.equal(guide.sections.length, guides[index].sections.length);
      guide.sections.forEach((section, sectionIndex) => {
        assert.equal(
          section.paragraphs.length,
          guides[index].sections[sectionIndex].paragraphs.length,
        );
        assert.ok(section.paragraphs.every((text) => text.trim().length > 0));
        if (locale !== 'en')
          section.paragraphs.forEach((text, paragraphIndex) =>
            assert.notEqual(text, guides[index].sections[sectionIndex].paragraphs[paragraphIndex]),
          );
      });
    });
  }
});

test('country translations retain every warning and question in the English structure', async () => {
  const { localizedDestinations } =
    await import('../../apps/web/src/lib/localized-destinations.ts');
  const { destinationContent } = await import('../../apps/web/src/lib/destination-content.ts');
  assert.deepEqual(await localizedDestinations('en'), destinationContent);
  for (const locale of LOCALES) {
    const translated = await localizedDestinations(locale);
    assert.deepEqual(Object.keys(translated), Object.keys(destinationContent));
    for (const [code, content] of Object.entries(translated)) {
      assert.ok(content);
      assert.equal(content.tips.length, destinationContent[code].tips.length);
      assert.equal(content.faq.length, destinationContent[code].faq.length);
      if (locale !== 'en') {
        assert.notEqual(content.intro, destinationContent[code].intro);
        content.tips.forEach((tip, index) =>
          assert.notEqual(tip, destinationContent[code].tips[index]),
        );
        content.faq.forEach((faq, index) =>
          assert.notEqual(faq.answer, destinationContent[code].faq[index].answer),
        );
      }
    }
  }
});

test('PDF bidi layout keeps Arabic logical runs and isolated technical values intact', async () => {
  const { pdfVisualRuns, pdfWrappedLines } = await import('../../packages/shared/src/pdf-text.ts');
  const runs = pdfVisualRuns('مرجع الطلب: \u2066AZ-1234-ABCD\u2069', 'rtl');
  assert.equal(runs.find((run) => run.text.includes('AZ-'))?.text, 'AZ-1234-ABCD');
  assert.ok(runs.find((run) => run.font === 'Arabic' && run.text === 'الطلب'));
  assert.equal(runs[0].text, 'AZ-1234-ABCD');
  const amounts = pdfVisualRuns('الإجمالي: \u2066GBP 1.13\u2069', 'rtl');
  assert.ok(amounts.some((run) => run.text === 'GBP 1.13'));
  const wrapped = pdfWrappedLines('one two three\nAZ-1234567890', 7, (text) => text.length);
  assert.deepEqual(wrapped, ['one two', 'three', 'AZ-1234', '567890']);
  const combining = pdfWrappedLines(
    'a\u0301a\u0301a\u0301',
    2,
    (text) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length,
  );
  assert.deepEqual(combining, ['a\u0301a\u0301', 'a\u0301']);
});
