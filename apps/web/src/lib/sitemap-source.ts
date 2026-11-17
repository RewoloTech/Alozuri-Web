import { cache } from 'react';
import { POLICIES } from '@alozuri/shared/policies';
import { guides } from './guides';
import { getPublicCountries, getSitemapPlanIds } from './catalogue-server';
export const sitemapPaths = cache(async (): Promise<string[]> => {
  const [countries, plans] = await Promise.all([getPublicCountries(), getSitemapPlanIds()]);
  return [
    ...new Set([
      '/',
      '/destinations',
      '/help',
      '/partners',
      '/destinations/europe',
      '/guides',
      ...guides.map((guide) => '/guides/' + guide.slug),
      ...Object.values(POLICIES).map((policy) => policy.path),
      ...countries.map((country) => '/destinations/' + country.code.toLowerCase()),
      ...plans.map((id) => '/plans/' + id),
    ]),
  ].sort();
});
