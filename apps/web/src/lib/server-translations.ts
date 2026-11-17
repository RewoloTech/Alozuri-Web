import { cache } from 'react';
import { createTranslator } from 'use-intl/core';
import { loadMessages } from '@alozuri/shared/i18n/catalogs';
import { localeDirection } from '@alozuri/shared/i18n';
import type { Messages } from '@alozuri/shared/i18n/messages';
import { requestLocale } from './request-locale';
export type TranslationKey = {
  [Domain in keyof Messages]: `${Domain}.${Extract<keyof Messages[Domain], string>}`;
}[keyof Messages];
export const serverTranslations = cache(async () => {
  const locale = await requestLocale();
  return {
    locale,
    dir: localeDirection(locale),
    t: createTranslator({ locale, messages: await loadMessages(locale) }),
  };
});
export async function privateMetadata(title: TranslationKey) {
  const { t } = await serverTranslations();
  return { title: t(title), robots: { index: false, follow: false } };
}
