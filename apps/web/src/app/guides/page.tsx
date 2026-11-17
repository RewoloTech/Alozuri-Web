import Link from '@/components/localized-link';
import { LinkedMessage, MESSAGE_LINKS } from '@/components/linked-message';
import { localizedGuides } from '@/lib/localized-guides';
import { serverTranslations } from '@/lib/server-translations';
import { destinationName } from '@alozuri/shared/i18n/destinations';
import { breadcrumbs, jsonLd } from '@/lib/seo';
import { localePath } from '@alozuri/shared/i18n';
import { localizedMetadata as publicMetadata } from '@/lib/localized-metadata';
export async function generateMetadata() {
  const { t } = await serverTranslations();
  return publicMetadata(t('guideUi.title'), t('guideUi.description'), '/guides');
}
export default async function Guides() {
  const { locale, t, dir } = await serverTranslations();
  const guides = await localizedGuides(locale);
  return (
    <section className="container section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbs(t('guideUi.title'), localePath('/guides', locale))),
        }}
      />
      <div className="page-intro">
        <h1>{t('guideUi.title')}</h1>
        <p>{t('guideUi.intro')}</p>
      </div>
      <div className="steps-grid" dir="ltr">
        {guides.map((guide) => (
          <article className="surface" key={guide.slug} dir={dir}>
            <h2>
              <Link href={'/guides/' + guide.slug}>{guide.title}</Link>
            </h2>
            <p>{guide.description}</p>
          </article>
        ))}
      </div>
      <p>
        <LinkedMessage
          message={t('guideUi.compare', {
            us: MESSAGE_LINKS.us,
            gb: MESSAGE_LINKS.gb,
            europe: MESSAGE_LINKS.europe,
            jp: MESSAGE_LINKS.jp,
            th: MESSAGE_LINKS.th,
          })}
          links={{
            us: { href: '/destinations/us', label: destinationName('US', locale) },
            gb: { href: '/destinations/gb', label: destinationName('GB', locale) },
            europe: { href: '/destinations/europe', label: t('display.europe') },
            jp: { href: '/destinations/jp', label: destinationName('JP', locale) },
            th: { href: '/destinations/th', label: destinationName('TH', locale) },
          }}
        />
      </p>
    </section>
  );
}
