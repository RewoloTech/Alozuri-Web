import Link from 'next/link';
import { BUSINESS, LEGAL_EFFECTIVE_DATE, LEGAL_VERSION } from '@voyaspan/shared/legal';
import { POLICIES, type Policy } from '@voyaspan/shared/policies';
import { SupportChoices, CookieSettingsButton } from './privacy-provider';
export function LegalDocument({
  policy,
  version = LEGAL_VERSION,
}: {
  policy: Policy;
  version?: string;
}) {
  return (
    <article className="container section policy-page">
      <header className="page-intro">
        <span className="eyebrow">ALOZURI · LEGAL & CUSTOMER INFORMATION</span>
        <h1>{policy.title}</h1>
        <p>{policy.description}</p>
        <p className="policy-version">
          Effective {LEGAL_EFFECTIVE_DATE} · Version {version} ·{' '}
          <Link href={`/legal/versions/${version}/${policy.slug}`}>Permanent version</Link>
        </p>
      </header>
      <nav aria-label="On this page" className="surface policy-contents">
        <h2>On this page</h2>
        <ol>
          {policy.sections.map((s, i) => (
            <li key={s.title}>
              <a href={'#section-' + (i + 1)}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="policy-copy">
        {policy.sections.map((s, i) => (
          <section id={'section-' + (i + 1)} key={s.title}>
            <h2>
              {i + 1}. {s.title}
            </h2>
            {s.paragraphs.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
            {s.steps && (
              <ol className="policy-steps">
                {s.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
            {s.table && <p className="fine-print">Swipe or scroll to view all columns.</p>}
            {s.table && (
              <div className="policy-table" role="region" aria-label={s.table.caption} tabIndex={0}>
                <table>
                  <caption>{s.table.caption}</caption>
                  <thead>
                    <tr>
                      {s.table.headings.map((heading) => (
                        <th scope="col" key={heading}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((row) => (
                      <tr key={row[0]}>
                        {row.map((cell, column) =>
                          column === 0 ? (
                            <th scope="row" key={column}>
                              {cell}
                            </th>
                          ) : (
                            <td key={column}>{cell}</td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.links && (
              <ul className="policy-resources">
                {s.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      {policy.slug === 'contact' && <SupportChoices />}
      {policy.slug === 'cookies' && <CookieSettingsButton />}
      <aside className="surface policy-company">
        <h2>About Alozuri</h2>
        <p>{BUSINESS.identity}</p>
        <address>
          {BUSINESS.address}
          <br />
          <a href={'mailto:' + BUSINESS.email}>{BUSINESS.email}</a>
        </address>
      </aside>
      <nav aria-label="Related policies" className="policy-links">
        {Object.values(POLICIES)
          .filter((p) => p.slug !== policy.slug)
          .map((p) => (
            <Link key={p.slug} href={p.path}>
              {p.title}
            </Link>
          ))}
      </nav>
    </article>
  );
}
