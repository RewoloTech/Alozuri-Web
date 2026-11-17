import test from 'node:test';
import { z } from 'zod';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { LOCALES, localePath } from '../../../packages/shared/src/i18n/locales.ts';
import { loadMessages } from '../../../packages/shared/src/i18n/catalogs.ts';
import {
  legalDocuments,
  localizedPolicies,
} from '../../../packages/shared/src/i18n/legal-documents.ts';
import {
  POLICY_TRANSLATION_SOURCE_DIGESTS,
  POLICY_TRANSLATION_REVIEW,
} from '../../../packages/shared/src/i18n/policies/catalogs.ts';
import { POLICY_VERSIONS } from '../../../packages/shared/src/policies.ts';
import { CHECKOUT_LEGAL_ACCEPTANCE, LEGAL_VERSION } from '../../../packages/shared/src/legal.ts';
import {
  sampleConfirmation,
  sampleInstallations,
} from '../../../tests/fixtures/order-confirmation.ts';
import { legalSnapshot } from '../src/lib/legal.ts';
import { installationConfirmationEmail } from '../src/lib/order-email-installation.ts';
import { confirmationPayloadHash, confirmationPayload } from '../src/lib/order-email.ts';
import {
  freezeNotification,
  readNotification,
  installationSnapshotHash,
} from '../src/lib/notification-snapshot.ts';
import { renderContractPdf } from '../src/lib/contract-pdf.ts';

test('versioned legal text hashes pin every published language including labels and metadata', async () => {
  const manifest = z
    .record(z.string(), z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)))
    .parse(
      JSON.parse(
        await readFile(
          new URL(
            '../../../packages/shared/src/i18n/policies/2026-11-16.1/SHA256.json',
            import.meta.url,
          ),
          'utf8',
        ),
      ),
    );
  assert.deepEqual(Object.keys(manifest), LOCALES);
  for (const locale of LOCALES)
    for (const document of legalDocuments(locale))
      assert.equal(
        createHash('sha256').update(document.text).digest('hex'),
        manifest[locale][document.slug],
        'Published wording requires a new legal version.',
      );
});

