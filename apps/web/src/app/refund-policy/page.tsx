import { LegalDocument } from '@/components/legal-document';
import { POLICIES } from '@voyaspan/shared/policies';
import { publicMetadata, breadcrumbs, jsonLd } from '@/lib/seo';
const policy = POLICIES['refunds'];
export const metadata = publicMetadata(policy.title, policy.description, policy.path);
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
