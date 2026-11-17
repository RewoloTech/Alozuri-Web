import {
  LOCALES,
  LOCALE_NAMES,
  localeReview,
  localeDirection,
  isPublishedLocale,
  type Locale,
} from '../../../../packages/shared/src/i18n/locales.ts';
import { loadMessages } from '../../../../packages/shared/src/i18n/catalogs.ts';
import { validateMessages } from '../../../../packages/shared/src/i18n/validation.ts';
import { LEGAL_VERSION } from '../../../../packages/shared/src/legal.ts';
import { demoPlans } from '../../../../packages/shared/src/demo.ts';
import { CHECKOUT_LEGAL_ACCEPTANCE } from '../../../../packages/shared/src/legal.ts';
import { POLICY_TRANSLATION_REVIEW } from '../../../../packages/shared/src/i18n/policies/catalogs.ts';
import { confirmationOrderSchema } from './confirmation-order.js';
import { legalSnapshot } from './legal.js';
import { installationConfirmationEmail } from './order-email-installation.js';
import { legalDocuments } from '../../../../packages/shared/src/i18n/legal-documents.ts';

export async function localizationPreview(locale: Locale) {
  const messages = await loadMessages(locale);
  validateMessages(messages, locale);
  // Controlled synthetic fixture rendered by the production template. This
  // protected read-only endpoint never saves an order, contacts a supplier or sends mail.
  const createdAt = '2026-11-16T12:00:00.000Z';
  const order = confirmationOrderSchema.parse({
    id: 'purchase_' + '0'.repeat(48),
    email: 'sample@example.test',
    locale,
    createdAt,
    paidAt: createdAt,
    currency: 'GBP',
    subtotalCents: 113,
    taxCents: 0,
    totalCents: 113,
    test: true,
    items: [
      {
        plan: {
          ...demoPlans[0],
          name: 'France 1GB 7Days',
          dataGb: 1,
          days: 7,
          countries: ['FR'],
          activation: 'Starts on first connection to a supported mobile network.',
          fairUse: 'Fixed total data allowance. Data only; no local phone number.',
          currency: 'GBP',
          priceCents: 113,
        },
        quantity: 1,
      },
    ],
    legal: legalSnapshot(CHECKOUT_LEGAL_ACCEPTANCE, createdAt, locale),
  });
  const sample = await installationConfirmationEmail(
    order,
    'https://alozuri.com/checkout/success?order=' + order.id + '#access=synthetic-only',
    [
      {
        unitId: 'order_' + '0'.repeat(48),
        planId: order.items[0].plan.id,
        activation: {
          ac: 'LPA:1$rsp.example.test$SYNTHETIC-NOT-INSTALLABLE',
          iccid: '8900000000000000000',
          esimTranNo: 'synthetic-only',
        },
      },
    ],
  );
  // Email clients resolve CID attachments. The internal browser sample embeds the
  // same synthetic PNG so it can be inspected without sending a real message.
  let html = sample.html;
  for (const image of sample.attachments ?? [])
    html = html.replace('cid:' + image.content_id, 'data:image/png;base64,' + image.content);
  return {
    locale,
    published: isPublishedLocale(locale),
    direction: localeDirection(locale),
    review: localeReview(locale),
    messages,
    email: {
      subject: sample.subject,
      html,
      text: sample.text,
      status: localeReview(locale).email,
    },
    legal: {
      locale,
      version: LEGAL_VERSION,
      status: localeReview(locale).legal,
      documents: legalDocuments(locale),
      professionalReviewRequired:
        locale !== 'en' && !POLICY_TRANSLATION_REVIEW.professionalReviewCompleted,
    },
    locales: LOCALES.map((value) => ({
      locale: value,
      name: LOCALE_NAMES[value],
      published: isPublishedLocale(value),
      review: localeReview(value),
    })),
  };
}
