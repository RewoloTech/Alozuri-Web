import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
const itinerary = createSlice({
  name: 'itinerary',
  initialState: { countries: [] as string[], initialized: false },
  reducers: {
    setCountries(state, action: PayloadAction<string[]>) {
      state.countries = [...new Set(action.payload.map((c) => c.toUpperCase()))];
      state.initialized = true;
    },
  },
});
export const { setCountries } = itinerary.actions;
export const makeStore = () => configureStore({ reducer: { itinerary: itinerary.reducer } });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
