import { LegalDocument } from '@/components/legal-document';
import { POLICIES } from '@alozuri/shared/policies';
import { breadcrumbs, jsonLd } from '@/lib/seo';
import { localizedMetadata as publicMetadata } from '@/lib/localized-metadata';
const policy = POLICIES['refunds'];
export async function generateMetadata() {
  return await publicMetadata(policy.title, policy.description, policy.path);
}
export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(policy.title, policy.path)) }}
      />
      <LegalDocument policy={policy} />
    </>
  );
}
