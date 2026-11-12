import { PurchaseHistory } from '@/components/purchase-status';
export const metadata = { title: 'Data usage', robots: { index: false } };
export default function Page() {
  return <PurchaseHistory view="usage" />;
}
