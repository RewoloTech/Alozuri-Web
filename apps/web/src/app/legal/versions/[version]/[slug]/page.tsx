import { notFound } from 'next/navigation';
import { POLICY_VERSIONS } from '@alozuri/shared/policies';
import { BUSINESS, LEGAL_VERSION } from '@alozuri/shared/legal';
import Link from 'next/link';
import { LegalDocument } from '@/components/legal-document';
export const metadata = {
  title: 'Archived policy version',
  robots: { index: false, follow: true },
};
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
  if (version !== LEGAL_VERSION)
    return (
      <article className="container section policy-page">
        <header className="page-intro">
          <h1>Previous {policy.title}</h1>
          <p>Version {version}</p>
        </header>
        <p>
          To request a copy of this policy version, contact{' '}
          <a href={'mailto:' + BUSINESS.email}>{BUSINESS.email}</a>.
        </p>
        {(slug === 'terms' || slug === 'refunds') && (
          <p>
            Your purchase terms remain available in your order confirmation and the downloadable
            documents on your private order page.
          </p>
        )}
        <p>This update does not change the terms already attached to your purchase.</p>
        <Link href={policy.path}>Read the current {policy.title}</Link>
      </article>
    );
  return <LegalDocument policy={policy} version={version} />;
}
export function generateStaticParams() {
  return Object.entries(POLICY_VERSIONS).flatMap(([version, policies]) =>
    Object.keys(policies).map((slug) => ({ version, slug })),
  );
}
