import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  searchState,
  type SearchState,
  type CartLine,
  type Plan,
  MAX_QUANTITY,
  MAX_CART_UNITS,
} from '@voyaspan/shared';
const itinerary = createSlice({
  name: 'itinerary',
  initialState: { ...searchState(), initialized: false },
  reducers: {
    setCountries(state, action: PayloadAction<string[]>) {
      const list = [...new Set(action.payload.map((c) => c.toUpperCase()))];
      return list.length > 1
        ? searchState(state.single, list, 'trip')
        : searchState(list[0] ?? null, state.trip.length ? state.trip : list, 'country');
    },
    restoreSearch(_state, action: PayloadAction<SearchState>) {
      return action.payload;
    },
    switchSearch(state, action: PayloadAction<'country' | 'trip'>) {
      state.initialized = true;
      state.chooseTrip = false;
      if (action.payload === 'country' && state.mode === 'trip' && state.countries.length > 1) {
        state.chooseSingle = true;
        return;
      }
      if (action.payload === 'trip' && state.trip.length < 2) {
        state.trip = state.trip.length ? state.trip : state.single ? [state.single] : [];
        state.mode = 'trip';
        state.countries = [...state.trip];
        state.chooseTrip = true;
        state.chooseSingle = false;
        return;
      }
      if (action.payload === 'country' && state.mode === 'trip' && state.trip.length === 1)
        state.single = state.trip[0];
      state.mode = action.payload;
      state.countries =
        state.mode === 'trip' ? [...state.trip] : state.single ? [state.single] : [];
      state.chooseSingle = false;
    },
    chooseCountry(state, action: PayloadAction<string>) {
      if (state.chooseTrip) {
        state.trip = [...new Set([...state.trip, action.payload])];
        state.mode = 'trip';
        state.countries = [...state.trip];
        state.chooseTrip = state.trip.length < 2;
        state.initialized = true;
        return;
      }
      if (state.chooseSingle || state.mode === 'country') {
        state.single = action.payload;
        state.mode = 'country';
        state.countries = [action.payload];
        state.chooseSingle = false;
      } else {
        state.trip = [...new Set([...state.trip, action.payload])];
        state.countries = [...state.trip];
      }
      state.initialized = true;
    },
    removeCountry(state, action: PayloadAction<string>) {
      if (state.mode === 'trip') {
        state.trip = state.trip.filter((c) => c !== action.payload);
        state.countries = [...state.trip];
        state.chooseTrip = state.trip.length < 2;
      } else {
        state.single = null;
        state.countries = [];
      }
    },
  },
});
const cart = createSlice({
  name: 'cart',
  initialState: { items: [] as CartLine[], ready: false, syncing: false, error: '', version: 0 },
  reducers: {
    cartSyncing(state, action: PayloadAction<boolean>) {
      state.syncing = action.payload;
    },
    restoreCart(state, action: PayloadAction<CartLine[]>) {
      state.items = action.payload;
      state.ready = true;
    },
    setCartVersion(state, action: PayloadAction<number>) {
      state.version = action.payload;
    },
    cartError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
    addToCart(state, action: PayloadAction<Plan>) {
      const plan = action.payload;
      if (plan.demo) {
        state.error = 'Sample plans cannot be purchased.';
        return;
      }
      const existing = state.items.find((i) => i.plan.id === plan.id);
      if (
        (existing?.quantity || 0) >= MAX_QUANTITY ||
        state.items.reduce((n, i) => n + i.quantity, 0) >= MAX_CART_UNITS
      ) {
        state.error = 'Cart limit reached: five per plan and ten eSIMs per order.';
        return;
      }
      if (existing) existing.quantity++;
      else state.items.push({ plan, quantity: 1 });
      state.error = '';
    },
    quantityChanged(state, action: PayloadAction<{ id: string; quantity: number }>) {
      const line = state.items.find((i) => i.plan.id === action.payload.id);
      if (!line) return;
      const n = action.payload.quantity;
      if (
        n < 1 ||
        n > MAX_QUANTITY ||
        !Number.isInteger(n) ||
        state.items.reduce((sum, i) => sum + i.quantity, 0) - line.quantity + n > MAX_CART_UNITS
      ) {
        state.error = 'Cart limit reached.';
        return;
      }
      line.quantity = n;
      state.error = '';
    },
    removeFromCart(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.plan.id !== action.payload);
      state.error = '';
    },
    clearCart(state) {
      state.items = [];
      state.error = '';
    },
  },
});
export const { setCountries, restoreSearch, switchSearch, chooseCountry, removeCountry } =
  itinerary.actions;
export const {
  cartSyncing,
  restoreCart,
  setCartVersion,
  cartError,
  addToCart,
  quantityChanged,
  removeFromCart,
  clearCart,
} = cart.actions;
export const makeStore = () =>
  configureStore({ reducer: { itinerary: itinerary.reducer, cart: cart.reducer } });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
