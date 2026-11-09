import Link from 'next/link';
import { countries } from '@voyaspan/shared';
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
      <div className="country-grid">
        {countries.map((c) => (
          <Link
            className="country-tile"
            key={c.code}
            href={`/destinations/${c.code.toLowerCase()}`}
          >
            <span className="country-emoji">{c.flag}</span>
            <span>
              <strong>{c.name}</strong>
              <small>{c.region}</small>
            </span>
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
