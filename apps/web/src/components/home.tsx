'use client';
import { useLocale, useTranslations } from 'next-intl';
import { placeName } from '@alozuri/shared/i18n/places';
import { destinationName } from '@alozuri/shared/i18n/destinations';
import { localeDirection } from '@alozuri/shared/i18n';
import Link from '@/components/localized-link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Globe2,
  MapPin,
  QrCode,
  ShieldCheck,
  Signal,
  Smartphone,
} from 'lucide-react';
import { Planner } from './planner';
import { SeasonalDestinations } from './seasonal-destinations';
import { seasonalInspiration } from '@alozuri/shared/destination-inspiration';
export function Home({
  featuredBundles,
  initialInspiration,
}: {
  featuredBundles?: React.ReactNode;
  initialInspiration: ReturnType<typeof seasonalInspiration>;
}) {
  const t = useTranslations('home');
  const site = useTranslations('site');
  const locale = useLocale();
  const dir = localeDirection(locale);
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-grid" dir="ltr">
            <div className="hero-copy" dir={dir}>
              <h1>
                {t('heroTitleA')}
                <br />
                <span dir={dir}>{t('heroTitleB')}</span>
              </h1>
              <div className="hero-benefits">
                <span dir={dir}>{t('instant')}</span>
                <span dir={dir}>{t('noRoaming')}</span>
              </div>
            </div>
            <div className="journey-card">
              <div className="journey-card-top" dir="ltr">
                <span>
                  <Globe2 size={17} />
                  {t('tripConnected')}
                </span>
                <span className="small-badge">{t('oneEsim')}</span>
              </div>
              <div className="journey-stops" dir="ltr">
                <div>
                  <span className="journey-flag">🇫🇷</span>
                  <strong dir={dir}>{destinationName('FR', locale)}</strong>
                  <span dir={dir}>{placeName('paris', locale)}</span>
                </div>
                <span className="journey-line" />
                <div>
                  <span className="journey-flag">🇨🇭</span>
                  <strong dir={dir}>{destinationName('CH', locale)}</strong>
                  <span dir={dir}>{placeName('zurich', locale)}</span>
                </div>
                <span className="journey-line" />
                <div>
                  <span className="journey-flag">🇮🇹</span>
                  <strong dir={dir}>{destinationName('IT', locale)}</strong>
                  <span dir={dir}>{placeName('rome', locale)}</span>
                </div>
              </div>
              <div className="journey-confirmation" dir="ltr">
                <ShieldCheck size={18} />
                <span dir={dir}>{t('coversAll')}</span>
                <Check size={17} />
              </div>
            </div>
          </div>
          <Planner initialCountries={['FR', 'CH', 'IT']} simplified />
        </div>
      </section>
      <section className="promise-strip">
        <div className="container" dir="ltr">
          <span dir={dir}>
            <Globe2 />
            {t('onePlan')}
          </span>
          <span>
            <Smartphone />
            {t('noSim')}
          </span>
          <span>
            <ShieldCheck />
            {process.env.NEXT_PUBLIC_DEMO_MODE === 'false' &&
            process.env.NEXT_PUBLIC_PAYMENT_MODE === 'live'
              ? t('secure')
              : t('compare')}
          </span>
          <span className="desktop-data-promise">
            <Signal />
            {t('dataNoDetours')}
          </span>
          <span className="mobile-number-benefit">
            <Check />
            {t('keepNumber')}
          </span>
        </div>
      </section>
      {featuredBundles}
      <section className="section container destinations-section">
        <div className="section-heading" dir="ltr">
          <div dir={dir}>
            <span className="eyebrow">{t('destinationsEyebrow')}</span>
            <h2>{t('destinationsTitle')}</h2>
            <p>{t('destinationsDescription')}</p>
          </div>
          <Link href="/destinations" className="text-link">
            {site('allDestinations')} <ArrowUpRight size={18} />
          </Link>
        </div>
        <SeasonalDestinations initial={initialInspiration} />
        <div className="europe-banner" dir="ltr">
          <span className="europe-icon">
            <MapPin size={25} />
          </span>
          <div dir={dir}>
            <h3>{t('europeTitle')}</h3>
            <p>{t('europeDescription')}</p>
          </div>
          <a href="#planner" className="text-link">
            {t('matchItinerary')} <ArrowRight size={18} />
          </a>
        </div>
      </section>
      <section className="how-section" id="how-it-works">
        <div className="container">
          <div className="section-heading" dir="ltr">
            <div dir={dir}>
              <span className="eyebrow">{t('stepsEyebrow')}</span>
              <h2>{t('stepsTitle')}</h2>
            </div>
            <Link href="/help#compatibility" className="text-link">
              {t('checkDevice')} <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="steps-grid" dir="ltr">
            {[
              {
                n: '01',
                icon: <Globe2 />,
                title: t('stepChooseTitle'),
                text: t('stepChooseText'),
              },
              {
                n: '02',
                icon: <QrCode />,
                title: t('stepInstallTitle'),
                text: t('stepInstallText'),
              },
              {
                n: '03',
                icon: <Signal />,
                title: t('stepConnectTitle'),
                text: t('stepConnectText'),
              },
            ].map((s) => (
              <div className="step" key={s.n} dir={dir}>
                <div className="step-header" dir="ltr">
                  <span className="step-icon">{s.icon}</span>
                  <span className="step-number">{s.n}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section container faq-section" dir="ltr">
        <div dir={dir}>
          <span className="eyebrow">{t('faqEyebrow')}</span>
          <h2>{t('faqTitle')}</h2>
          <p>{t('faqIntro')}</p>
          <Link href="/help" className="text-link">
            {t('faqLink')} <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="faq-list" dir={dir}>
          {[
            {
              q: t('faqCoverageQuestion'),
              a: t('faqCoverageAnswer'),
            },
            {
              q: t('faqPhoneQuestion'),
              a: t('faqPhoneAnswer'),
            },
            {
              q: t('faqNumberQuestion'),
              a: t('faqNumberAnswer'),
            },
            {
              q: t('faqStartQuestion'),
              a: t('faqStartAnswer'),
            },
          ].map((f, index) => (
            <details key={index}>
              <summary>
                {f.q}
                <ChevronDown size={18} />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="last-call">
        <div className="container" dir="ltr">
          <div dir={dir}>
            <span className="eyebrow">{t('finalEyebrow')}</span>
            <h2>{t('finalTitle')}</h2>
            <p>{t('finalText')}</p>
          </div>
          <a href="#planner" className="button primary">
            {t('findEsim')} <ArrowRight size={18} />
          </a>
        </div>
      </section>
    </>
  );
}
