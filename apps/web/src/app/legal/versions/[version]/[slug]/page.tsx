import { notFound } from 'next/navigation';
import { POLICY_VERSIONS } from '@voyaspan/shared/policies';
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
  return <LegalDocument policy={policy} version={version} />;
}
export function generateStaticParams() {
  return Object.entries(POLICY_VERSIONS).flatMap(([version, policies]) =>
    Object.keys(policies).map((slug) => ({ version, slug })),
  );
}
