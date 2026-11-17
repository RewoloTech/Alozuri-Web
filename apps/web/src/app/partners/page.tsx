import { ArrowUpRight, ChartNoAxesCombined, ChevronDown, Clock3, Percent } from 'lucide-react';
import { localizedMetadata as publicMetadata } from '@/lib/localized-metadata';
import { serverTranslations } from '@/lib/server-translations';
import styles from './partners.module.css';
const applicationUrl = 'https://alozuricom-1c30.endorsely.com';
export async function generateMetadata() {
  const { t } = await serverTranslations();
  return {
    ...(await publicMetadata(
      t('partnersUi.metaTitle'),
      t('partnersUi.metaDescription'),
      '/partners',
    )),
    title: { absolute: t('partnersUi.metaTitle') },
  };
}
async function ApplicationLink({ children }: { children: React.ReactNode }) {
  const { t } = await serverTranslations();
  return (
    <a className="button primary" href={applicationUrl} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={18} aria-hidden="true" />
      <span className={styles.visuallyHidden}> ({t('partnersUi.newTab')})</span>
    </a>
  );
}
export default async function PartnersPage() {
  const { t, dir } = await serverTranslations();
  const benefits = [
    { icon: Percent, title: t('partnersUi.commissionTitle'), text: t('partnersUi.commission') },
    { icon: Clock3, title: t('partnersUi.trackingTitle'), text: t('partnersUi.tracking') },
    {
      icon: ChartNoAxesCombined,
      title: t('partnersUi.dashboardTitle'),
      text: t('partnersUi.dashboard'),
    },
  ];
  const steps = [
    [t('partnersUi.applyStep'), t('partnersUi.applyText')],
    [t('partnersUi.shareStep'), t('partnersUi.shareText')],
    [t('partnersUi.earnStep'), t('partnersUi.earnText')],
  ];
  const audience = [
    t('partnersUi.youtube'),
    t('partnersUi.creators'),
    t('partnersUi.blogs'),
    t('partnersUi.agencies'),
    t('partnersUi.communities'),
  ];
  const terms = [
    t('partnersUi.termCommission'),
    t('partnersUi.termWindow'),
    t('partnersUi.termAttribution'),
    t('partnersUi.termPending'),
    t('partnersUi.termMinimum'),
    t('partnersUi.termPaid'),
    t('partnersUi.termExcluded'),
  ];
  const questions = [
    [t('partnersUi.q1'), t('partnersUi.a1')],
    [t('partnersUi.q2'), t('partnersUi.a2')],
    [t('partnersUi.q3'), t('partnersUi.a3')],
    [t('partnersUi.q4'), t('partnersUi.a4')],
    [t('partnersUi.q5'), t('partnersUi.a5')],
    [t('partnersUi.q6'), t('partnersUi.a6')],
  ];
  return (
    <div className={styles.page}>
      <section className={`container ${styles.hero}`} aria-labelledby="partners-title">
        <span className="eyebrow">{t('partnersUi.eyebrow')}</span>
        <h1 id="partners-title">{t('partnersUi.title')}</h1>
        <p>{t('partnersUi.intro')}</p>
        <ApplicationLink>{t('partnersUi.apply')}</ApplicationLink>
        <small>{t('partnersUi.free')}</small>
      </section>
      <section className={`container ${styles.section}`} aria-labelledby="benefits-title">
        <h2 id="benefits-title">{t('partnersUi.benefitsTitle')}</h2>
        <div className={styles.grid} dir="ltr">
          {benefits.map(({ icon: Icon, title, text }) => (
            <article className={styles.card} key={title} dir={dir}>
              <Icon className={styles.icon} size={24} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className={styles.band} aria-labelledby="steps-title">
        <div className={`container ${styles.section}`}>
          <h2 id="steps-title">{t('navigation.howItWorks')}</h2>
          <ol className={`${styles.grid} ${styles.steps}`} dir="ltr">
            {steps.map(([title, text], index) => (
              <li key={title} dir={dir}>
                <span className={styles.number} aria-hidden="true">
                  <bdi dir="ltr">{String(index + 1).padStart(2, '0')}</bdi>
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section
        className={`container ${styles.section} ${styles.split}`}
        aria-labelledby="audience-title"
        dir="ltr"
      >
        <div dir={dir}>
          <h2 id="audience-title">{t('partnersUi.audienceTitle')}</h2>
          <p>{t('partnersUi.audienceIntro')}</p>
        </div>
        <ul className={styles.audience} dir={dir}>
          {audience.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </section>
      <section className={styles.band} aria-labelledby="payments-title">
        <div className={`container ${styles.section} ${styles.split}`} dir="ltr">
          <div dir={dir}>
            <span className="eyebrow">{t('partnersUi.termsEyebrow')}</span>
            <h2 id="payments-title">{t('partnersUi.paymentsTitle')}</h2>
            <p>{t('partnersUi.paymentsIntro')}</p>
          </div>
          <ul className={styles.terms} dir={dir}>
            {terms.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
        </div>
      </section>
      <section
        className={`container ${styles.section} ${styles.split}`}
        aria-labelledby="faq-title"
        dir="ltr"
      >
        <div dir={dir}>
          <h2 id="faq-title">{t('regionUi.questions')}</h2>
          <p>{t('partnersUi.faqIntro')}</p>
        </div>
        <div className="faq-list" dir={dir}>
          {questions.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className={`container ${styles.final}`} aria-labelledby="join-title">
        <h2 id="join-title">{t('partnersUi.finalTitle')}</h2>
        <p>{t('partnersUi.finalText')}</p>
        <ApplicationLink>{t('partnersUi.finalApply')}</ApplicationLink>
      </section>
    </div>
  );
}
