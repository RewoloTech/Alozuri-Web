'use client';
import { useLocale, useTranslations } from 'next-intl';
import { isLocale, LocaleUnavailableError } from '@alozuri/shared/i18n';
import { planDisplayCopy } from '@alozuri/shared/i18n/plan-copy';
/** Shared presentation rules; never derive currency or prices from language. */
export function usePlanCopy() {
  const locale = useLocale();
  const translate = useTranslations();
  if (!isLocale(locale)) throw new LocaleUnavailableError();
  return planDisplayCopy(locale, translate);
}
