import { createTranslator } from 'use-intl/core';
import { staticMessages } from './static-catalogs.ts';
import { planDisplayCopy } from './plan-copy.ts';
import { type Locale, localePath, localeDirection } from './locales.ts';
/** Transactional presentation accepts only the persisted order locale. */
export function transactionCopy(locale: Locale) {
  const t = createTranslator({
    locale,
    messages: staticMessages(locale),
    onError: (error) => {
      throw error;
    },
  });
  return {
    locale,
    t,
    plan: planDisplayCopy(locale, t),
    dir: localeDirection(locale),
    path: (path: string) => localePath(path, locale),
    isolate: (value: string) => (locale === 'ar' ? '\u2066' + value + '\u2069' : value),
  };
}
