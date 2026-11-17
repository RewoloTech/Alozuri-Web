'use client';
import Link from '@/components/localized-link';
import { useTranslations, useLocale } from 'next-intl';
import { localeDirection } from '@alozuri/shared/i18n';
import { ArrowUpRight } from 'lucide-react';
import { BUSINESS } from '@alozuri/shared/legal';
import { POLICIES } from '@alozuri/shared/policies';
import { CookieSettingsButton } from './privacy-provider';
import { Brand } from './header';
export function Footer() {
  const t = useTranslations('site');
  const legal = useTranslations('legal');
  const navigation = useTranslations('navigation');
  const locale = useLocale();
  const direction = localeDirection(locale);
  const isolate = (value: string) => (locale === 'ar' ? '\u2066' + value + '\u2069' : value);
  const policies = [
    { slug: 'terms', title: legal('terms') },
    { slug: 'privacy', title: legal('privacy') },
    { slug: 'cookies', title: legal('cookies') },
    { slug: 'refunds', title: legal('refunds') },
    { slug: 'acceptable-use', title: t('acceptableUse') },
  ];
  return (
    <footer className="site-footer">
      <div className="container footer-main" dir="ltr">
        <div>
          <Brand />
          <p dir={direction}>
            {t('sloganA')}
            <br /> {t('sloganB')}
          </p>
        </div>
        <nav
          className="footer-links footer-explore"
          aria-labelledby="footer-explore"
          dir={direction}
        >
          <h2 className="eyebrow" id="footer-explore">
            {t('explore')}
          </h2>
          <Link href="/destinations">
            {t('allDestinations')} <ArrowUpRight size={14} />
          </Link>
          <Link href="/#planner">{t('itinerary')}</Link>
          <Link href="/destinations/europe">{t('europeEsims')}</Link>
          <Link href="/guides">{t('guides')}</Link>
          <Link href="/partners">{t('partners')}</Link>
        </nav>
        <nav className="footer-links footer-legal" aria-labelledby="footer-legal" dir={direction}>
          <h2 className="eyebrow" id="footer-legal">
            {t('legal')}
          </h2>
          {policies.map(({ slug, title }) => (
            <Link key={slug} href={POLICIES[slug].path}>
              {title}
            </Link>
          ))}
          <CookieSettingsButton />
        </nav>
        <nav className="footer-links footer-help" aria-labelledby="footer-help" dir={direction}>
          <h2 className="eyebrow" id="footer-help">
            {t('support')}
          </h2>
          <Link href="/help">{navigation('help')}</Link>
          <Link href={POLICIES.compatibility.path}>{t('compatibility')}</Link>
          <Link href={POLICIES.contact.path}>{t('contact')}</Link>
          <Link href="/account/esims">{t('myEsims')}</Link>
          <Link href="/register">{t('createAccount')}</Link>
        </nav>
      </div>
      <div className="container company-disclosure">
        <p>
          {t('company', {
            brand: isolate(BUSINESS.brand),
            company: isolate(BUSINESS.company),
            number: isolate(BUSINESS.number),
          })}
        </p>
        <address>
          {t('office')}: <bdi dir="ltr">{BUSINESS.address}</bdi>
        </address>
        <a href={'mailto:' + BUSINESS.email} dir="ltr">
          {BUSINESS.email}
        </a>
      </div>
      <div className="container footer-bottom">
        <span>{t('copyright', { year: new Date().getFullYear() })}</span>
      </div>
    </footer>
  );
}
