// Locale comes from request headers, so unknown product paths cannot be ISR HTML.
// Public catalogue fetches retain their explicit 300-second data cache.
export const revalidate = 0;
import { demoPlans } from '@alozuri/shared/demo';
import { planDisplayCopy } from '@alozuri/shared/i18n/plan-copy';
import { localePath } from '@alozuri/shared/i18n';
import { serverTranslations } from '@/lib/server-translations';
import { PlanDetails } from '@/components/plan-details';
import { getPublicPlan } from '@/lib/catalogue-server';
import { breadcrumbs, jsonLd } from '@/lib/seo';
import { localizedMetadata as publicMetadata } from '@/lib/localized-metadata';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    plan = await getPublicPlan(id);
  const { locale, t } = await serverTranslations();
  const copy = planDisplayCopy(locale, t);
  return plan
    ? await publicMetadata(
        copy.title(plan),
        t('seoUi.planDescription', {
          allowance: copy.allowance(plan),
          days: t('plans.days', { count: plan.days }),
        }),
        '/plans/' + id,
      )
    : {
        title: t('seoUi.planTitle'),
        description: t('seoUi.planUnavailable'),
        robots: { index: false },
      };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    plan = await getPublicPlan(id);
  const { locale, t } = await serverTranslations();
  const copy = planDisplayCopy(locale, t);
  return (
    <>
      {plan && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: jsonLd(breadcrumbs(copy.title(plan), localePath('/plans/' + id, locale))),
            }}
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