test('versioned translations cover the exact English master without claiming professional legal approval', () => {
  for (const [version, digest] of Object.entries(POLICY_TRANSLATION_SOURCE_DIGESTS)) {
    assert.equal(
      createHash('sha256').update(JSON.stringify(POLICY_VERSIONS[version])).digest('hex'),
      digest,
      'Legal source changes require a new reviewed translation version.',
    );
  }
  assert.equal(POLICY_TRANSLATION_REVIEW.professionalReviewCompleted, false);
  for (const locale of LOCALES) {
    const policies = localizedPolicies(locale);
    assert.deepEqual(Object.keys(policies), Object.keys(POLICY_VERSIONS[LEGAL_VERSION]));
    for (const [slug, policy] of Object.entries(policies)) {
      const source = POLICY_VERSIONS[LEGAL_VERSION][slug];
      assert.equal(policy.path, source.path);
      assert.equal(policy.slug, source.slug);
      assert.equal(policy.sections.length, source.sections.length);
      if (locale !== 'en') assert.notEqual(policy.description, source.description);
      policy.sections.forEach((section, index) => {
        const original = source.sections[index];
        assert.equal(section.paragraphs.length, original.paragraphs.length);
        assert.equal(section.steps?.length, original.steps?.length);
        assert.deepEqual(
          section.links?.map((link) => link.href),
          original.links?.map((link) => link.href),
        );
        assert.equal(section.table?.rows.length, original.table?.rows.length);
        if (locale !== 'en')
          section.paragraphs.forEach((paragraph, p) =>
            assert.notEqual(paragraph, original.paragraphs[p]),
          );
      });
    }
    const cookies = policies.cookies.sections.find((section) => section.table)?.table;
    assert.ok(cookies?.rows.some((row) => row[0] === 'alozuri_locale / alozuri_locale_explicit'));
  }
});
for (const [index, locale] of LOCALES.entries())
  test(`saved ${locale} order renders its own email, QR and contract with original amounts`, async () => {
    const currency = (['GBP', 'USD', 'EUR'] as const)[index % 3];
    const source = sampleConfirmation(currency);
    const createdAt = '2026-11-16T12:00:00.000Z',
      paidAt = '2026-11-16T12:03:12.000Z';
    const order = {
      ...source,
      locale,
      createdAt,
      paidAt,
      test: true,
      legal: legalSnapshot(CHECKOUT_LEGAL_ACCEPTANCE, createdAt, locale),
    };
    order.items = order.items.map((item) => ({
      ...item,
      plan: {
        ...item.plan,
        name: 'France 1GB 7Days',
        dataGb: 1,
        days: 7,
        countries: ['FR'],
        activation: 'Starts on first connection to a supported mobile network.',
        fairUse: 'Fixed total data allowance. Data only; no local phone number.',
      },
    }));
    const units = sampleInstallations(order);
    const url = 'https://alozuri.com/checkout/success?order=' + order.id + '#access=synthetic-only';
    const email = await installationConfirmationEmail(order, url, units);
    const messages = await loadMessages(locale);
    assert.equal(email.subject, messages.emails.confirmationSubject);
    assert.ok(email.html.includes(`lang="${locale}"`));
    assert.ok(email.html.includes(`dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`));
    assert.ok(email.text.includes(messages.transactionUi.thanks));
    assert.ok(email.text.includes(currency + ' 38.98'));
    assert.ok(email.text.includes(order.legal.termsText));
    assert.ok(email.text.includes(order.legal.refundText));
    assert.ok(email.url.includes(localePath('/checkout/success', locale)));
    assert.ok(email.url.endsWith('#access=synthetic-only'));
    assert.equal(email.attachments?.length, 2);
    const englishQr = await installationConfirmationEmail(source, url, sampleInstallations(source));
    assert.deepEqual(
      email.attachments,
      englishQr.attachments,
      'Translation must not change installation payloads.',
    );
    assert.ok(
      Buffer.byteLength(email.html) < 100_000,
      'Ordinary native confirmations must fit below Gmail clipping size.',
    );
    const frozen = freezeNotification(email);
    const installationHash = installationSnapshotHash(units);
    const stored = {
      event: 'order-confirmation',
      orderId: order.id,
      locale,
      templateVersion: frozen.version,
      payloadHash: confirmationPayloadHash(frozen),
      installationHash,
      rendered: frozen,
    };
    assert.deepEqual(
      confirmationPayload(readNotification(stored, order.id, locale, installationHash)),
      confirmationPayload(frozen),
    );
    assert.throws(() =>
      readNotification(stored, order.id, locale === 'en' ? 'fr' : 'en', installationHash),
    );
    const documents = legalDocuments(locale);
    assert.equal(
      order.legal.termsText,
      documents.find((document) => document.slug === 'terms')?.text,
    );
    assert.equal(
      order.legal.refundText,
      documents.find((document) => document.slug === 'refunds')?.text,
    );
    assert.equal(
      order.legal.contentHash,
      legalSnapshot(CHECKOUT_LEGAL_ACCEPTANCE, paidAt, locale).contentHash,
    );
    const pdf = await renderContractPdf(order);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 10_000 && pdf.length < 5 * 1024 * 1024);
    if (process.env.I18N_ARTIFACT_DIR) {
      await mkdir(process.env.I18N_ARTIFACT_DIR, { recursive: true });
      await Promise.all([
        writeFile(join(process.env.I18N_ARTIFACT_DIR, locale + '.pdf'), pdf),
        writeFile(join(process.env.I18N_ARTIFACT_DIR, locale + '.html'), email.html),
        writeFile(join(process.env.I18N_ARTIFACT_DIR, locale + '.txt'), email.text),
      ]);
    }
  });
