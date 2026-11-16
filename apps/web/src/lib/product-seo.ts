import type { Plan } from '@alozuri/shared';
import { dataLabel, countryName } from '@alozuri/shared';
import { BUSINESS } from '@alozuri/shared/legal';
import { localePath, type Locale } from '@alozuri/shared/i18n';
/** Only verified public catalogue values; no inferred stock, ratings or refund eligibility. */
export function productStructuredData(plan: Plan, locale: Locale = 'en') {
  if (plan.demo) return null;
  const amount = BigInt(plan.priceCents);
  const url = BUSINESS.site + localePath('/plans/' + encodeURIComponent(plan.id), locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: plan.name,
    sku: plan.id,
    description: `${dataLabel(plan)} for ${plan.days} ${plan.days === 1 ? 'day' : 'days'}. ${plan.fairUse}`,
    url,
    brand: { '@type': 'Brand', name: BUSINESS.brand },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Data allowance', value: dataLabel(plan) },
      {
        '@type': 'PropertyValue',
        name: 'Validity',
        value: `${plan.days} ${plan.days === 1 ? 'day' : 'days'}`,
      },
      {
        '@type': 'PropertyValue',
        name: 'Countries',
        value: plan.countries.map(countryName).join(', '),
      },
      { '@type': 'PropertyValue', name: 'Activation', value: plan.activation },
      ...(plan.networks.length
        ? [{ '@type': 'PropertyValue', name: 'Networks', value: plan.networks.join(', ') }]
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
