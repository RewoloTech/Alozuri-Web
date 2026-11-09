'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="container section">
      <div className="page-intro">
        <h1>We hit a connection problem.</h1>
        <p>Please try opening this page again.</p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </div>
    </section>
  );
}
