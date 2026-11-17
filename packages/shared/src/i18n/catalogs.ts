import { englishMessages, type Messages } from './messages.ts';
import type { Locale } from './locales.ts';
/** Locale imports are lazy: never ship every language to every visitor. */
export async function loadMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case 'en':
      return englishMessages;
    case 'es':
      return (await import('./es.ts')).messages;
    case 'de':
      return (await import('./de.ts')).messages;
    case 'fr':
      return (await import('./fr.ts')).messages;
    case 'it':
      return (await import('./it.ts')).messages;
    case 'pt-BR':
      return (await import('./pt-BR.ts')).messages;
    case 'ro':
      return (await import('./ro.ts')).messages;
    case 'ja':
      return (await import('./ja.ts')).messages;
    case 'ko':
      return (await import('./ko.ts')).messages;
    case 'zh-Hans':
      return (await import('./zh-Hans.ts')).messages;
    case 'zh-Hant':
      return (await import('./zh-Hant.ts')).messages;
    case 'ar':
      return (await import('./ar.ts')).messages;
    case 'nl':
      return (await import('./nl.ts')).messages;
    case 'pl':
      return (await import('./pl.ts')).messages;
    case 'tr':
      return (await import('./tr.ts')).messages;
    case 'ru':
      return (await import('./ru.ts')).messages;
    case 'vi':
      return (await import('./vi.ts')).messages;
    case 'id':
      return (await import('./id.ts')).messages;
    case 'hi':
      return (await import('./hi.ts')).messages;
    case 'th':
      return (await import('./th.ts')).messages;
    case 'uk':
      return (await import('./uk.ts')).messages;
  }
}
