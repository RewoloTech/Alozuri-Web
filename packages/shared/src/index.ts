export type Country = { code: string; name: string; flag: string; region: string };
export const countries: Country[] = [
  ['GB', 'United Kingdom', '🇬🇧', 'Europe'],
  ['FR', 'France', '🇫🇷', 'Europe'],
  ['IT', 'Italy', '🇮🇹', 'Europe'],
  ['ES', 'Spain', '🇪🇸', 'Europe'],
  ['PT', 'Portugal', '🇵🇹', 'Europe'],
  ['DE', 'Germany', '🇩🇪', 'Europe'],
  ['GR', 'Greece', '🇬🇷', 'Europe'],
  ['CH', 'Switzerland', '🇨🇭', 'Europe'],
  ['NL', 'Netherlands', '🇳🇱', 'Europe'],
  ['AT', 'Austria', '🇦🇹', 'Europe'],
  ['BE', 'Belgium', '🇧🇪', 'Europe'],
  ['IE', 'Ireland', '🇮🇪', 'Europe'],
  ['PL', 'Poland', '🇵🇱', 'Europe'],
  ['RO', 'Romania', '🇷🇴', 'Europe'],
  ['MD', 'Moldova', '🇲🇩', 'Europe'],
  ['TR', 'Turkey', '🇹🇷', 'Europe'],
  ['US', 'United States', '🇺🇸', 'Americas'],
  ['CA', 'Canada', '🇨🇦', 'Americas'],
  ['MX', 'Mexico', '🇲🇽', 'Americas'],
  ['BR', 'Brazil', '🇧🇷', 'Americas'],
  ['JP', 'Japan', '🇯🇵', 'Asia'],
  ['TH', 'Thailand', '🇹🇭', 'Asia'],
  ['SG', 'Singapore', '🇸🇬', 'Asia'],
  ['KR', 'South Korea', '🇰🇷', 'Asia'],
  ['VN', 'Vietnam', '🇻🇳', 'Asia'],
  ['ID', 'Indonesia', '🇮🇩', 'Asia'],
  ['CN', 'China', '🇨🇳', 'Asia'],
  ['IN', 'India', '🇮🇳', 'Asia'],
  ['AE', 'United Arab Emirates', '🇦🇪', 'Middle East'],
  ['AU', 'Australia', '🇦🇺', 'Oceania'],
  ['NZ', 'New Zealand', '🇳🇿', 'Oceania'],
  ['ZA', 'South Africa', '🇿🇦', 'Africa'],
  ['EG', 'Egypt', '🇪🇬', 'Africa'],
  ['MA', 'Morocco', '🇲🇦', 'Africa'],
].map(([code, name, flag, region]) => ({ code, name, flag, region }));
export function countryName(code: string) {
  return (
    countries.find((c) => c.code === code)?.name ??
    new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ??
    code
  );
}
export type Plan = {
  id: string;
  name: string;
  countries: string[];
  dataGb: number;
  days: number;
  priceCents: number;
  currency: 'USD';
  dataType: 'fixed' | 'daily' | 'unlimited';
  dailyPolicy?: 'reduced' | 'cutoff';
  supplierNotes?: string;
  activation: string;
  networks: string[];
  fairUse: string;
  demo?: boolean;
  syncedAt: string;
};
export type StoredPlan = Plan & {
  supplierCode: string;
  wholesaleUnits: number;
  active: boolean;
  providerId?: string;
};
export function retailPlan(plan: StoredPlan): Plan {
  const {
    id,
    name,
    countries,
    dataGb,
    days,
    priceCents,
    currency,
    dataType,
    dailyPolicy,
    supplierNotes,
    activation,
    networks,
    fairUse,
    demo,
    syncedAt,
  } = plan;
  return {
    id,
    name,
    countries,
    dataGb,
    days,
    priceCents,
    currency,
    dataType,
    ...(dailyPolicy ? { dailyPolicy } : {}),
    ...(supplierNotes ? { supplierNotes } : {}),
    activation,
    networks,
    fairUse,
    ...(demo ? { demo: true } : {}),
    syncedAt,
  };
}
export function normalizeCountries(input: string[]) {
  return [...new Set(input.map((x) => x.trim().toUpperCase()).filter(Boolean))];
}
export type DataFilter = 'all' | 'fixed' | 'daily' | 'unlimited';
export const DATA_ALLOWANCES = [
  'all',
  '1',
  '3',
  '5',
  '10',
  '20',
  '50',
  'daily',
  'unlimited',
] as const;
export type DataAllowance = (typeof DATA_ALLOWANCES)[number];
export function allowanceFilter(value: DataAllowance): { minGb: number; dataType: DataFilter } {
  return value === 'all' || value === 'daily' || value === 'unlimited'
    ? { minGb: 0, dataType: value }
    : { minGb: Number(value), dataType: 'fixed' };
}
export function dataLabel(plan: Plan): string {
  if (plan.dataType === 'unlimited') return 'Unlimited';
  if (plan.dataType === 'daily')
    return plan.dailyPolicy === 'reduced'
      ? `Unlimited · ${plan.dataGb} GB/day high-speed`
      : `${plan.dataGb} GB/day`;
  return `${plan.dataGb} GB`;
}
export function comparePlanValue(a: Plan, b: Plan): number {
  const cost = (p: Plan) =>
    p.dataType === 'fixed' && p.dataGb > 0 ? p.priceCents / p.dataGb : Infinity;
  return cost(a) - cost(b) || a.priceCents - b.priceCents;
}
export function matchPlans(
  plans: Plan[],
  selected: string[],
  minGb = 0,
  dataType: DataFilter = 'all',
): Plan[] {
  const required = normalizeCountries(selected);
  if (
    !required.length ||
    required.some((c) => !isCountryCode(c)) ||
    !Number.isFinite(minGb) ||
    minGb < 0
  )
    return [];
  return plans
    .filter((p) => {
      if (!required.every((c) => p.countries.includes(c))) return false;
      if (dataType === 'unlimited')
        return (
          p.dataType === 'unlimited' || (p.dataType === 'daily' && p.dailyPolicy === 'reduced')
        );
      if (dataType === 'daily') return p.dataType === 'daily' && p.dataGb >= minGb;
      if (dataType === 'fixed' || minGb > 0) return p.dataType === 'fixed' && p.dataGb >= minGb;
      return true;
    })
    .sort(comparePlanValue);
}
// Supplier units are 1/10,000 USD. Retail amounts are integer USD cents.
export function priceRetail(wholesaleUnits: number, markup = 1.8, minimumMargin = 0.3): number {
  if (
    !Number.isSafeInteger(wholesaleUnits) ||
    wholesaleUnits <= 0 ||
    !Number.isFinite(markup) ||
    markup < 1 ||
    !Number.isFinite(minimumMargin) ||
    minimumMargin < 0 ||
    minimumMargin >= 1
  )
    throw new Error('Invalid pricing inputs');
  return Math.ceil(
    Math.max((wholesaleUnits / 100) * markup, wholesaleUnits / 100 / (1 - minimumMargin)),
  );
}
export const orderStates = [
  'created',
  'checkout_pending',
  'paid',
  'fulfilling',
  'provision_wait',
  'ready',
  'provision_error',
  'refund_pending',
  'refunded',
  'expired',
] as const;
export type OrderState = (typeof orderStates)[number];
const transitions: Record<OrderState, readonly OrderState[]> = {
  created: ['checkout_pending', 'expired'],
  checkout_pending: ['paid', 'expired'],
  expired: ['paid'],
  paid: ['fulfilling', 'refund_pending', 'provision_error'],
  fulfilling: ['provision_wait', 'provision_error', 'refund_pending'],
  provision_wait: ['ready', 'provision_error', 'refund_pending'],
  ready: ['refund_pending', 'refunded'],
  provision_error: ['fulfilling', 'refund_pending', 'refunded'],
  refund_pending: ['refunded'],
  refunded: [],
};
export function canTransition(from: OrderState, to: OrderState) {
  return transitions[from].includes(to);
}
export type CustomerOrder = {
  id: string;
  plan: Plan;
  status: OrderState;
  createdAt: string;
  amountCents: number;
  currency: string;
  refundRequested?: boolean;
  test?: boolean;
};
export const money = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

