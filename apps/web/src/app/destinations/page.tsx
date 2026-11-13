import { getPublicCountries } from '@/lib/catalogue-server';
import { publicMetadata } from '@/lib/seo';
import Link from 'next/link';
import { DestinationDirectory } from '@/components/destination-directory';
export const metadata = publicMetadata(
  'eSIM destinations',
  'Find travel eSIM coverage by country or compare one plan for a multi-country itinerary.',
  '/destinations',
);
export default async function Destinations() {
  const initial = await getPublicCountries();
  return (
    <section className="container section">
      <div className="page-intro">
        <span className="eyebrow">YOUR WORLD. CONNECTED.</span>
        <h1>Where will you go next?</h1>
        <p>Choose one destination, or build an itinerary to find one plan for every stop.</p>
        <Link className="button primary" href="/#planner">
          Build my itinerary →
        </Link>
      </div>
      <DestinationDirectory initial={initial} />
    </section>
  );
}
