import { privateMetadata } from '@/lib/server-translations';
import { Dashboard } from '@/components/dashboard';
export async function generateMetadata() {
  return privateMetadata('site.myEsims');
}
export default function Page() {
  return <Dashboard />;
}
