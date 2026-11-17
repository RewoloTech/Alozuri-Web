'use client';
import { useTranslations } from 'next-intl';
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations('pageUi');
  const common = useTranslations('common');
  return (
    <section className="container section">
      <div className="page-intro">
        <h1>{t('errorTitle')}</h1>
        <p>{t('errorText')}</p>
        <button className="button primary" onClick={reset}>
          {common('retry')}
        </button>
      </div>
    </section>
  );
}
