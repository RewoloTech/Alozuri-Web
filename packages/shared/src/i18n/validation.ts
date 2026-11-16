import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { englishMessages, type Messages } from './messages.ts';
import type { Locale } from './locales.ts';

function validatePluralCategories(message: string, locale: Locale) {
  const visit = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (
        element.type === TYPE.plural &&
        element.pluralType !== 'ordinal' &&
        ['ar', 'pl'].includes(locale)
      ) {
        const required = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
        if (required.some((category) => !(category in element.options)))
          throw new Error('Translation plural categories are incomplete: ' + locale);
      }
      if (element.type === TYPE.select || element.type === TYPE.plural)
        for (const option of Object.values(element.options)) visit(option.value);
    }
  };
  visit(parse(message));
}
export function messageVariables(message: string): string[] {
  const variables = new Set<string>();
  const visit = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (
        [TYPE.argument, TYPE.number, TYPE.date, TYPE.time, TYPE.select, TYPE.plural].includes(
          element.type,
        ) &&
        'value' in element
      )
        variables.add(element.value);
      if (element.type === TYPE.select || element.type === TYPE.plural)
        for (const option of Object.values(element.options)) visit(option.value);
      if (element.type === TYPE.tag) throw new Error('Translation markup is not allowed.');
    }
  };
  visit(parse(message, { requiresOtherClause: true }));
  return [...variables].sort();
}
export function validateMessages(input: unknown, locale?: Locale): asserts input is Messages {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid translation catalogue.');
  if (Object.keys(input).sort().join('|') !== Object.keys(englishMessages).sort().join('|'))
    throw new Error('Translation domains differ.');
  for (const [domain, source] of Object.entries(englishMessages)) {
    const target: unknown = Reflect.get(input, domain);
    if (
      !target ||
      typeof target !== 'object' ||
      Array.isArray(target) ||
      Object.keys(target).sort().join('|') !== Object.keys(source).sort().join('|')
    )
      throw new Error('Translation keys differ: ' + domain);
    for (const [key, english] of Object.entries(source)) {
      const translated: unknown = Reflect.get(target, key);
      if (typeof translated !== 'string' || !translated.trim() || /[<>]/.test(translated))
        throw new Error('Invalid translation value: ' + domain + '.' + key);
      if (messageVariables(translated).join('|') !== messageVariables(english).join('|'))
        throw new Error('Translation variables differ: ' + domain + '.' + key);
      if (locale && locale !== 'en') {
        // "Destinations" is also natural French. All other identical English copy
        // must be explicitly reviewed rather than silently passed as translated.
        if (
          translated === english &&
          !(locale === 'fr' && domain === 'navigation' && key === 'destinations')
        )
          throw new Error('Untranslated English placeholder: ' + domain + '.' + key);
        validatePluralCategories(translated, locale);
      }
    }
  }
}
