import { privateMetadata } from '@/lib/server-translations';
import { Cart } from '@/components/cart';
export async function generateMetadata() {
  return privateMetadata('cart.title');
}
export default function Page() {
  return <Cart />;
}
