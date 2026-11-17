import { serverTranslations } from '@/lib/server-translations';
import { seasonalInspiration } from '@alozuri/shared/destination-inspiration';
import { localizedMetadata as publicMetadata } from '@/lib/localized-metadata';
import { FeaturedBundles } from '@/components/featured-bundles';
import { getPublicFeaturedBundles } from '@/lib/catalogue-server';
import { Home } from '@/components/home';
export default async function Page() {
  return (
    <Home
      initialInspiration={seasonalInspiration(new Date())}
      featuredBundles={<FeaturedBundles initial={await getPublicFeaturedBundles()} />}
    />
  );
}

export async function generateMetadata() {
  const { t } = await serverTranslations();
  return publicMetadata(t('seoUi.homeTitle'), t('seoUi.homeDescription'), '/');
}
