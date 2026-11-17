import { Planner } from '@/components/planner';
import { CountryOffers } from '@/components/country-offers';
import { DestinationAdvice } from '@/components/destination-advice';
import { LinkedMessage, MESSAGE_LINKS } from '@/components/linked-message';
import { getItineraryPlans } from '@/lib/catalogue-server';
import { serverTranslations } from '@/lib/server-translations';
import { destinationName } from '@alozuri/shared/i18n/destinations';
import { localePath } from '@alozuri/shared/i18n';
import { breadcrumbs, jsonLd } from '@/lib/seo';
import { localizedMetadata as publicMetadata } from '@/lib/localized-metadata';
export const revalidate = 300;
const itinerary = ['FR', 'DE', 'IT'];
export async function generateMetadata() {
  const { t } = await serverTranslations();
  return publicMetadata(t('regionUi.title'), t('regionUi.description'), '/destinations/europe');
}
export default async function Europe() {
  const { locale, t } = await serverTranslations();
  const plans = await getItineraryPlans(itinerary);
  const names = new Intl.ListFormat(locale === 'en' ? 'en-GB' : locale, {
    style: 'long',
    type: 'conjunction',
  }).format(itinerary.map((code) => destinationName(code, locale)));
  return (
    <section className="container section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbs(t('regionUi.title'), localePath('/destinations/europe', locale)),
          ),
        }}
      />
      <div className="page-intro">
        <span className="eyebrow">{t('regionUi.eyebrow')}</span>
        <h1>{t('regionUi.heading')}</h1>
        <p>{t('regionUi.intro')}</p>
        <p>{t('regionUi.example', { countries: names })}</p>
      </div>
      <CountryOffers code={itinerary.join(',')} coverage="all" initial={plans} />
      <Planner initialCountries={itinerary} />
      <DestinationAdvice
        content={{
          title: t('regionUi.title'),
          description: t('regionUi.description'),
          intro: t('regionUi.intro'),
          tips: [t('regionUi.tip1'), t('regionUi.tip2'), t('regionUi.tip3')],
          faq: [
            { question: t('regionUi.question1'), answer: t('regionUi.answer1') },
            { question: t('regionUi.question2'), answer: t('regionUi.answer2') },
          ],
        }}
      />
      <p>
        <LinkedMessage
          message={t('regionUi.oneCountry', {
            gb: MESSAGE_LINKS.gb,
            destinations: MESSAGE_LINKS.destinations,
          })}
          links={{
            gb: { href: '/destinations/gb', label: destinationName('GB', locale) },
            destinations: { href: '/destinations', label: t('site.allDestinations') },
          }}
        />
      </p>
    </section>
  );
}
