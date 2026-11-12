import { demoPlans } from '@alozuri/shared/demo';
import { LegacyCheckout } from '@/components/legacy-checkout';
export const metadata = { title: 'Review your plan', robots: { index: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LegacyCheckout id={id} />;
}

export function generateStaticParams() {
  return process.env.VOYASPAN_STATIC_EXPORT === 'true'
    ? demoPlans.map((plan) => ({ id: plan.id }))
    : [];
}
