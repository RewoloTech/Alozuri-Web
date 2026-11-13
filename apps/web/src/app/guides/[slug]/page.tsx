import Link from 'next/link';
import { notFound } from 'next/navigation';
import { guides } from '@/lib/guides';
import { publicMetadata, breadcrumbs, jsonLd } from '@/lib/seo';
export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params,
    guide = guides.find((g) => g.slug === slug);
  return guide
    ? publicMetadata(guide.title, guide.description, '/guides/' + guide.slug)
    : { title: 'Guide not found', robots: { index: false } };
}
export default async function Guide({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params,
    guide = guides.find((g) => g.slug === slug);
  if (!guide) notFound();
  return (
    <article className="container section travel-guide">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbs(guide.title, '/guides/' + guide.slug)),
        }}
      />
      <Link href="/guides">← All travel guides</Link>
      <div className="page-intro">
        <h1>{guide.title}</h1>
        <p>{guide.description}</p>
      </div>
      {guide.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
      <p>
        <Link className="button primary" href={guide.destination}>
          {guide.destinationLabel}
        </Link>
      </p>
      <p>
        Read the <Link href="/refund-policy">refund and cancellation policy</Link> before
        installation. For help with an order, <Link href="/contact">contact Alozuri support</Link>.
      </p>
    </article>
  );
}
