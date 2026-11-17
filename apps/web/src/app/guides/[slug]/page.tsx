import Link from '@/components/localized-link';
import { LinkedMessage, MESSAGE_LINKS } from '@/components/linked-message';
import { notFound } from 'next/navigation';
import { guides } from '@/lib/guides';
import { localizedGuides } from '@/lib/localized-guides';
import { serverTranslations } from '@/lib/server-translations';
import { localePath } from '@alozuri/shared/i18n';
import { breadcrumbs, jsonLd } from '@/lib/seo';
import { localizedMetadata as publicMetadata } from '@/lib/localized-metadata';
export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { locale, t } = await serverTranslations();
  const guide = (await localizedGuides(locale)).find((g) => g.slug === slug);
  return guide
    ? publicMetadata(guide.title, guide.description, '/guides/' + guide.slug)
    : { title: t('guideUi.notFound'), robots: { index: false } };
}
export default async function Guide({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { locale, t } = await serverTranslations();
  const guide = (await localizedGuides(locale)).find((g) => g.slug === slug);
  if (!guide) notFound();
  return (
    <article className="container section travel-guide">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbs(guide.title, localePath('/guides/' + guide.slug, locale))),
        }}
      />
      <Link href="/guides">
        <span aria-hidden="true">{locale === 'ar' ? '→' : '←'} </span>
        {t('guideUi.all')}
      </Link>
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
        <LinkedMessage
          message={t('guideUi.policy', {
            refunds: MESSAGE_LINKS.refunds,
            support: MESSAGE_LINKS.support,
          })}
          links={{
            refunds: { href: '/refund-policy', label: t('legal.refunds') },
            support: { href: '/contact', label: t('helpUi.contact') },
          }}
        />
      </p>
    </article>
  );
}
