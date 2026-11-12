import { CountryOffers } from '@/components/country-offers';
import { getPublicCountries, getCountryPlans } from '@/lib/catalogue-server';
import { publicMetadata, INDEXABLE, breadcrumbs, jsonLd } from '@/lib/seo';
import { notFound } from 'next/navigation';
import { countries, countryName, countryFlag, isCountryCode } from '@alozuri/shared';
import { Planner } from '@/components/planner';
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params,
    iso = code.toUpperCase();
  if (!isCountryCode(iso)) return { title: 'Destination not found', robots: { index: false } };
  const verified = (await getPublicCountries()).some((c) => c.code === iso);
  const name = countryName(iso),
    path = '/destinations/' + iso.toLowerCase();
  const metadata = publicMetadata(
    `${name} travel eSIM`,
    `Compare ${name} travel data plans, allowance, validity and activation rules. Find local coverage or build a multi-country itinerary.`,
    path,
  );
  return { ...metadata, robots: { index: INDEXABLE && verified, follow: true } };
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
          Choose a data allowance and compare plans for this destination. Use the multi-country
          option if you are visiting more countries.
        </p>
      </div>
      <CountryOffers code={iso} initial={initialPlans} />
      <Planner key={code} initialCountries={[country.code]} destinationMode />
    </section>
  );
}

export function generateStaticParams() {
  return countries.map((country) => ({ code: country.code.toLowerCase() }));
}
