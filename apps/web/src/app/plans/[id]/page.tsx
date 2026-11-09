import { demoPlans } from '@voyaspan/shared/demo';
import { PlanDetails } from '@/components/plan-details';
export const metadata = { title: 'Plan details', robots: { index: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanDetails key={id} id={id} />;
}

export function generateStaticParams() {
  return process.env.VOYASPAN_STATIC_EXPORT === 'true'
    ? demoPlans.map((plan) => ({ id: plan.id }))
    : [];
}
