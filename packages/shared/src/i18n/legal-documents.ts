import { createTranslator } from 'use-intl/core';
import { BUSINESS, LEGAL_VERSION, LEGAL_EFFECTIVE_DATE } from '../legal.ts';
import { policyText, type Policy } from '../policies.ts';
import { localePath, type Locale } from './locales.ts';
import { localizedPolicies } from './policies/catalogs.ts';
import { staticMessages } from './static-catalogs.ts';
export { localizedPolicies } from './policies/catalogs.ts';
export function localizedPolicyText(
  policy: Policy,
  locale: Locale,
  version: string = LEGAL_VERSION,
): string {
  if (locale === 'en') return policyText(policy, version);
  const t = createTranslator({ locale, messages: staticMessages(locale) });
  const isolate = (s: string) => (locale === 'ar' ? '\u2066' + s + '\u2069' : s);
  const identity = t('site.company', {
    brand: isolate(BUSINESS.brand),
    company: isolate(BUSINESS.company),
    number: isolate(BUSINESS.number),
  });
  const header = t('legalUi.documentHeader', {
    version: isolate(version),
    date: isolate(version === LEGAL_VERSION ? LEGAL_EFFECTIVE_DATE : version.slice(0, 10)),
  });
  return (
    `${policy.title}\n${header}\n${identity}\n${isolate(BUSINESS.address)}\n${isolate(BUSINESS.email)}\n\n` +
    policy.sections
      .map((s, i) => {
        const steps = s.steps?.map((step, index) => `${index + 1}. ${step}`).join('\n');
        const table =
          s.table &&
          [
            s.table.caption,
            s.table.headings.join(' | '),
            ...s.table.rows.map((row) => row.join(' | ')),
          ].join('\n');
        const links = s.links
          ?.map(
            (link) =>
              `${link.label}: ${isolate(link.href.startsWith('/') ? BUSINESS.site + localePath(link.href, locale) : link.href)}`,
          )
          .join('\n');
        return `${i + 1}. ${s.title}\n${[s.paragraphs.join('\n\n'), steps, table, links].filter(Boolean).join('\n\n')}`;
      })
      .join('\n\n')
  );
}
/** Versioned text only: never substitutes an English policy for a missing translation. */
export function legalDocuments(locale: Locale, version: string = LEGAL_VERSION) {
  return Object.values(localizedPolicies(locale, version)).map((policy) => ({
    locale,
    version,
    slug: policy.slug,
    title: policy.title,
    path: policy.path,
    text: localizedPolicyText(policy, locale, version),
  }));
}
