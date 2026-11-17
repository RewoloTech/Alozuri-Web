import { countryName, dataSizeLabel, type Plan } from '../index.ts';
import { destinationName, regionDisplayName } from './destinations.ts';
import { translateSupplierCopy } from './supplier-copy.ts';
import { localeDirection, type Locale } from './locales.ts';
import type { Messages } from './messages.ts';
type Params = Record<string, string | number>;
export type PlanMessageKey = {
  [
    Domain in 'display' | 'search' | 'cart' | 'plans' | 'supplierCopy'
  ]: `${Domain}.${Extract<keyof Messages[Domain], string>}`;
}['display' | 'search' | 'cart' | 'plans' | 'supplierCopy'];
/** Display only. Stored products, currencies, costs and activation rules never change. */
export function planDisplayCopy(
  locale: Locale,
  translate: (key: PlanMessageKey, params?: Params) => string,
) {
  const t = (key: keyof Messages['display'], params?: Params) =>
    translate(`display.${key}`, params);
  const search = (key: keyof Messages['search'], params?: Params) =>
    translate(`search.${key}`, params);
  const cart = (key: keyof Messages['cart'], params?: Params) => translate(`cart.${key}`, params);
  const plans = (key: keyof Messages['plans'], params?: Params) =>
    translate(`plans.${key}`, params);
  const supplier = (key: keyof Messages['supplierCopy'], params?: Params) =>
    translate(`supplierCopy.${key}`, params);
  const isolate = (value: string) => (locale === 'ar' ? '\u2066' + value + '\u2069' : value);
  function allowance(plan: Pick<Plan, 'dataGb' | 'dataType' | 'dailyPolicy'>) {
    // Keep the existing quantity/unit conversion, independent of language.
    const size = dataSizeLabel(plan.dataGb);
    if (plan.dataType === 'unlimited') return t('unlimited');
    if (plan.dataType === 'daily')
      return t(plan.dailyPolicy === 'reduced' ? 'reduced' : 'daily', {
        size: locale === 'ar' ? '\u2066' + size + '\u2069' : size,
      });
    return isolate(size);
  }
  return {
    locale,
    dir: localeDirection(locale),
    isolate,
    allowance,
    title: (plan: Pick<Plan, 'name' | 'countries' | 'days'>) => {
      if (locale === 'en') return plan.name;
      // Only translate known descriptive prefixes and units. Preserve supplier
      // product names, variants and stored snapshots rather than inventing names.
      const prefixes =
        plan.countries.length === 1
          ? [[countryName(plan.countries[0]), destinationName(plan.countries[0], locale)]]
          : [
              ['Europe', t('europe')],
              ['Asia', t('asia')],
              ['North America', t('northAmerica')],
              ['Global', t('global')],
              ...[
                'South America',
                'Central America',
                'Caribbean',
                'Oceania',
                'Africa',
                'North Africa',
                'Middle East',
              ].map((region) => [region, regionDisplayName(region, locale) ?? region]),
            ];
      const prefix = prefixes.find(
        ([source]) => plan.name === source || plan.name.startsWith(source + ' '),
      );
      const name = prefix ? prefix[1] + plan.name.slice(prefix[0].length) : plan.name;
      return name
        .replace(
          /\b(\d+(?:[.,]\d+)?)\s*(GB|MB|KB)\s*\/\s*Days?\b/gi,
          (_, amount: string, unit: string) => t('daily', { size: amount + unit }),
        )
        .replace(/\bUnlimited\b/gi, () => t('unlimited'))
        .replace(/\b\d+(?:[.,]\d+)?\s*(?:GB|MB|KB)\b/gu, isolate)
        .replace(/\b(\d+)\s*Days?\b/gi, (_, count: string) =>
          plans('days', { count: Number(count) }),
        )
        .replace(
          /\((\d+) areas\)/gi,
          (_, count: string) => '(' + search('destinationsCount', { count: Number(count) }) + ')',
        );
    },
    activation: (rule: string) => {
      if (
        rule ===
        'Starts on first connection to a supported network. Check your purchased plan before installation.'
      )
        return cart('activationLegacyNetwork');
      // Exact source templates from the existing supplier adapter, not an
      // inference about when an arbitrary supplier plan activates.
      if (rule === 'Starts on first connection to a supported mobile network.')
        return cart('activationNetwork');
      if (rule === 'Validity starts after purchase. Buy only when you are ready to use it.')
        return cart('activationPurchase');
      if (
        rule === 'Validity starts when the eSIM is installed. Install when you are ready to use it.'
      )
        return cart('activationInstall');
      return rule;
    },
    fairUse: (rule: string) =>
      rule === 'Fixed total data allowance. Data only; no local phone number.' ||
      rule === 'Fixed data allowance. Data only; no local phone number.'
        ? cart('fairFixed')
        : translateSupplierCopy(rule, supplier, isolate),
    notes: (notes: string) => translateSupplierCopy(notes, supplier, isolate),
    country: (code: string) => destinationName(code, locale),
    coverage: (plan: Pick<Plan, 'countries'>) =>
      search('coverage', { count: plan.countries.length }),
  };
}
