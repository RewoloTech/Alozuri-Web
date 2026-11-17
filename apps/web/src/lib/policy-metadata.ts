import { localizedPolicies } from '@alozuri/shared/i18n/legal-documents';
import { LocaleUnavailableError } from '@alozuri/shared/i18n';
import { POLICIES } from '@alozuri/shared/policies';
import { serverTranslations } from './server-translations';
import { localizedMetadata } from './localized-metadata';
const fallbackTitles = {
  terms: 'legal.terms',
  privacy: 'legal.privacy',
  cookies: 'legal.cookies',
  refunds: 'legal.refunds',
  compatibility: 'site.compatibility',
  'acceptable-use': 'site.acceptableUse',
  contact: 'site.contact',
} as const;
export async function policyMetadata(slug: keyof typeof fallbackTitles) {
  const { locale, t } = await serverTranslations();
  try {
    const policy = localizedPolicies(locale)[slug];
    return localizedMetadata(policy.title, policy.description, policy.path);
  } catch (error) {
    if (!(error instanceof LocaleUnavailableError)) throw error;
    return {
      ...(await localizedMetadata(
        t(fallbackTitles[slug]),
        t('checkout.legalUnavailable'),
        POLICIES[slug].path,
      )),
      robots: { index: false, follow: true },
    };
  }
}
