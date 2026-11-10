import Link from 'next/link';
import { DestinationDirectory } from '@/components/destination-directory';
export const metadata = { title: 'Destinations', alternates: { canonical: '/destinations' } };
export default function Destinations() {
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
      <DestinationDirectory />
    </section>
  );
}
