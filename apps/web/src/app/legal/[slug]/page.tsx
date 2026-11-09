import { notFound } from 'next/navigation';
const drafts: Record<string, { title: string; body: string[] }> = {
  privacy: {
    title: 'Privacy policy',
    body: [
      'VoyaSpan’s draft service uses Firebase Authentication for account access. The planned order service will retain customer and order records on the server. Payment details will be handled by Stripe, not stored by VoyaSpan.',
      'Google Analytics is not initialized in this draft. Retention periods, data rights contacts, international transfers and the legal entity must be confirmed before launch.',
    ],
  },
  terms: {
    title: 'Terms of service',
    body: [
      'VoyaSpan is an intended reseller of travel eSIM data plans. Sample plans shown in this preview are illustrative and cannot be purchased.',
      'Final terms must identify the selling entity and address, describe availability and device requirements, payment and taxes, activation rules, complaints, statutory rights and governing law.',
    ],
  },
  refunds: {
    title: 'Refund policy',
    body: [
      'Purchases are disabled in this preview. No payment is collected.',
      'The final policy must account for applicable consumer rights and supplier restrictions. Refund requests for issued or activated eSIMs require review; an unconditional refund is not promised. A request channel and response times must be confirmed before launch.',
    ],
  },
};
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return {
    title: Object.hasOwn(drafts, slug) ? drafts[slug].title : 'Not found',
    robots: { index: false },
  };
}
export default async function Legal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const draft = Object.hasOwn(drafts, slug) ? drafts[slug] : undefined;
  if (!draft) notFound();
  return (
    <section className="container section legal-page">
      <div className="page-intro">
        <span className="eyebrow">LEGAL DRAFT</span>
        <h1>{draft.title}</h1>
      </div>
      <div className="notice">
        Draft for legal review. This is not the final policy and must be completed before accepting
        purchases.
      </div>
      {draft.body.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </section>
  );
}

export function generateStaticParams() {
  return Object.keys(drafts).map((slug) => ({ slug }));
}
