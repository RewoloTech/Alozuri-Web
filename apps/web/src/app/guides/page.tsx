import Link from 'next/link';
import { guides } from '@/lib/guides';
import { publicMetadata, breadcrumbs, jsonLd } from '@/lib/seo';
export const metadata = publicMetadata(
  'Travel eSIM guides',
  'Practical guides to choosing travel eSIM data, budgeting for your trip, checking compatibility and installing safely.',
  '/guides',
);
export default function Guides() {
  return (
    <section className="container section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs('Travel eSIM guides', '/guides')) }}
      />
      <div className="page-intro">
        <h1>Travel eSIM guides</h1>
        <p>
          Make a practical data plan for your trip. Start with the countries, your exact device and
          the activation rule of the package you choose.
        </p>
      </div>
      <div className="steps-grid">
        {guides.map((guide) => (
          <article className="surface" key={guide.slug}>
            <h2>
              <Link href={'/guides/' + guide.slug}>{guide.title}</Link>
            </h2>
            <p>{guide.description}</p>
          </article>
        ))}
      </div>
      <p>
        Ready to compare? Browse <Link href="/destinations/us">USA</Link>,{' '}
        <Link href="/destinations/gb">UK</Link>, <Link href="/destinations/europe">Europe</Link>,{' '}
        <Link href="/destinations/jp">Japan</Link> and <Link href="/destinations/th">Thailand</Link>{' '}
        travel plans.
      </p>
    </section>
  );
}
