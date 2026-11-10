import type { Plan } from './index.ts';
export type CartLine = { plan: Plan; quantity: number; unavailable?: boolean };
export type CartItem = { planId: string; quantity: number };
export const MAX_QUANTITY = 5;
export const MAX_CART_UNITS = 10;
export const SUPPORTED_CURRENCIES = ['USD'] as const;
export function cartItems(lines: CartLine[]): CartItem[] {
  return lines.map(({ plan, quantity }) => ({ planId: plan.id, quantity }));
}
export function mergeCartItems(a: CartItem[], b: CartItem[]): CartItem[] {
  const items = new Map<string, number>();
  for (const item of [...a, ...b]) {
    if (
      !/^[a-zA-Z0-9_-]{1,100}$/.test(item.planId) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > MAX_QUANTITY
    )
      throw new Error('Invalid cart item.');
    const quantity = (items.get(item.planId) || 0) + item.quantity;
    if (quantity > MAX_QUANTITY) throw new Error('You can purchase up to five of each plan.');
    items.set(item.planId, quantity);
  }
  if ([...items.values()].reduce((a, b) => a + b, 0) > MAX_CART_UNITS)
    throw new Error('You can purchase up to ten eSIMs per order.');
  return [...items].map(([planId, quantity]) => ({ planId, quantity }));
}
export function coverageLabel(plan: Plan) {
  return plan.countries.length === 1 ? 'Local coverage' : 'Multi-country coverage';
}
export type SearchState = {
  mode: 'country' | 'trip';
  single: string | null;
  trip: string[];
  countries: string[];
  initialized: boolean;
  chooseSingle: boolean;
  chooseTrip: boolean;
};
export function searchState(
  single: string | null = null,
  trip: string[] = [],
  mode: 'country' | 'trip' = trip.length > 1 ? 'trip' : 'country',
): SearchState {
  trip = [...new Set(trip)];
  if (mode === 'trip' && trip.length < 2) {
    mode = 'country';
    single = trip[0] ?? single;
  }
  return {
    single,
    trip: [...new Set(trip)],
    mode,
    countries: mode === 'trip' ? [...new Set(trip)] : single ? [single] : [],
    initialized: true,
    chooseSingle: false,
    chooseTrip: false,
  };
}
export function readSearch(params: URLSearchParams): SearchState | null {
  const valid = (s: string) => /^[A-Z]{2}$/.test(s);
  const selected = (params.get('countries') || '').split(',').filter(valid);
  if (!params.has('countries') && !params.has('trip') && !params.has('single')) return null;
  const trip = (params.get('trip') || selected.join(',')).split(',').filter(valid);
  const single = params.get('single') || (selected.length === 1 ? selected[0] : null);
  const mode = selected.length > 1 ? 'trip' : params.get('mode') === 'trip' ? 'trip' : 'country';
  const state = searchState(single && valid(single) ? single : null, trip, mode);
  state.chooseTrip = params.get('intent') === 'trip' && state.countries.length < 2;
  state.chooseSingle = params.get('intent') === 'country' && state.mode === 'trip';
  return state;
}
