import { policies as policies0 } from './2026-11-16.1/es.ts';
import { policies as policies1 } from './2026-11-16.1/de.ts';
import { policies as policies2 } from './2026-11-16.1/fr.ts';
import { policies as policies3 } from './2026-11-16.1/it.ts';
import { policies as policies4 } from './2026-11-16.1/pt-BR.ts';
import { policies as policies5 } from './2026-11-16.1/ro.ts';
import { policies as policies6 } from './2026-11-16.1/ja.ts';
import { policies as policies7 } from './2026-11-16.1/ko.ts';
import { policies as policies8 } from './2026-11-16.1/zh-Hans.ts';
import { policies as policies9 } from './2026-11-16.1/ar.ts';
import { policies as policies10 } from './2026-11-16.1/nl.ts';
import { policies as policies11 } from './2026-11-16.1/pl.ts';
import { POLICY_VERSIONS, type Policy } from '../../policies.ts';
import { LEGAL_VERSION } from '../../legal.ts';
import { LocaleUnavailableError, type Locale } from '../locales.ts';
export type PolicyCatalogue = Readonly<Record<string, readonly string[]>>;
/** Translation availability is explicit. Missing versions never fall back to English. */
const translationVersions: Record<string, Partial<Record<Locale, PolicyCatalogue>>> = {
  '2026-11-16.1': {
    es: policies0,
    de: policies1,
    fr: policies2,
    it: policies3,
    'pt-BR': policies4,
    ro: policies5,
    ja: policies6,
    ko: policies7,
    'zh-Hans': policies8,
    ar: policies9,
    nl: policies10,
    pl: policies11,
  },
};
function materialize(master: Policy, copy: readonly string[]): Policy {
  let cursor = 0;
  const take = () => {
    const value = copy[cursor++];
    if (typeof value !== 'string' || !value.trim()) throw new LocaleUnavailableError();
    return value;
  };
  const title = take(),
    description = take();
  const sections = master.sections.map((section) => ({
    title: take(),
    paragraphs: section.paragraphs.map(take),
    ...(section.steps ? { steps: section.steps.map(take) } : {}),
    ...(section.table
      ? {
          table: {
            caption: take(),
            headings: section.table.headings.map(take),
            rows: section.table.rows.map((row) => row.map(take)),
          },
        }
      : {}),
    ...(section.links ? { links: section.links.map((link) => ({ ...link, label: take() })) } : {}),
  }));
  if (cursor !== copy.length) throw new LocaleUnavailableError();
  return { ...master, title, description, sections };
}
export function localizedPolicies(
  locale: Locale,
  version: string = LEGAL_VERSION,
): Record<string, Policy> {
  if (locale === 'en') {
    if (!Object.hasOwn(POLICY_VERSIONS, version)) throw new LocaleUnavailableError();
    return POLICY_VERSIONS[version];
  }
  const translated = Object.hasOwn(translationVersions, version)
    ? translationVersions[version][locale]
    : undefined;
  if (!translated || !Object.hasOwn(POLICY_VERSIONS, version)) throw new LocaleUnavailableError();
  return Object.fromEntries(
    Object.entries(POLICY_VERSIONS[version]).map(([slug, master]) => {
      const copy = translated[slug];
      if (!copy) throw new LocaleUnavailableError();
      return [slug, materialize(master, copy)];
    }),
  );
}

/** Translation availability is distinct from professional legal approval; none is claimed. */
export const POLICY_TRANSLATION_REVIEW = {
  sourceVersion: '2026-11-16.1',
  professionalReviewCompleted: false,
  reviewRequired: ['es', 'de', 'fr', 'it', 'pt-BR', 'ro', 'ja', 'ko', 'zh-Hans', 'ar', 'nl', 'pl'],
} as const;

export const POLICY_TRANSLATION_SOURCE_DIGESTS = {
  '2026-11-16.1': '0ce7cfea518f84c4c18ef879ebe20444782ba10ccbec6e7271640244a67cfa17',
} as const;
