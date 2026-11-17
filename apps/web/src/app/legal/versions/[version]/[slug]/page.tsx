import { notFound } from 'next/navigation';
import { POLICY_VERSIONS } from '@alozuri/shared/policies';
import { BUSINESS, LEGAL_VERSION } from '@alozuri/shared/legal';
import { localizedPolicies } from '@alozuri/shared/i18n/legal-documents';
import { LocaleUnavailableError } from '@alozuri/shared/i18n';
import Link from '@/components/localized-link';
import { LinkedMessage, MESSAGE_LINKS } from '@/components/linked-message';
import { LegalDocument } from '@/components/legal-document';
import { serverTranslations, privateMetadata } from '@/lib/server-translations';
export async function generateMetadata() {
  return { ...(await privateMetadata('legalUi.archived')), robots: { index: false, follow: true } };
}
export default async function Page({
  params,
}: {
  params: Promise<{ version: string; slug: string }>;
}) {
  const { version, slug } = await params;
  const policy =
    Object.hasOwn(POLICY_VERSIONS, version) && Object.hasOwn(POLICY_VERSIONS[version], slug)
      ? POLICY_VERSIONS[version][slug]
      : undefined;
  if (!policy) notFound();
  const { locale, t } = await serverTranslations();
  if (version === LEGAL_VERSION) return <LegalDocument policy={policy} version={version} />;
  // Historical contracts remain in the language and exact text accepted at purchase.
  let currentTitle = policy.title;
  if (locale !== 'en') {
    try {
      currentTitle = localizedPolicies(locale)[slug].title;
    } catch (error) {
      if (!(error instanceof LocaleUnavailableError)) throw error;
      currentTitle = t('legalUi.archived');
    }
  }
  return (
    <article className="container section policy-page">
      <header className="page-intro">
        <h1>{t('legalUi.previous', { title: currentTitle })}</h1>
        <p>{t('legalUi.version', { version })}</p>
      </header>
      <p>
        <LinkedMessage
          message={t('legalUi.request', { support: MESSAGE_LINKS.support })}
          links={{ support: { href: 'mailto:' + BUSINESS.email, label: BUSINESS.email } }}
        />
      </p>
      {(slug === 'terms' || slug === 'refunds') && <p>{t('legalUi.orderCopies')}</p>}
      <p>{t('legalUi.unchanged')}</p>
      <Link href={policy.path}>{t('legalUi.current', { title: currentTitle })}</Link>
    </article>
  );
}
export function generateStaticParams() {
  return Object.entries(POLICY_VERSIONS).flatMap(([version, policies]) =>
    Object.keys(policies).map((slug) => ({ version, slug })),
  );
}