// Firebase Auth exposes a single displayName; validate both form fields before combining them.
export function accountName(firstName: unknown, lastName: unknown): string {
  const parts = [firstName, lastName].map((part) => {
    if (typeof part !== 'string') throw new Error('Enter your first and last name.');
    const value = part.trim().replace(/\s+/g, ' ');
    if (!value || value.length > 50 || /[\p{Cc}\p{Cf}<>]/u.test(part))
      throw new Error('Enter a valid first and last name, up to 50 characters each.');
    return value;
  });
  return parts.join(' ');
}

// Existing and Google accounts only have displayName. Suggested parts remain editable.
export function nameFields(displayName: string | null) {
  const [firstName = '', ...rest] = (displayName || '').trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

export function suggestedPlans(plans: Plan[], limit = 4): Plan[] {
  const candidates = [...plans]
    .filter((p) => p.dataType === 'fixed' && p.dataGb >= 1)
    .sort(
      (a, b) =>
        a.priceCents - b.priceCents || a.countries.length - b.countries.length || b.days - a.days,
    );
  const chosen: Plan[] = [];
  for (const target of [1, 3, 5, 10, 20, 50]) {
    const next = candidates
      .filter((p) => p.dataGb >= target && !chosen.some((c) => c.dataGb === p.dataGb))
      .sort(
        (a, b) =>
          a.dataGb - b.dataGb ||
          a.priceCents - b.priceCents ||
          a.countries.length - b.countries.length,
      )[0];
    if (next) chosen.push(next);
    if (chosen.length >= limit) break;
  }
  return chosen.length ? chosen : plans.slice(0, limit);
}
export function isCountryCode(code: string): boolean {
  return (
    /^[A-Z]{2}$/.test(code) &&
    !['ZZ', 'XA', 'XB'].includes(code) &&
    Boolean(new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' }).of(code))
  );
}

export {
  cartItems,
  mergeCartItems,
  coverageLabel,
  searchState,
  readSearch,
  MAX_QUANTITY,
  MAX_CART_UNITS,
  SUPPORTED_CURRENCIES,
} from './commerce.ts';
export type { CartLine, CartItem, SearchState } from './commerce.ts';
