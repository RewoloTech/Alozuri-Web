import { privateMetadata } from '@/lib/server-translations';
import { PurchaseHistory } from '@/components/purchase-status';
export async function generateMetadata() {
  return privateMetadata('site.usage');
}
export default function Page() {
  return <PurchaseHistory view="usage" />;
}
