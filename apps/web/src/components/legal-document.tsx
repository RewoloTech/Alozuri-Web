import Link from '@/components/localized-link';
import { BUSINESS, LEGAL_EFFECTIVE_DATE, LEGAL_VERSION } from '@alozuri/shared/legal';
import { type Policy } from '@alozuri/shared/policies';
import { SupportChoices, CookieSettingsButton } from './privacy-provider';
import { serverTranslations } from '@/lib/server-translations';
import { localizedPolicies } from '@alozuri/shared/i18n/legal-documents';
import { LocaleUnavailableError } from '@alozuri/shared/i18n';
import { LegalLanguageNotice } from './legal-language-notice';
export async function LegalDocument({
  policy: sourcePolicy,
  version = LEGAL_VERSION,
}: {
  policy: Policy;
  version?: string;
}) {
  const { locale, t, dir } = await serverTranslations();
  let policies: Record<string, Policy> | undefined;
  try {
    policies = localizedPolicies(locale, version);
  } catch (error) {
    if (!(error instanceof LocaleUnavailableError)) throw error;
  }
  const policy = policies?.[sourcePolicy.slug];
  if (!policy || !policies) return <LegalLanguageNotice />;
  const isolate = (value: string) => (locale === 'ar' ? '\u2066' + value + '\u2069' : value);
  return (
    <article className="container section policy-page">
      <header className="page-intro">
        <span className="eyebrow">{t('legalUi.eyebrow')}</span>
        <h1>{policy.title}</h1>
        <p>{policy.description}</p>
        <p className="policy-version">
          {t('legalUi.effective', {
            date: isolate(version === LEGAL_VERSION ? LEGAL_EFFECTIVE_DATE : version.slice(0, 10)),
            version: isolate(version),
          })}{' '}
          · <Link href={`/legal/versions/${version}/${policy.slug}`}>{t('legalUi.permanent')}</Link>
        </p>
      </header>
      <nav aria-label={t('legalUi.contents')} className="surface policy-contents">
        <h2>{t('legalUi.contents')}</h2>
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
            {s.table && <p className="fine-print">{t('legalUi.scroll')}</p>}
            {s.table && (
              <div className="policy-table" role="region" aria-label={s.table.caption} tabIndex={0}>
                <table dir="ltr">
                  <caption>{s.table.caption}</caption>
                  <thead>
                    <tr>
                      {s.table.headings.map((heading) => (
                        <th scope="col" key={heading} dir={dir}>
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
                            <th scope="row" key={column} dir="auto">
                              {cell}
                            </th>
                          ) : (
                            <td key={column} dir={dir}>
                              {cell}
                            </td>
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
        <h2>{t('legalUi.about')}</h2>
        <p>
          {t('site.company', {
            brand: isolate(BUSINESS.brand),
            company: isolate(BUSINESS.company),
            number: isolate(BUSINESS.number),
          })}
        </p>
        <address dir="ltr">
          {BUSINESS.address}
          <br />
          <a href={'mailto:' + BUSINESS.email}>{BUSINESS.email}</a>
        </address>
      </aside>
      <nav aria-label={t('legalUi.related')} className="policy-links">
        {Object.values(policies)
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
