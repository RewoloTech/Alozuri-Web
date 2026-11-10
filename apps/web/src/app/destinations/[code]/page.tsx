import { notFound } from 'next/navigation';
import { countries, countryName, isCountryCode } from '@voyaspan/shared';
import { Planner } from '@/components/planner';
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const iso = code.toUpperCase();
  const country = isCountryCode(iso)
    ? (countries.find((c) => c.code === iso) ?? {
        code: iso,
        name: countryName(iso),
        region: 'DESTINATION',
        flag: String.fromCodePoint(...[...iso].map((c) => 127397 + c.charCodeAt(0))),
      })
    : undefined;
  return {
    title: country ? `${country.name} travel eSIM` : 'Destination not found',
    robots: { index: false },
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
        flag: String.fromCodePoint(...[...iso].map((c) => 127397 + c.charCodeAt(0))),
      })
    : undefined;
  if (!country) notFound();
  return (
    <section className="container section">
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
      <Planner key={code} initialCountries={[country.code]} destinationMode />
    </section>
  );
}

export function generateStaticParams() {
  return countries.map((country) => ({ code: country.code.toLowerCase() }));
}
