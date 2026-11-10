import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="container section">
      <div className="page-intro">
        <span className="eyebrow">A SMALL DETOUR</span>
        <h1>This stop isn’t on the map.</h1>
        <p>We couldn’t find this page. Let’s get you back to your trip.</p>
        <Link className="button primary" href="/">
          Back to Alozuri →
        </Link>
      </div>
    </section>
  );
}
