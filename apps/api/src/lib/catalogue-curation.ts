import { createHash } from 'node:crypto';
import type { StoredPlan } from '../../../../packages/shared/src/index.ts';
import { profitable } from './pricing.js';

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value) ?? 'null';
}
export const decisionHash = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');
// Include unknown supplier service fields: new restrictions prevent merging until reviewed.
export function supplierComparison(
  source: Record<string, unknown>,
): StoredPlan['supplierComparison'] {
  const required = [
    'locationNetworkList',
    'speed',
    'ipExport',
    'unusedValidTime',
    'activeType',
    'cancelPolicy',
    'supportTopUpType',
    'smsStatus',
  ];
  if (
    required.some((key) => source[key] === undefined || source[key] === null) ||
    !Array.isArray(source.locationNetworkList) ||
    !source.locationNetworkList.length ||
    typeof source.supportTopUpType !== 'number' ||
    ![1, 2, 3].includes(source.supportTopUpType)
  )
    return undefined;
  if (
    ['speed', 'ipExport'].some(
      (key) => typeof source[key] !== 'string' || !String(source[key]).trim(),
    ) ||
    typeof source.unusedValidTime !== 'number' ||
    !Number.isSafeInteger(source.unusedValidTime) ||
    source.unusedValidTime < 0 ||
    (source.dataType === 2 && (typeof source.fupPolicy !== 'string' || !source.fupPolicy.trim()))
  )
    return undefined;
  const ignored = new Set([
    'packageCode',
    'slug',
    'name',
    'price',
    'currencyCode',
    'retailPrice',
    'favorite',
    'volume',
    'fupPolicy',
    'description',
    'descriptionList',
    'supportTopUpType',
  ]);
  const attributes = Object.fromEntries(Object.entries(source).filter(([k]) => !ignored.has(k)));
  // Only documented unordered collections are sorted. Preserve unknown array
  // order because it may encode a meaningful restriction or sequence.
  attributes.locationNetworkList = source.locationNetworkList
    .map((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      const row: Record<string, unknown> = Object.fromEntries(Object.entries(value));
      if (Array.isArray(row.operatorList))
        row.operatorList = [...row.operatorList].sort((a, b) =>
          canonical(a).localeCompare(canonical(b)),
        );
      return row;
    })
    .sort((a, b) => canonical(a).localeCompare(canonical(b)));
  if (source.description && source.description !== source.name)
    attributes.description = source.description;
  if (Array.isArray(source.descriptionList) && source.descriptionList.length)
    attributes.descriptionList = source.descriptionList;
  if (typeof attributes.location === 'string')
    attributes.location = attributes.location
      .split(',')
      .map((c) => c.trim())
      .sort();
  const fup = typeof source.fupPolicy === 'string' ? source.fupPolicy.trim().toLowerCase() : '';
  const match = /^(\d+(?:\.\d+)?)\s*(kbps|mbps)$/.exec(fup);
  const fupKbps = match ? Number(match[1]) * (match[2] === 'mbps' ? 1000 : 1) : null;
  // Keep unrecognised naming qualifiers (business, app-only, special networks,
  // etc.). Only remove labels already represented by verified service fields.
  const title = String(source.name ?? '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:GB|MB)(?:\/Day)?\b/gi, '')
    .replace(/\b\d+\s*Days?\b/gi, '')
    .replace(/\bFUP(\d+(?:\.\d+)?)(K|M)bps\b/gi, (tag, quantity: string, unit: string) =>
      Number(quantity) * (unit.toLowerCase() === 'm' ? 1000 : 1) === fupKbps ? '' : tag,
    )
    .replace(source.ipExport === 'US' && source.location === 'US' ? /\s*\(USIP\)/gi : /$^/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return {
    key: decisionHash({ attributes, title }),
    fup: match ? `${Number(match[1]) * (match[2] === 'mbps' ? 1000 : 1)} kbps` : fup,
    fupKbps,
    topupType: source.supportTopUpType,
    attributes,
  };
}
export function curationKey(plan: StoredPlan): string {
  return plan.supplierComparison
    ? decisionHash({
        service: plan.supplierComparison.key,
        countries: [...plan.countries].sort(),
        days: plan.days,
        type: plan.dataType,
        policy: plan.dailyPolicy ?? null,
        activation: plan.activation,
        networks: [...plan.networks].sort(),
        notes: plan.supplierNotes ?? '',
      })
    : plan.id;
}
const speedAtLeast = (a: StoredPlan, b: StoredPlan) => {
  if (a.supplierComparison?.fup === b.supplierComparison?.fup) return true;
  return (
    a.dataType === 'daily' &&
    a.dailyPolicy === 'reduced' &&
    a.supplierComparison?.fupKbps !== null &&
    b.supplierComparison?.fupKbps !== null &&
    typeof a.supplierComparison?.fupKbps === 'number' &&
    typeof b.supplierComparison?.fupKbps === 'number' &&
    a.supplierComparison.fupKbps >= b.supplierComparison.fupKbps
  );
};
// Documented values: 1=no top-up, 2=yes, 3=yes with periodNum.
// Types 2 and 3 have different conditions and are not interchangeable.
const topupAtLeast = (a: StoredPlan, b: StoredPlan) =>
  a.supplierComparison?.topupType === b.supplierComparison?.topupType ||
  (b.supplierComparison?.topupType === 1 && [2, 3].includes(a.supplierComparison?.topupType ?? 0));
export function curateCatalogue(source: StoredPlan[]): StoredPlan[] {
  const result = source.map((p) => ({
    ...p,
    catalogueVisibility: 'public' as 'public' | 'hidden',
    catalogueDecision: !p.active
      ? 'review_required'
      : p.supplierComparison
        ? 'useful_variant'
        : 'comparison_incomplete',
    replacedBy: null as string | null,
  }));
  const groups = new Map<string, typeof result>();
  for (const p of result) {
    if (!p.active || !p.supplierComparison) continue;
    const key = curationKey(p),
      group = groups.get(key) ?? [];
    group.push(p);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const exact = new Map<string, StoredPlan>();
    // The cheapest supplier wins exact equivalence; deterministic IDs resolve ties.
    for (const p of [...group].sort(
      (a, b) => a.wholesaleUnits - b.wholesaleUnits || a.id.localeCompare(b.id),
    )) {
      const key = canonical([p.dataGb, p.supplierComparison?.fup, p.supplierComparison?.topupType]);
      const winner = exact.get(key);
      if (winner) {
        p.catalogueVisibility = 'hidden';
        p.catalogueDecision = 'equivalent_higher_cost';
        p.replacedBy = winner.id;
      } else exact.set(key, p);
    }
    const visible = group
      .filter((p) => p.catalogueVisibility === 'public')
      .sort(
        (a, b) =>
          b.dataGb - a.dataGb ||
          (b.supplierComparison?.fupKbps ?? 0) - (a.supplierComparison?.fupKbps ?? 0) ||
          a.priceCents - b.priceCents ||
          a.id.localeCompare(b.id),
      );
    for (const inferior of visible) {
      const superior = visible
        .filter(
          (p) =>
            p.id !== inferior.id &&
            p.catalogueVisibility === 'public' &&
            p.dataGb >= inferior.dataGb &&
            speedAtLeast(p, inferior) &&
            topupAtLeast(p, inferior) &&
            (p.dataGb > inferior.dataGb ||
              !speedAtLeast(inferior, p) ||
              !topupAtLeast(inferior, p)) &&
            p.priceCents <= inferior.priceCents,
        )
        .sort(
          (a, b) => a.priceCents - b.priceCents || b.dataGb - a.dataGb || a.id.localeCompare(b.id),
        )[0];
      if (!superior) continue;
      const discounted = superior.priceCents - 50;
      if (
        inferior.priceOverrideUsdCents === null &&
        profitable(inferior.wholesaleUnits, discounted)
      ) {
        inferior.priceAdjustmentUsdCents =
          (inferior.priceAdjustmentUsdCents ?? 0) + discounted - inferior.priceCents;
        inferior.priceAdjustmentReason = 'value';
        inferior.priceCents = discounted;
        inferior.sellingPriceUsdCents = discounted;
        inferior.catalogueDecision = 'value_discount';
      } else {
        inferior.catalogueVisibility = 'hidden';
        inferior.catalogueDecision = 'inferior_at_price';
        inferior.replacedBy = superior.id;
      }
    }
  }
  const byId = new Map(result.map((p) => [p.id, p]));
  for (const p of result) {
    const visited = new Set([p.id]);
    while (p.replacedBy && byId.get(p.replacedBy)?.replacedBy && !visited.has(p.replacedBy)) {
      visited.add(p.replacedBy);
      p.replacedBy = byId.get(p.replacedBy)!.replacedBy;
    }
  }
  return result;
}

// Reject publication if a regression reintroduces contradictory visible offers.
export function assertCuratedCatalogue(source: StoredPlan[]): void {
  const groups = new Map<string, StoredPlan[]>();
  for (const p of source) {
    if (!p.active || p.catalogueVisibility === 'hidden') continue;
    if (
      !profitable(p.wholesaleUnits, p.priceCents) ||
      (p.dataType !== 'unlimited' && p.dataGb <= 0) ||
      (p.dataType === 'daily' && !p.dailyPolicy)
    )
      throw new Error('Invalid public pricing or allowance.');
    if (!p.supplierComparison) continue;
    const key = curationKey(p),
      group = groups.get(key) ?? [];
    group.push(p);
    groups.set(key, group);
  }
  for (const group of groups.values())
    for (const a of group)
      for (const b of group) {
        if (a.id === b.id) continue;
        if (
          a.dataGb === b.dataGb &&
          a.supplierComparison?.fup === b.supplierComparison?.fup &&
          a.supplierComparison?.topupType === b.supplierComparison?.topupType
        )
          throw new Error('Duplicate public service variants.');
        if (
          a.dataGb >= b.dataGb &&
          speedAtLeast(a, b) &&
          topupAtLeast(a, b) &&
          a.priceCents <= b.priceCents
        )
          throw new Error('Inferior public price relationship.');
      }
}
