import { notFound } from 'next/navigation';
import { countries } from '@voyaspan/shared';
import { Planner } from '@/components/planner';
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const country = countries.find((c) => c.code === code.toUpperCase());
  return {
    title: country ? `${country.name} travel eSIM` : 'Destination not found',
    robots: { index: false },
  };
}
export default async function Destination({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const country = countries.find((c) => c.code === code.toUpperCase());
  if (!country) notFound();
  return (
    <section className="container section">
      <div className="page-intro">
        <span className="eyebrow">{country.region} · TRAVEL DATA</span>
        <h1>
          {country.flag} Stay connected in {country.name}.
        </h1>
        <p>
          Add the rest of your trip below. We check every country individually, including the UK and
          Switzerland.
        </p>
      </div>
      <Planner key={code} initialCountries={[country.code]} destinationMode />
    </section>
  );
}

export function generateStaticParams() {
  return countries.map((country) => ({ code: country.code.toLowerCase() }));
}
