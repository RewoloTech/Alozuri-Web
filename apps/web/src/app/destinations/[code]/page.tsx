import { localizedDestinations } from '@/lib/localized-destinations';
import { serverTranslations } from '@/lib/server-translations';
import { destinationName, regionDisplayName } from '@alozuri/shared/i18n/destinations';
import { DestinationAdvice } from '@/components/destination-advice';
import { CountryOffers } from '@/components/country-offers';
import { getPublicCountries, getCountryPlans } from '@/lib/catalogue-server';
import { breadcrumbs, jsonLd } from '@/lib/seo';
import { localizedMetadata as publicMetadata, requestLocale } from '@/lib/localized-metadata';
import { localePath } from '@alozuri/shared/i18n';
import { notFound, permanentRedirect } from 'next/navigation';
import { countries, countryName, countryFlag, isCountryCode } from '@alozuri/shared';
import { Planner } from '@/components/planner';
export const revalidate = 300;
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params,
    iso = code.toUpperCase();
  const { locale, t } = await serverTranslations();
  if (!isCountryCode(iso)) return { title: t('regionUi.notFound'), robots: { index: false } };
  const verified = (await getPublicCountries()).some((c) => c.code === iso);
  const name = destinationName(iso, locale),
    path = '/destinations/' + iso.toLowerCase();
  const advice = (await localizedDestinations(locale))[iso];
  const metadata = await publicMetadata(
    advice?.title ?? t('regionUi.genericTitle', { country: name }),
    advice?.description ?? t('regionUi.genericDescription', { country: name }),
    path,
  );
  return {
    ...metadata,
    robots: { index: metadata.robots.index && (verified || Boolean(advice)), follow: true },
  };
}
export default async function Destination({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const iso = code.toUpperCase();
  const country = isCountryCode(iso)
    ? (countries.find((c) => c.code === iso) ?? {
        code: iso,
        name: countryName(iso),
        region: 'DESTINATION',
        flag: countryFlag(iso),
      })
    : undefined;
  if (!country) notFound();
  if (code !== code.toLowerCase())
    permanentRedirect(localePath('/destinations/' + code.toLowerCase(), await requestLocale()));
  const { locale, t } = await serverTranslations();
  const name = destinationName(iso, locale);
  const region = regionDisplayName(country.region, locale);
  const advice = (await localizedDestinations(locale))[iso];
  const initialPlans = await getCountryPlans(iso);
  return (
    <section className="container section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbs(name, localePath('/destinations/' + iso.toLowerCase(), locale)),
          ),
        }}
      />
      <div className="page-intro">
        <span className="eyebrow">
          {region ? region + ' · ' : ''}
          {t('countryUi.travelData')}
        </span>
        <h1>
          <bdi>{country.flag}</bdi> {t('countryUi.connected', { country: name })}
        </h1>
        <p>{advice?.intro ?? t('countryUi.intro', { country: name })}</p>
      </div>
      <CountryOffers code={iso} initial={initialPlans} />
      <Planner key={code} initialCountries={[country.code]} destinationMode />
      {advice && <DestinationAdvice content={advice} />}
    </section>
  );
}

export function generateStaticParams() {
  return countries.map((country) => ({ code: country.code.toLowerCase() }));
}
