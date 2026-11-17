import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { englishMessages, type Messages } from './messages.ts';
import type { Locale } from './locales.ts';

// Identical native words, not fallbacks: these geographical names have the
// same spelling in the listed languages. "Total" is also the native monetary
// label in Spanish, French, Portuguese and Romanian. Keep entries field-scoped.
const IDENTICAL_NATIVE_WORDS: Partial<Record<Locale, readonly string[]>> = {
  fr: ['navigation.destinations', 'display.europe', 'cart.total'],
  es: ['display.asia', 'cart.total', 'orderUi.total'],
  it: ['display.asia'],
  ro: ['display.asia', 'cart.total'],
  'pt-BR': ['cart.total', 'orderUi.total'],
  // Standard Indonesian financial words, preposition and geographic names.
  id: [
    'orderUi.unitStatus',
    'orderUi.total',
    'cart.total',
    'cart.unitPrice',
    'display.asia',
    'display.global',
  ],
};

function validatePluralCategories(message: string, locale: Locale) {
  const visit = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (
        element.type === TYPE.plural &&
        element.pluralType !== 'ordinal' &&
        ['ar', 'pl', 'ru', 'uk'].includes(locale)
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
        // Direction controls cannot disguise an untranslated placeholder.
        const plain = translated.replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, '');
        if (plain === english && !IDENTICAL_NATIVE_WORDS[locale]?.includes(domain + '.' + key))
          throw new Error('Untranslated English placeholder: ' + domain + '.' + key);
        validatePluralCategories(translated, locale);
      }
    }
  }
}
