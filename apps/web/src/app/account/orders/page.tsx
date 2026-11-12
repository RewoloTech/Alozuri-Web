import { PurchaseHistory } from '@/components/purchase-status';
export const metadata = { title: 'Orders', robots: { index: false } };
export default function Page() {
  return <PurchaseHistory view="orders" />;
}
