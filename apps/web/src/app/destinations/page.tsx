import { serverTranslations } from '@/lib/server-translations';
import { getPublicCountries } from '@/lib/catalogue-server';
import { localizedMetadata as publicMetadata } from '@/lib/localized-metadata';
import Link from '@/components/localized-link';
import { DestinationDirectory } from '@/components/destination-directory';
export async function generateMetadata() {
  const { t } = await serverTranslations();
  return publicMetadata(t('seoUi.destTitle'), t('seoUi.destDescription'), '/destinations');
}
export default async function Destinations() {
  const initial = await getPublicCountries();
  const { t } = await serverTranslations();
  return (
    <section className="container section">
      <div className="page-intro">
        <span className="eyebrow">{t('authUi.artEyebrow')}</span>
        <h1>{t('countryUi.directoryTitle')}</h1>
        <p>{t('countryUi.directoryHint')}</p>
        <Link className="button primary" href="/#planner">
          {t('countryUi.buildItinerary')} →
        </Link>
      </div>
      <DestinationDirectory initial={initial} />
    </section>
  );
}
