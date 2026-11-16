import { englishMessages, type Messages } from './messages.ts';
import type { Locale } from './locales.ts';
/** Draft imports are lazy: never ship every language to every visitor. */
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
    case 'ar':
      return (await import('./ar.ts')).messages;
    case 'nl':
      return (await import('./nl.ts')).messages;
    case 'pl':
      return (await import('./pl.ts')).messages;
  }
}
