import { createTranslator } from 'use-intl/core';
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
import { money } from '../../../../packages/shared/src/index.ts';
import { legalDocuments } from '../../../../packages/shared/src/i18n/legal-documents.ts';
import { escapeEmailHtml } from './order-email.js';
export async function localizationPreview(locale: Locale) {
  const messages = await loadMessages(locale);
  validateMessages(messages, locale);
  const t = createTranslator({
    locale,
    messages,
    onError: (error) => {
      throw error;
    },
  });
  const e = escapeEmailHtml;
  // Preview identifiers and amounts are fixed fixtures; this never sends email,
  // creates an order, or supplies a substitute foreign-language legal document.
  const html = `<html lang="${locale}" dir="${localeDirection(locale)}"><body style="font-family:system-ui,sans-serif;padding:24px"><p><strong>PREVIEW ONLY — ${locale === 'en' ? 'English source' : 'DRAFT, not approved for delivery or checkout'}</strong></p><h1>${e(t('emails.confirmed'))}</h1><p>${e(t('emails.reference', { reference: 'AZ-PREVIEW' }))}</p><p><bdi dir="ltr">${e(money(113, 'GBP'))}</bdi></p><h2>${e(t('installation.title'))}</h2><p>${e(t('installation.wifi'))}</p><p>${e(t('installation.private'))}</p><p>${e(t('plans.days', { count: 7 }))}</p></body></html>`;
  return {
    locale,
    published: isPublishedLocale(locale),
    direction: localeDirection(locale),
    review: localeReview(locale),
    messages,
    email: {
      subject: t('emails.confirmationSubject'),
      html,
      text: [
        t('emails.confirmed'),
        t('emails.reference', { reference: 'AZ-PREVIEW' }),
        money(113, 'GBP'),
        t('installation.wifi'),
      ].join('\n'),
      status: localeReview(locale).email,
    },
    legal: {
      locale,
      version: LEGAL_VERSION,
      status: localeReview(locale).legal,
      documents: locale === 'en' ? legalDocuments(locale) : [],
    },
    locales: LOCALES.map((value) => ({
      locale: value,
      name: LOCALE_NAMES[value],
      published: isPublishedLocale(value),
      review: localeReview(value),
    })),
  };
}
