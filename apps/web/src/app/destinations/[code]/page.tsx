import { destinationContent } from '@/lib/destination-content';
import { DestinationAdvice } from '@/components/destination-advice';
import { CountryOffers } from '@/components/country-offers';
import { getPublicCountries, getCountryPlans } from '@/lib/catalogue-server';
import { publicMetadata, INDEXABLE, breadcrumbs, jsonLd } from '@/lib/seo';
import { notFound, permanentRedirect } from 'next/navigation';
import { countries, countryName, countryFlag, isCountryCode } from '@alozuri/shared';
import { Planner } from '@/components/planner';
export const revalidate = 300;
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params,
    iso = code.toUpperCase();
  if (!isCountryCode(iso)) return { title: 'Destination not found', robots: { index: false } };
  const verified = (await getPublicCountries()).some((c) => c.code === iso);
  const name = countryName(iso),
    path = '/destinations/' + iso.toLowerCase();
  const advice = destinationContent[iso];
  const metadata = publicMetadata(
    advice?.title ?? `${name} travel eSIM`,
    advice?.description ??
      `Compare ${name} travel data plans, allowance, validity and activation rules. Find local coverage or build a multi-country itinerary.`,
    path,
  );
  return {
    ...metadata,
    robots: { index: INDEXABLE && (verified || Boolean(advice)), follow: true },
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
  if (code !== code.toLowerCase()) permanentRedirect('/destinations/' + code.toLowerCase());
  const advice = destinationContent[iso];
  const initialPlans = await getCountryPlans(iso);
  return (
    <section className="container section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbs(country.name, '/destinations/' + iso.toLowerCase())),
        }}
      />
      <div className="page-intro">
        <span className="eyebrow">{country.region} · TRAVEL DATA</span>
        <h1>
          {country.flag} Stay connected in {country.name}.
        </h1>
        <p>
          {advice?.intro ??
            `Compare data allowances and validity for your trip to ${country.name}. Open a plan to read its supplier-reported coverage and activation rule, or add more countries to compare a multi-stop itinerary.`}
        </p>
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
