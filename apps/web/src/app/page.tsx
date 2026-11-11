import { publicMetadata } from '@/lib/seo';
import { Home } from '@/components/home';
export default function Page() {
  return <Home />;
}

export const metadata = publicMetadata(
  'Travel eSIM data for every stop',
  'Compare prepaid travel eSIM data for one country or a multi-country trip. Review real coverage, allowance, validity and activation before paying.',
  '/',
);
