import type { Plan } from '@alozuri/shared';
import { dataLabel } from '@alozuri/shared';
import { createTranslator } from 'use-intl/core';
import { englishMessages, type Messages } from '@alozuri/shared/i18n/messages';
import { planDisplayCopy, type PlanMessageKey } from '@alozuri/shared/i18n/plan-copy';
import { BUSINESS } from '@alozuri/shared/legal';
import { localePath, type Locale } from '@alozuri/shared/i18n';
/** Only verified public catalogue values; no inferred stock, ratings or refund eligibility. */
type SchemaKey =
  | PlanMessageKey
  | 'plans.allowance'
  | 'plans.validity'
  | 'transactionUi.includedCountries'
  | 'planInfo.activation'
  | 'planInfo.networks'
  | 'seoUi.planDescription';
export function productStructuredData(
  plan: Plan,
  locale: Locale = 'en',
  translate?: (key: SchemaKey, params?: Record<string, string | number>) => string,
) {
  if (plan.demo) return null;
  if (locale !== 'en' && !translate)
    throw new Error('Native product schema requires native messages.');
  const sourceMessages: Messages = englishMessages;
  const t: NonNullable<typeof translate> =
    translate ?? createTranslator({ locale: 'en', messages: sourceMessages });
  const copy = planDisplayCopy(locale, t);
  const days = t('plans.days', { count: plan.days });
  const amount = BigInt(plan.priceCents);
  const url = BUSINESS.site + localePath('/plans/' + encodeURIComponent(plan.id), locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: copy.title(plan),
    sku: plan.id,
    description:
      locale === 'en'
        ? `${dataLabel(plan)} for ${plan.days} ${plan.days === 1 ? 'day' : 'days'}. ${plan.fairUse}`
        : t('seoUi.planDescription', { allowance: copy.allowance(plan), days }) +
          ' ' +
          copy.fairUse(plan.fairUse),
    url,
    brand: { '@type': 'Brand', name: BUSINESS.brand },
    additionalProperty: [
      { '@type': 'PropertyValue', name: t('plans.allowance'), value: copy.allowance(plan) },
      {
        '@type': 'PropertyValue',
        name: t('plans.validity'),
        value: days,
      },
      {
        '@type': 'PropertyValue',
        name: t('transactionUi.includedCountries'),
        value: plan.countries.map(copy.country).join(', '),
      },
      {
        '@type': 'PropertyValue',
        name: t('planInfo.activation'),
        value: copy.activation(plan.activation),
      },
      ...(plan.networks.length
        ? [
            {
              '@type': 'PropertyValue',
              name: t('planInfo.networks'),
              value: plan.networks.join(', '),
            },
          ]
        : []),
    ],
    offers: {
      '@type': 'Offer',
      url,
      price: `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`,
      priceCurrency: plan.currency,
      seller: { '@id': BUSINESS.site + '/#organization' },
    },
  };
}
