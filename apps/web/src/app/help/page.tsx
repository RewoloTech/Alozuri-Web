import { serverTranslations } from '@/lib/server-translations';
import { LinkedMessage, MESSAGE_LINKS } from '@/components/linked-message';
import { localizedMetadata as publicMetadata } from '@/lib/localized-metadata';
import Link from '@/components/localized-link';
import { BUSINESS } from '@alozuri/shared/legal';
export async function generateMetadata() {
  const { t } = await serverTranslations();
  return publicMetadata(t('seoUi.helpTitle'), t('seoUi.helpDescription'), '/help');
}
export default async function Help() {
  const { t, dir } = await serverTranslations();
  return (
    <section className="container section help-page">
      <div className="page-intro">
        <span className="eyebrow">{t('helpUi.eyebrow')}</span>
        <h1>{t('helpUi.title')}</h1>
        <p>{t('helpUi.intro')}</p>
      </div>
      <div className="surface" id="compatibility">
        <h2>{t('home.faqPhoneQuestion')}</h2>
        <p>{t('helpUi.compatibility')}</p>
        <p>{t('helpUi.unlock')}</p>
      </div>
      <div className="steps-grid" dir="ltr">
        <div className="surface" dir={dir}>
          <h2>{t('helpUi.beforeTitle')}</h2>
          <p>{t('helpUi.before')}</p>
        </div>
        <div className="surface" dir={dir}>
          <h2>{t('helpUi.addTitle')}</h2>
          <p>{t('helpUi.add')}</p>
          <p>{t('helpUi.private')}</p>
        </div>
        <div className="surface" dir={dir}>
          <h2>{t('helpUi.arrivalTitle')}</h2>
          <p>{t('helpUi.arrival')}</p>
        </div>
      </div>
      <div className="surface" dir={dir}>
        <h2>{t('helpUi.connectionTitle')}</h2>
        <p>{t('helpUi.connection')}</p>
        <p>{t('helpUi.readings')}</p>
      </div>
      <p>
        <LinkedMessage
          message={t('helpUi.moreGuides', {
            guides: MESSAGE_LINKS.guides,
            budget: MESSAGE_LINKS.budget,
          })}
          links={{
            guides: { href: '/guides', label: t('helpUi.guideLabel') },
            budget: { href: '/guides/holiday-data-budget', label: t('helpUi.budgetLabel') },
          }}
        />
      </p>
      <div className="notice">
        <strong>{t('helpUi.needHelp')}</strong>{' '}
        <LinkedMessage
          message={t('helpUi.supportIntro', { support: MESSAGE_LINKS.support })}
          links={{ support: { href: 'mailto:' + BUSINESS.email, label: BUSINESS.email } }}
        />{' '}
        <Link className="text-link" href="/contact">
          {t('helpUi.contact')}
        </Link>
      </div>
    </section>
  );
}
