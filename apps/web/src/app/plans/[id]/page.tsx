import { demoPlans } from '@alozuri/shared/demo';
import { dataLabel } from '@alozuri/shared';
import { PlanDetails } from '@/components/plan-details';
import { getPublicPlan } from '@/lib/catalogue-server';
import { breadcrumbs, jsonLd } from '@/lib/seo';
import { localizedMetadata as publicMetadata } from '@/lib/localized-metadata';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    plan = await getPublicPlan(id);
  return plan
    ? await publicMetadata(
        plan.name,
        `${dataLabel(plan)} travel data for ${plan.days} ${plan.days === 1 ? 'day' : 'days'}. Review verified country coverage, activation and fair-use conditions before buying.`,
        '/plans/' + id,
      )
    : {
        title: 'Plan details',
        description: 'Check current eSIM availability and verified plan details.',
        robots: { index: false },
      };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    plan = await getPublicPlan(id);
  return (
    <>
      {plan && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(plan.name, '/plans/' + id)) }}
          />
        </>
      )}
      <PlanDetails key={id} id={id} initialPlan={plan} />
    </>
  );
}
export function generateStaticParams() {
  return process.env.VOYASPAN_STATIC_EXPORT === 'true'
    ? demoPlans.map((plan) => ({ id: plan.id }))
    : [];
}
