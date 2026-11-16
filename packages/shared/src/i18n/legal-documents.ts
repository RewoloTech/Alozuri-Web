import { LEGAL_VERSION } from '../legal.ts';
import { POLICY_VERSIONS, policyText } from '../policies.ts';
import { LocaleUnavailableError, type Locale } from './locales.ts';

/** Reuses the versioned English master. Never substitutes it for a missing translation. */
export function legalDocuments(locale: Locale, version: string = LEGAL_VERSION) {
  if (locale !== 'en') throw new LocaleUnavailableError();
  const policies = Object.entries(POLICY_VERSIONS).find(([key]) => key === version)?.[1];
  if (!policies) throw new LocaleUnavailableError();
  return Object.values(policies).map((policy) => ({
    locale,
    version,
    slug: policy.slug,
    title: policy.title,
    path: policy.path,
    text: policyText(policy, version),
  }));
}
