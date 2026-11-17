import { englishMessages, type Messages } from './messages.ts';
import type { Locale } from './locales.ts';
import { messages as messages0 } from './es.ts';
import { messages as messages1 } from './de.ts';
import { messages as messages2 } from './fr.ts';
import { messages as messages3 } from './it.ts';
import { messages as messages4 } from './pt-BR.ts';
import { messages as messages5 } from './ro.ts';
import { messages as messages6 } from './ja.ts';
import { messages as messages7 } from './ko.ts';
import { messages as messages8 } from './zh-Hans.ts';
import { messages as messages9 } from './ar.ts';
import { messages as messages10 } from './nl.ts';
import { messages as messages11 } from './pl.ts';
import { messages as messages12 } from './tr.ts';
import { messages as messages13 } from './ru.ts';
import { messages as messages14 } from './vi.ts';
import { messages as messages15 } from './id.ts';
import { messages as messages16 } from './hi.ts';
import { messages as messages17 } from './th.ts';
import { messages as messages18 } from './uk.ts';
import { messages as traditionalChinese } from './zh-Hant.ts';
/** Only synchronous document/email renderers use this module. Website catalogues stay lazy. */
const catalogues: Record<Locale, Messages> = {
  en: englishMessages,
  es: messages0,
  de: messages1,
  fr: messages2,
  it: messages3,
  'pt-BR': messages4,
  ro: messages5,
  ja: messages6,
  ko: messages7,
  'zh-Hans': messages8,
  ar: messages9,
  nl: messages10,
  pl: messages11,
  tr: messages12,
  ru: messages13,
  vi: messages14,
  id: messages15,
  hi: messages16,
  th: messages17,
  uk: messages18,
  'zh-Hant': traditionalChinese,
};
export function staticMessages(locale: Locale): Messages {
  return catalogues[locale];
}
