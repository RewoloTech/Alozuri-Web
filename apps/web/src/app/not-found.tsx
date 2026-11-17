import { serverTranslations } from '@/lib/server-translations';
import Link from '@/components/localized-link';
export default async function NotFound() {
  const { t } = await serverTranslations();
  return (
    <section className="container section">
      <div className="page-intro">
        <span className="eyebrow">{t('pageUi.notFoundEyebrow')}</span>
        <h1>{t('pageUi.notFoundTitle')}</h1>
        <p>{t('pageUi.notFoundText')}</p>
        <Link className="button primary" href="/">
          {t('pageUi.backHome')}
        </Link>
      </div>
    </section>
  );
}
