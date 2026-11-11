import { publicMetadata } from '@/lib/seo';
import { FeaturedBundles } from '@/components/featured-bundles';
import { getPublicFeaturedBundles } from '@/lib/catalogue-server';
import { Home } from '@/components/home';
export default async function Page() {
  return <Home featuredBundles={<FeaturedBundles initial={await getPublicFeaturedBundles()} />} />;
}

export const metadata = publicMetadata(
  'Travel eSIM data for every stop',
  'Compare prepaid travel eSIM data for one country or a multi-country trip. Review real coverage, allowance, validity and activation before paying.',
  '/',
);
