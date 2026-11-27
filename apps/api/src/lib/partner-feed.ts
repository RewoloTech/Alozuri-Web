import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Plan } from '../../../../packages/shared/src/index.ts';
import { isCountryCode, countryName } from '../../../../packages/shared/src/index.ts';
import { planSchema } from './validation.js';

export const partnerFeedQuery = z
  .object({
    format: z.enum(['catalogue', 'inbox', 'rating']).default('catalogue'),
  })
  .strict();
const site = 'https://alozuri.com';
const provider = {
  id: 'alozuri',
  name: 'Alozuri',
  websiteUrl: site,
  supportUrl: site + '/contact',
  logoUrl: site + '/images/alozuri-email-logo.png',
};

export function structuredFairUse(p: Plan) {
  if (p.dataType !== 'daily' || p.dailyPolicy !== 'reduced') return null;
  // This is the exact public sentence generated from verified supplier fields.
  // Unknown wording or a contradictory allowance stays unknown.
  const match =
    /^(\d+(?:\.\d+)?) (GB|MB) high-speed per day, then reduced speed \((\d+(?:\.\d+)?\s*(?:Kbps|Mbps|Gbps))\)\.$/i.exec(
      p.fairUse,
    );
  if (!match) return null;
  const capMb = Number(match[1]) * (match[2].toUpperCase() === 'GB' ? 1024 : 1);
  if (Math.abs(capMb - p.dataGb * 1024) > 0.001) return null;
  return { capMb, resetPeriod: 'day', speedAfter: match[3] };
}

/** Only public retail fields enter partner exports; never spread stored supplier records. */
export function partnerFeed(
  input: readonly Plan[],
  format: 'catalogue' | 'inbox' | 'rating',
  now = Date.now(),
) {
  const plans = input
    .flatMap((value) => {
      const parsed = planSchema.safeParse(value);
      if (!parsed.success) return [];
      const p = parsed.data;
      const age = now - Date.parse(p.syncedAt);
      return !p.demo &&
        p.currency === 'USD' &&
        p.priceCents > 0 &&
        age >= 0 &&
        age <= 36 * 3600000 &&
        p.countries.every(isCountryCode)
        ? [p]
        : [];
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!plans.length) throw new Error('Current retail catalogue unavailable.');
  if (new Set(plans.map((p) => p.id)).size !== plans.length)
    throw new Error('Duplicate public plan IDs.');
  const updatedAt = new Date(Math.max(...plans.map((p) => Date.parse(p.syncedAt)))).toISOString();
  const common = plans.map((p) => ({
    externalId: p.id,
    name: p.name,
    countryIso2: [...p.countries].sort(),
    dataType: p.dataType,
    dataMb: p.dataType === 'fixed' ? Math.round(p.dataGb * 1024) : null,
    ...(p.dataType === 'daily'
      ? { dailyDataMb: Math.round(p.dataGb * 1024), dailyPolicy: p.dailyPolicy }
      : {}),
    validityDays: p.days,
    price: (p.priceCents / 100).toFixed(2),
    currency: 'USD',
    checkoutUrl: site + '/plans/' + encodeURIComponent(p.id),
    networks: [...p.networks],
    fairUse: p.fairUse,
    activation: p.activation,
    updatedAt: p.syncedAt,
    ...(structuredFairUse(p) ? { fairUsePolicy: structuredFairUse(p) } : {}),
  }));
  const revision = createHash('sha256').update(JSON.stringify(common)).digest('hex');
  if (format === 'inbox') {
    // The inbox contract cannot faithfully express every supplier fair-use policy.
    // Publish fixed, single-country plans only rather than invent speed or unlimited fields.
    const fixed = plans.filter((p) => p.dataType === 'fixed' && p.countries.length === 1);
    if (!fixed.length) throw new Error('No compatible current plans.');
    return {
      brand: 'Alozuri',
      website: site,
      updated: updatedAt,
      revision,
      plans: fixed.map((p) => ({
        country: p.countries[0],
        data_gb: p.dataGb,
        days: p.days,
        price: p.priceCents / 100,
        currency: 'USD',
        url: site + '/plans/' + encodeURIComponent(p.id),
        ...(p.networks.length ? { network: p.networks.join(', ') } : {}),
      })),
    };
  }
  const published = format === 'rating' ? common.filter((p) => p.dataType === 'fixed') : common;
  if (!published.length) throw new Error('No compatible current plans.');
  return {
    provider,
    updatedAt,
    revision,
    updateCadence: 'Daily catalogue sync; served from the current retail catalogue.',
    structuredFairUseComplete: plans.every(
      (p) => p.dataType === 'fixed' || structuredFairUse(p) !== null,
    ),
    countries: [...new Set(plans.flatMap((p) => p.countries))]
      .sort()
      .map((iso2) => ({ iso2, name: countryName(iso2) })),
    plans: published,
  };
}
