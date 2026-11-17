import { privateMetadata } from '@/lib/server-translations';
import { PurchaseHistory } from '@/components/purchase-status';
export async function generateMetadata() {
  return privateMetadata('site.myEsims');
}
export default function Page() {
  return <PurchaseHistory />;
}
