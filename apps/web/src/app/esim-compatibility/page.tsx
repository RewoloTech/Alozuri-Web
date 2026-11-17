import { LegalDocument } from '@/components/legal-document';
import { POLICIES } from '@alozuri/shared/policies';
import { breadcrumbs, jsonLd } from '@/lib/seo';
import { policyMetadata } from '@/lib/policy-metadata';
const policy = POLICIES['compatibility'];
export async function generateMetadata() {
  return policyMetadata('compatibility');
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
