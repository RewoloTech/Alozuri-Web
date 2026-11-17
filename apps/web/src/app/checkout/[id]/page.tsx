// Native legacy redirects also read the request locale through the root layout.
export const revalidate = 0;
import { privateMetadata } from '@/lib/server-translations';
import { demoPlans } from '@alozuri/shared/demo';
import { LegacyCheckout } from '@/components/legacy-checkout';
export async function generateMetadata() {
  return privateMetadata('seoUi.planTitle');
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LegacyCheckout id={id} />;
}

export function generateStaticParams() {
  return process.env.VOYASPAN_STATIC_EXPORT === 'true'
    ? demoPlans.map((plan) => ({ id: plan.id }))
    : [];
}
