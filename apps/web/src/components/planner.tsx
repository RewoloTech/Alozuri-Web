'use client';
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import {
  setCountries,
  restoreSearch,
  switchSearch,
  chooseCountry,
  removeCountry,
  type RootState,
} from '@/lib/store';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Globe2,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  countries,
  countryName,
  matchPlans,
  money,
  type PlanSummary,
  type SearchPage,
  type SearchSort,
  SEARCH_SORTS,
  filterDestinations,
  planSummary,
  type Country,
  readSearch,
  coverageLabel,
  dataLabel,
  comparePlanValue,
  allowanceFilter,
  DATA_ALLOWANCES,
  type DataAllowance,
} from '@voyaspan/shared';
import { demoPlans } from '@voyaspan/shared/demo';
import { useCurrency } from './currency-provider';
import { api, demoMode } from '@/lib/api';
export function Planner({
  initialCountries = [],
  compact = false,
  destinationMode = false,
}: {
  initialCountries?: string[];
  compact?: boolean;
  destinationMode?: boolean;
}) {
  const dispatch = useDispatch();
  const { currency, refresh } = useCurrency();
  const currencyKey = currency + refresh;
  const previousCurrency = useRef(currencyKey);
  const saved = useSelector((s: RootState) => s.itinerary);
  const [error, setError] = useState('');
  // Tabs show the user's choice immediately; draft validation stays in the shared state.
  const mode = saved.chooseSingle ? 'country' : saved.chooseTrip ? 'trip' : saved.mode;
  const selected = saved.chooseSingle ? [] : saved.countries;
  const [includeRegional, setIncludeRegional] = useState(false);
  const initialKey = initialCountries.join(',');
  useEffect(() => {
    const restore = () => {
      setIncludeRegional(new URLSearchParams(window.location.search).get('coverage') === 'all');
      const parsed = readSearch(new URLSearchParams(window.location.search));
      if (parsed) dispatch(restoreSearch(parsed));
    };
    if (readSearch(new URLSearchParams(window.location.search))) restore();
    else if (destinationMode && initialKey) dispatch(setCountries(initialKey.split(',')));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [dispatch, destinationMode, initialKey]);
  useEffect(() => {
    if (!saved.initialized) return;
    const url = new URL(window.location.href);
    const next = new URLSearchParams(url.search);
    next.set('mode', saved.mode);
    next.set('countries', saved.countries.join(','));
    next.set('single', saved.single || '');
    next.set('trip', saved.trip.join(','));
    next.set('intent', saved.chooseSingle ? 'country' : saved.chooseTrip ? 'trip' : '');
    if (next.toString() !== url.searchParams.toString()) {
      url.search = next.toString();
      window.history.pushState({}, '', url);
    }
  }, [saved]);
  const [countriesLoading, setCountriesLoading] = useState(!demoMode);
  const [availableCountries, setAvailableCountries] = useState<Country[]>(
    demoMode ? countries : [],
  );
  useEffect(() => {
    if (!demoMode)
      void api<{ countries: Country[] }>('/v1/countries')
        .then((r) => setAvailableCountries(r.countries))
        .catch(() => setError('Destinations could not be loaded. Refresh the page and try again.'))
        .finally(() => setCountriesLoading(false));
  }, []);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<SearchPage | null>(null);
  const results = page?.plans ?? null;
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [sort, setSort] = useState<SearchSort>('recommended');
  const controller = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [allowance, setAllowance] = useState<DataAllowance>('all');
  const requestVersion = useRef(0);
  useEffect(() => {
    const restore = () => {
      const value = new URLSearchParams(window.location.search).get('allowance');
      setAllowance(DATA_ALLOWANCES.find((v) => v === value) || 'all');
      setSort(
        SEARCH_SORTS.find((s) => s === new URLSearchParams(window.location.search).get('sort')) ||
          'recommended',
      );
      controller.current?.abort();
      requestVersion.current++;
      setPage(null);
      setLoading(false);
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const selectionKey = selected.join(',');
  const picker = useRef<HTMLDivElement>(null);
  const pickerId = useId();
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) {
      if (picker.current && !picker.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const filtered = filterDestinations(availableCountries, query).filter(
    (c) =>
      (mode === 'country' && !saved.chooseTrip) || saved.chooseSingle || !selected.includes(c.code),
  );
  const sorted = results;
  const total = page?.total ?? 0;
  function add(code: string) {
    dispatch(chooseCountry(code));
    setOpen(false);
    setQuery('');
    setPage(null);
    picker.current?.querySelector<HTMLButtonElement>('.add-country')?.focus();
  }
  useEffect(() => {
    requestVersion.current++;
    controller.current?.abort();
    setPage(null);
    setLoading(false);
    setLoadingMore(false);
    setRefreshRequired(false);
    setError('');
  }, [selectionKey, mode]);
  useEffect(
    () => () => {
      requestVersion.current++;
      controller.current?.abort();
    },
    [],
  );
  async function search(
    value: DataAllowance = allowance,
    regional = includeRegional,
    order: SearchSort = sort,
    cursor?: string,
  ) {
    const { minGb, dataType } = allowanceFilter(value);
    const version = ++requestVersion.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const url = new URL(window.location.href);
    url.searchParams.set('allowance', value);
    url.searchParams.set('coverage', regional ? 'all' : 'local');
    url.searchParams.set('sort', order);
    if (!cursor && url.href !== window.location.href) window.history.pushState({}, '', url);
    if (saved.chooseTrip || saved.chooseSingle || !selected.length) {
      setError(
        saved.chooseTrip
          ? 'Add at least two destinations for a multi-country search.'
          : saved.chooseSingle
            ? 'Choose one country before searching in single-destination mode.'
            : 'Add at least one destination to find your eSIM.',
      );
      setOpen(true);
      return;
    }
    const previous = page;
    if (cursor) setLoadingMore(true);
    else {
      setLoading(true);
      setPage(null);
    }
    setError('');
    setRefreshRequired(false);
    try {
      let response: SearchPage;
      if (demoMode) {
        if (currency !== 'USD') throw new Error('Sample plans are available in USD only.');
        const matches = matchPlans(demoPlans, selected, minGb, dataType).filter(
          (p) => mode === 'trip' || regional || p.countries.length === 1,
        );
        matches.sort(
          order === 'value'
            ? comparePlanValue
            : order === 'data'
              ? (a, b) => b.dataGb - a.dataGb
              : (a, b) => a.priceCents - b.priceCents,
        );
        const facets = Object.fromEntries(
          DATA_ALLOWANCES.map((k) => {
            const f = allowanceFilter(k);
            return [
              k,
              matchPlans(demoPlans, selected, f.minGb, f.dataType).filter(
                (p) => mode === 'trip' || regional || p.countries.length === 1,
              ).length,
            ];
          }),
        ) as SearchPage['facets'];
        response = {
          plans: matches.map(planSummary),
          total: matches.length,
          nextCursor: null,
          facets,
          revision: 'demo',
        };
      } else {
        const params = new URLSearchParams({
          countries: selected.join(','),
          minGb: String(minGb),
          dataType,
          coverage: mode === 'country' && !regional ? 'local' : 'all',
          sort: order,
          pageSize: '12',
        });
        if (currency !== 'USD') params.set('currency', currency);
        if (cursor) params.set('cursor', cursor);
        response = await api<SearchPage>('/v2/search/plans?' + params, { signal: abort.signal });
      }
      if (version !== requestVersion.current) return;
      if (cursor && previous && response.revision !== previous.revision)
        throw new Error('The catalogue changed. Refresh your search.');
      setPage(
        cursor && previous
          ? { ...response, plans: [...previous.plans, ...response.plans] }
          : response,
      );
      if (!cursor)
        setTimeout(
          () =>
            resultRef.current?.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'auto'
                : 'smooth',
              block: 'start',
            }),
          60,
        );
    } catch (e) {
      if (version === requestVersion.current && !abort.signal.aborted) {
        const message = e instanceof Error ? e.message : 'Could not find plans. Please try again.';
        setError(message);
        if (cursor && /catalogue changed|search page/i.test(message)) {
          setRefreshRequired(true);
          setPage(null);
        }
      }
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }
  const refreshPrices = useEffectEvent(() => {
    if (page !== null || loading) void search();
  });
  useEffect(() => {
    if (previousCurrency.current === currencyKey) return;
    previousCurrency.current = currencyKey;
    refreshPrices();
  }, [currencyKey]);
  return (
    <>
      <section
        className={`planner ${compact ? 'planner-compact' : ''}`}
        id="planner"
        aria-label="Find an eSIM"
      >
        <div className="planner-tabs">
          <button
            onClick={() => {
              dispatch(switchSearch('trip'));
              setPage(null);
            }}
            aria-label="Multi-country trip"
            aria-pressed={mode === 'trip'}
            className={mode === 'trip' ? 'active' : ''}
          >
            <Globe2 size={16} />
            Multi-country trip<span className="small-badge">TRIP MATCHER</span>
          </button>
          <button
            onClick={() => {
              dispatch(switchSearch('country'));
              if (selected.length > 1) setOpen(true);
              setPage(null);
            }}
            aria-pressed={mode === 'country'}
            className={mode === 'country' ? 'active' : ''}
          >
            <MapPin size={16} />
            Single destination
          </button>
        </div>
        <div className="planner-inner">
          <div className="planner-heading">
            <div>
              <h2>{mode === 'trip' ? 'Where are you travelling?' : 'Where are you heading?'}</h2>
              <p>
                {mode === 'trip'
                  ? 'Add every stop. Find one eSIM that covers them all.'
                  : 'Find a data plan for your next destination.'}
              </p>
            </div>
            <span className="planner-doodle">
              <ShieldCheck size={16} /> Every stop. Covered.
            </span>
          </div>
          {saved.chooseTrip && (
            <p className="notice" role="status">
              Add another destination to start a multi-country trip. Your single destination is
              kept.
            </p>
          )}
          {saved.chooseSingle && (
            <p className="notice" role="status">
              Choose one country for a single-destination search. Your multi-country itinerary will
              be kept.
            </p>
          )}
          <div className="planner-controls">
            <div className="country-field" ref={picker}>
              <span className="field-label">
                {mode === 'trip' ? 'YOUR DESTINATIONS' : 'YOUR DESTINATION'}
              </span>
              <div className="country-chips">
                {selected.map((code) => (
                  <span className="country-chip" key={code}>
                    <span>{availableCountries.find((c) => c.code === code)?.flag}</span>
                    {countryName(code)}
                    <button
                      aria-label={`Remove ${countryName(code)}`}
                      onClick={() => {
                        dispatch(removeCountry(code));
                        setPage(null);
                      }}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
                <button
                  className="add-country"
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  aria-controls={open ? pickerId : undefined}
                  onClick={() => setOpen(!open)}
                >
                  <Plus size={16} />
                  {saved.chooseTrip
                    ? 'Add destination'
                    : selected.length
                      ? mode === 'country'
                        ? 'Change destination'
                        : 'Add stop'
                      : 'Choose destination'}
                </button>
              </div>
              {open && (
                <div
                  className="country-popover"
                  id={pickerId}
                  role="dialog"
                  aria-label="Choose a country"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setOpen(false);
                      picker.current?.querySelector<HTMLButtonElement>('.add-country')?.focus();
                    }
                  }}
                >
                  <div className="country-search">
                    <Search size={17} />
                    <input
                      aria-label="Search countries"
                      placeholder="Search a country…"
                      value={query}
                      maxLength={80}
                      onChange={(e) => setQuery(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          picker.current
                            ?.querySelector<HTMLButtonElement>('.country-options button')
                            ?.focus();
                        }
                        if (e.key === 'Enter' && filtered.length === 1) {
                          e.preventDefault();
                          add(filtered[0].code);
                        }
                        if (e.key === 'Escape') {
                          setOpen(false);
                          (
                            picker.current?.querySelector(
                              '.add-country',
                            ) as HTMLButtonElement | null
                          )?.focus();
                        }
                      }}
                    />
                    <button aria-label="Close country search" onClick={() => setOpen(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  <div
                    className="country-options"
                    onKeyDown={(e) => {
                      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                      const buttons = [...e.currentTarget.querySelectorAll('button')];
                      const active = document.activeElement;
                      if (!(active instanceof HTMLButtonElement) || !buttons.length) return;
                      e.preventDefault();
                      const index = buttons.indexOf(active);
                      buttons[
                        (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
                      ]?.focus();
                    }}
                  >
                    {filtered.map((c) => (
                      <button key={c.code} onClick={() => add(c.code)}>
                        <span>
                          {c.flag} {c.name}
                        </span>
                        <Plus size={14} />
                      </button>
                    ))}
                    {countriesLoading ? (
                      <p role="status">Loading destinations…</p>
                    ) : (
                      !filtered.length && <p>No matching destinations.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <label className="data-field">
              <span className="field-label">DATA ALLOWANCE</span>
              <span className="select-wrap">
                <select
                  value={allowance}
                  onChange={(e) => {
                    const value = e.target.value as DataAllowance;
                    setAllowance(value);
                    if (results !== null || loading) void search(value);
                  }}
                >
                  <option value="all">
                    All data plans{page ? ` (${page.facets['all']})` : ''}
                  </option>
                  <option value="1">1 GB or more{page ? ` (${page.facets['1']})` : ''}</option>
                  <option value="3">3 GB or more{page ? ` (${page.facets['3']})` : ''}</option>
                  <option value="5">5 GB or more{page ? ` (${page.facets['5']})` : ''}</option>
                  <option value="10">10 GB or more{page ? ` (${page.facets['10']})` : ''}</option>
                  <option value="20">20 GB or more{page ? ` (${page.facets['20']})` : ''}</option>
                  <option value="50">50 GB or more{page ? ` (${page.facets['50']})` : ''}</option>
                  <option value="daily">
                    Daily data plans{page ? ` (${page.facets['daily']})` : ''}
                  </option>
                  <option value="unlimited">
                    Unlimited (check fair use){page ? ` (${page.facets['unlimited']})` : ''}
                  </option>
                </select>
                <ChevronDown size={16} />
              </span>
            </label>
            <button
              className="button primary search-button"
              disabled={loading}
              onClick={() => void search()}
            >
              {loading ? 'Finding your plans…' : 'Find my eSIM'}
              <ArrowRight size={18} />
            </button>
          </div>
          {mode === 'country' && (
            <label className="checkbox-label" style={{ marginTop: 16 }}>
              <input
                type="checkbox"
                checked={includeRegional}
                onChange={(e) => {
                  setIncludeRegional(e.target.checked);
                  if (results !== null || loading) void search(allowance, e.target.checked);
                }}
              />
              Include regional and global plans covering this country
            </label>
          )}
          <div className="planner-note">
            <span>
              <ShieldCheck size={14} />
              Coverage checked for every selected country
            </span>
            <span>
              {demoMode
                ? 'Preview · sample plans · purchases disabled'
                : 'Verified supplier coverage · Secure Stripe checkout'}
            </span>
          </div>
          {loading && <p role="status">Searching current plans…</p>}
          {refreshRequired && (
            <button className="button" onClick={() => void search()}>
              Refresh results
            </button>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
        </div>
      </section>
      <div ref={resultRef} className="search-results" aria-live="polite">
        {sorted && (
          <>
            <div className="results-heading">
              <div>
                <span className="eyebrow">MATCHED TO YOUR ITINERARY</span>
                <h2>
                  {total
                    ? mode === 'country'
                      ? `${total} ${includeRegional ? 'matching' : 'local'} ${total === 1 ? 'plan' : 'plans'} for ${selected.map(countryName).join(', ')}.`
                      : `${total} ${total === 1 ? 'plan' : 'plans'}. Every stop covered.`
                    : 'No complete match for this itinerary'}
                </h2>
                <p>
                  {total
                    ? mode === 'country' && !includeRegional
                      ? 'These plans cover only your selected country. Enable regional plans to compare broader coverage.'
                      : `Covers all your selected countries: ${selected.map(countryName).join(', ')}.`
                    : mode === 'country' && !includeRegional
                      ? 'No local plan matches this allowance. Enable regional and global plans to compare other options covering this country.'
                      : 'No plans match every selected country and this allowance. Try another allowance or destination combination.'}
                </p>
              </div>
              {sorted.length > 0 && (
                <label className="sort-control">
                  <SlidersHorizontal size={16} />
                  <select
                    aria-label="Sort plans"
                    value={sort}
                    onChange={(e) => {
                      const order = SEARCH_SORTS.find((v) => v === e.target.value) || 'recommended';
                      setSort(order);
                      void search(allowance, includeRegional, order);
                    }}
                  >
                    <option value="recommended">Recommended data sizes</option>
                    <option value="value">Value per GB (fixed data)</option>
                    <option value="price">Lowest total price</option>
                    <option value="data">Most data</option>
                  </select>
                </label>
              )}
            </div>
            <p className="muted" role="status">
              Showing {sorted.length} of {total} matching plans
            </p>
            <div className="plan-grid" aria-live="off">
              {sorted.map((p) => (
                <PlanCard key={p.id} plan={p} />
              ))}
            </div>
            {page?.nextCursor && (
              <button
                className="button"
                disabled={loadingMore}
                onClick={() => void search(allowance, includeRegional, sort, page.nextCursor!)}
              >
                {loadingMore ? 'Loading more…' : `Show more plans (${sorted.length} of ${total})`}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
export function PlanCard({ plan, highlight = false }: { plan: PlanSummary; highlight?: boolean }) {
  return (
    <article className={`plan-card ${highlight ? 'featured' : ''}`}>
      <div className="plan-top">
        <span className="plan-globe">
          <Globe2 size={22} />
        </span>
        {highlight && <span className="small-badge">BEST VALUE / GB</span>}
      </div>
      <h3>{plan.name}</h3>
      <p className="muted">
        {plan.countries.length === 1
          ? countryName(plan.countries[0])
          : `${plan.countries.length} destinations`}{' '}
        · Data only
      </p>
      <div className="plan-data">
        {plan.dataType === 'fixed' ? (
          <span className="plan-fixed-allowance">{dataLabel(plan)}</span>
        ) : (
          <span className="plan-allowance">{dataLabel(plan)}</span>
        )}
        <span className="plan-days">
          {plan.days} {plan.days === 1 ? 'day' : 'days'}
        </span>
      </div>
      {plan.dataType !== 'fixed' && <p className="muted">{plan.fairUse}</p>}
      <div className="plan-coverage">
        <Check size={15} /> {coverageLabel(plan)}
      </div>
      <div className="plan-bottom">
        <div>
          <strong>{money(plan.priceCents, plan.currency)}</strong>
          <span>
            {' '}
            {plan.currency}
            {plan.demo ? ' · sample price' : ''}
          </span>
        </div>
        <Link href={`/plans/${plan.id}`} className="button small">
          View plan <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}
