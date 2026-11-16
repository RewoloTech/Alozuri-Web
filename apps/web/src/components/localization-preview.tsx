'use client';
import { useEffect, useState } from 'react';
import Link from '@/components/localized-link';
import { LOCALES, LOCALE_NAMES, type Locale } from '@alozuri/shared/i18n';
import { englishMessages, type Messages } from '@alozuri/shared/i18n/messages';
import { api } from '@/lib/api';
import { useAuth } from './auth-provider';
type Preview = {
  locale: Locale;
  published: boolean;
  direction: 'ltr' | 'rtl';
  messages: Messages;
  review: Record<string, string>;
  legal: {
    version: string;
    status: string;
    documents: { slug: string; title: string; text: string }[];
  };
  email: { subject: string; html: string; text: string; status: string };
};
export function LocalizationPreview() {
  const { user, admin, loading } = useAuth();
  const [locale, setLocale] = useState<Locale>('en');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setPreview(null);
    setError('');
    if (!user?.emailVerified || !admin) return;
    const controller = new AbortController();
    void api<Preview>(
      '/v1/operations/localization/preview?locale=' + locale,
      { signal: controller.signal },
      user.uid,
    )
      .then((result) => {
        if (!controller.signal.aborted) setPreview(result);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            'Language preview could not load. Verify administrator access and API deployment.',
          );
      });
    return () => controller.abort();
  }, [user, admin, locale]);
  if (loading) return <p role="status">Checking access…</p>;
  if (!user?.emailVerified || !admin)
    return (
      <section className="container section">
        <h1>Language review</h1>
        <p role="alert">Administrator access is required.</p>
      </section>
    );
  return (
    <section className="container section">
      <Link href="/operations">Operations</Link>
      <h1>Language review</h1>
      <p>
        Drafts are not approved customer communications. Legal and document translations must be
        reviewed before a language can be published.
      </p>
      <label>
        Preview language
        <select
          className="commerce-input"
          value={locale}
          onChange={(event) => {
            const value = LOCALES.find((item) => item === event.target.value);
            if (value) setLocale(value);
          }}
        >
          {LOCALES.map((value) => (
            <option key={value} value={value}>
              {LOCALE_NAMES[value]}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {!preview && !error && <p role="status">Loading preview…</p>}
      {preview && (
        <>
          <p>
            <strong>
              {preview.published ? 'English production baseline' : 'Unpublished draft'}
            </strong>
          </p>
          <ul>
            {Object.entries(preview.review).map(([domain, status]) => (
              <li key={domain}>
                {domain}: {status}
              </li>
            ))}
          </ul>
          <details>
            <summary>Review core translation catalogue</summary>
            {Object.entries(preview.messages).map(([domain, messages]) => (
              <section key={domain}>
                <h2>{domain}</h2>
                <dl>
                  {Object.entries(messages).map(([key, translated]) => (
                    <div key={key} style={{ marginBlock: 16, overflowWrap: 'anywhere' }}>
                      <dt>
                        <code dir="ltr">
                          {domain}.{key}
                        </code>
                      </dt>
                      <dd style={{ marginInlineStart: 0 }}>
                        <p lang="en" dir="ltr">
                          {Reflect.get(Reflect.get(englishMessages, domain), key)}
                        </p>
                        <p lang={preview.locale} dir={preview.direction}>
                          {translated}
                        </p>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </details>
          <h2>Email copy preview</h2>
          <p>
            This is a core translation sample. Full translated email templates are not available
            yet.
          </p>
          <p>{preview.email.subject}</p>
          <iframe
            title="Draft language email preview"
            sandbox=""
            srcDoc={preview.email.html}
            referrerPolicy="no-referrer"
            style={{ width: '100%', minHeight: 480, border: '1px solid #dcddeb', borderRadius: 12 }}
          />
          <details>
            <summary>Plain-text copy</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{preview.email.text}</pre>
          </details>
          <h2>Legal documents</h2>
          <p>
            Version {preview.legal.version} · {preview.legal.status}
          </p>
          {preview.legal.status === 'missing' ? (
            <p>No approved legal translation is available. Checkout in this language is blocked.</p>
          ) : (
            <Link href="/terms">View English legal source</Link>
          )}
          {preview.legal.documents.map((document) => (
            <details key={document.slug}>
              <summary>{document.title}</summary>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {document.text}
              </pre>
            </details>
          ))}
        </>
      )}
    </section>
  );
}
