import {
  orderLocale,
  requirePublishedLocale,
  LocaleUnavailableError,
} from '../../../../packages/shared/src/i18n/locales.ts';
export function transactionLocale(order: { locale?: unknown; legal?: { locale?: unknown } }) {
  const locale = orderLocale(order.locale);
  requirePublishedLocale(locale);
  if (orderLocale(order.legal?.locale) !== locale) throw new LocaleUnavailableError();
  return locale;
}
