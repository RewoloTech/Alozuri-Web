import { demoPlans } from '@voyaspan/shared/demo';
import { dataLabel } from '@voyaspan/shared';
import { BUSINESS } from '@voyaspan/shared/legal';
import { PlanDetails } from '@/components/plan-details';
import { getPublicPlan } from '@/lib/catalogue-server';
import { publicMetadata, breadcrumbs, jsonLd } from '@/lib/seo';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    plan = await getPublicPlan(id);
  return plan
    ? publicMetadata(
        plan.name,
        `${dataLabel(plan)} travel data for ${plan.days} days. Review verified country coverage, activation and fair-use conditions before buying.`,
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
  const amount = plan ? BigInt(plan.priceCents) : 0n;
  return (
    <>
      {plan && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: jsonLd({
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: plan.name,
                sku: plan.id,
                description: `${dataLabel(plan)} for ${plan.days} days. ${plan.fairUse}`,
                url: BUSINESS.site + '/plans/' + id,
                brand: { '@type': 'Brand', name: BUSINESS.brand },
                offers: {
                  '@type': 'Offer',
                  url: BUSINESS.site + '/plans/' + id,
                  price: `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`,
                  priceCurrency: plan.currency,
                  seller: { '@id': BUSINESS.site + '/#organization' },
                },
              }),
            }}
          />
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
