import { createHash } from 'node:crypto';
import { legalDocuments } from '../../../../packages/shared/src/i18n/legal-documents.ts';
import { staticMessages } from '../../../../packages/shared/src/i18n/static-catalogs.ts';
import { createTranslator } from 'use-intl/core';
import {
  LOCALES,
  requirePublishedLocale,
  type Locale,
} from '../../../../packages/shared/src/i18n/locales.ts';
import { z } from 'zod';
import {
  BUSINESS,
  NOTICE_LEGAL_VERSIONS,
  CHECKOUT_NOTICE,
  type CheckoutLegalInput,
} from '../../../../packages/shared/src/legal.ts';
import { POLICY_VERSIONS, policyText } from '../../../../packages/shared/src/policies.ts';
const noticeSchema = z
  .object({
    version: z.enum(NOTICE_LEGAL_VERSIONS),
    method: z.literal('order_placement'),
    noticeAcknowledged: z.literal(true),
  })
  .strict();
const previousCheckoutSchema = z
  .object({
    version: z.literal('2026-11-11.1'),
    termsAccepted: z.literal(true),
    immediateSupplyRequested: z.literal(true),
    cancellationAcknowledged: z.literal(true),
  })
  .strict();
export const checkoutLegalSchema = z.union([noticeSchema, previousCheckoutSchema]);
export const legalSnapshotSchema = z.object({
  locale: z.enum(LOCALES).optional(),
  contentHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  version: z.string().max(40),
  effectiveDate: z.string(),
  termsVersion: z.string().max(40).optional(),
  refundVersion: z.string().max(40).optional(),
  acceptedAt: z.string(),
  termsAccepted: z.literal(true),
  immediateSupplyRequested: z.boolean(),
  cancellationAcknowledged: z.boolean(),
  method: z.literal('order_placement').optional(),
  noticeAcknowledged: z.literal(true).optional(),
  noticeText: z.string().optional(),
  requestText: z.string(),
  acknowledgementText: z.string(),
  termsText: z.string(),
  refundText: z.string(),
  business: z
    .object({
      brand: z.string(),
      company: z.string(),
      number: z.string(),
      jurisdiction: z.string(),
      address: z.string(),
      email: z.email(),
      site: z.url(),
      identity: z.string(),
    })
    .optional(),
});
export type LegalSnapshot = z.infer<typeof legalSnapshotSchema>;
function englishLegalSnapshot(
  input: CheckoutLegalInput,
  now = new Date().toISOString(),
): LegalSnapshot {
  const accepted = checkoutLegalSchema.parse(input);
  if (accepted.version === '2026-11-11.1') {
    return {
      ...accepted,
      business: { ...BUSINESS },
      termsVersion: accepted.version,
      refundVersion: accepted.version,
      effectiveDate: '2026-11-11',
      acceptedAt: now,
      requestText:
        'I expressly request immediate supply of my eSIM before the 14-day cancellation period ends.',
      acknowledgementText:
        'I understand that, where my purchase is digital content, my cancellation right ends when supply begins with my express consent and this acknowledgement. For a service, cancellation rights are affected only as the law permits, including proportionate charges for requested early performance and loss of the right after full performance with the required consent. My rights for faulty or misdescribed products are not waived.',
      termsText: policyText(POLICY_VERSIONS[accepted.version].terms, accepted.version),
      refundText: policyText(POLICY_VERSIONS[accepted.version].refunds, accepted.version),
    };
  }
  return {
    ...accepted,
    business: { ...BUSINESS },
    termsVersion: accepted.version,
    refundVersion: accepted.version,
    effectiveDate: accepted.version.slice(0, 10),
    acceptedAt: now,
    termsAccepted: true,
    immediateSupplyRequested: false,
    cancellationAcknowledged: false,
    noticeText: CHECKOUT_NOTICE,
    requestText: '',
    acknowledgementText: '',
    termsText: policyText(POLICY_VERSIONS[accepted.version].terms, accepted.version),
    refundText: policyText(POLICY_VERSIONS[accepted.version].refunds, accepted.version),
  };
}

export function legalSnapshot(
  input: CheckoutLegalInput,
  now = new Date().toISOString(),
  locale: Locale = 'en',
): LegalSnapshot {
  requirePublishedLocale(locale);
  // A status change alone cannot turn English legal text into another language.
  const documents = legalDocuments(locale, input.version);
  const snapshot = englishLegalSnapshot(input, now);
  if (locale !== 'en') {
    const terms = documents.find((document) => document.slug === 'terms');
    const refunds = documents.find((document) => document.slug === 'refunds');
    if (!terms || !refunds) throw new Error('Accepted legal documents are unavailable.');
    const t = createTranslator({ locale, messages: staticMessages(locale) });
    const isolate = (value: string) => (locale === 'ar' ? '\u2066' + value + '\u2069' : value);
    snapshot.termsText = terms.text;
    snapshot.refundText = refunds.text;
    snapshot.noticeText = t('legalUi.notice');
    snapshot.business = {
      ...BUSINESS,
      identity: t('site.company', {
        brand: isolate(BUSINESS.brand),
        company: isolate(BUSINESS.company),
        number: isolate(BUSINESS.number),
      }),
    };
  }
  const contentHash = createHash('sha256')
    .update(
      JSON.stringify({
        locale,
        version: snapshot.version,
        business: snapshot.business ?? BUSINESS,
        termsVersion: snapshot.termsVersion ?? snapshot.version,
        refundVersion: snapshot.refundVersion ?? snapshot.version,
        effectiveDate: snapshot.effectiveDate,
        terms: snapshot.termsText,
        refunds: snapshot.refundText,
        notice: snapshot.noticeText ?? '',
        request: snapshot.requestText,
        acknowledgement: snapshot.acknowledgementText,
      }),
    )
    .digest('hex');
  return { ...snapshot, locale, contentHash };
}
