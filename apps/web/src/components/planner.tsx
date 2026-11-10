'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  type Plan,
  type Country,
  suggestedPlans,
  readSearch,
  coverageLabel,
  dataLabel,
  comparePlanValue,
  allowanceFilter,
  DATA_ALLOWANCES,
  type DataAllowance,
} from '@voyaspan/shared';
import { demoPlans } from '@voyaspan/shared/demo';
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
  const saved = useSelector((s: RootState) => s.itinerary);
  const [error, setError] = useState('');
  const mode = saved.mode;
  const selected = saved.countries;
  const initialKey = initialCountries.join(',');
  useEffect(() => {
    const restore = () => {
      const parsed = readSearch(new URLSearchParams(window.location.search));
      if (parsed) dispatch(restoreSearch(parsed));
    };
    if (readSearch(new URLSearchParams(window.location.search))) restore();
    else if (destinationMode && initialKey) dispatch(setCountries(initialKey.split(',')));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [dispatch, destinationMode, initialKey]);
  function syncUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', saved.mode);
    url.searchParams.set('countries', saved.countries.join(','));
    url.searchParams.set('single', saved.single || '');
    url.searchParams.set('trip', saved.trip.join(','));
    window.history.pushState({}, '', url);
  }
  useEffect(() => {
    if (!saved.initialized) return;
    const url = new URL(window.location.href);
    const next = new URLSearchParams(url.search);
    next.set('mode', saved.mode);
    next.set('countries', saved.countries.join(','));
    next.set('single', saved.single || '');
    next.set('trip', saved.trip.join(','));
    if (next.toString() !== url.searchParams.toString()) {
      url.search = next.toString();
      window.history.pushState({}, '', url);
    }
  }, [saved]);
  const [availableCountries, setAvailableCountries] = useState<Country[]>(
    demoMode ? countries : [],
  );
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (!demoMode)
      void api<{ countries: Country[] }>('/v1/countries')
        .then((r) => setAvailableCountries(r.countries))
        .catch(() => setError('Destinations could not be loaded. Refresh the page and try again.'));
  }, []);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [allowance, setAllowance] = useState<DataAllowance>('all');
  useEffect(() => {
    const restore = () => {
      const value = new URLSearchParams(window.location.search).get('allowance');
      setAllowance(DATA_ALLOWANCES.find((v) => v === value) || 'all');
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const requestVersion = useRef(0);
  const selectionKey = selected.join(',');
  const [results, setResults] = useState<Plan[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState('recommended');
  const picker = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) {
      if (picker.current && !picker.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const filtered = availableCountries.filter(
    (c) =>
      ((mode === 'country' && !saved.chooseTrip) ||
        saved.chooseSingle ||
        !selected.includes(c.code)) &&
      `${c.name} ${c.code}`.toLowerCase().includes(query.toLowerCase()),
  );
  const sorted = useMemo(
    () =>
      results
        ? [...results].sort((a, b) =>
            sort === 'price' || sort === 'recommended'
              ? a.priceCents - b.priceCents
              : sort === 'data'
                ? a.dataType === 'unlimited'
                  ? -1
                  : b.dataType === 'unlimited'
                    ? 1
                    : b.dataGb - a.dataGb
                : comparePlanValue(a, b),
          )
        : null,
    [results, sort],
  );
  function add(code: string) {
    dispatch(chooseCountry(code));
    setOpen(false);
    setQuery('');
    setResults(null);
    setShowAll(false);
  }
  useEffect(() => {
    requestVersion.current++;
    setResults(null);
    setLoading(false);
  }, [selectionKey, mode]);
  async function search(value: DataAllowance = allowance) {
    const { minGb, dataType } = allowanceFilter(value);
    const version = ++requestVersion.current;
    syncUrl();
    const url = new URL(window.location.href);
    url.searchParams.set('allowance', value);
    window.history.replaceState({}, '', url);
    if (saved.chooseTrip) {
      setError('Add at least two destinations for a multi-country search.');
      setOpen(true);
      return;
    }
    if (saved.chooseSingle) {
      setError('Choose one country before searching in single-destination mode.');
      setOpen(true);
      return;
    }
    if (!selected.length) {
      setError('Add at least one destination to find your eSIM.');
      setOpen(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const plans = demoMode
        ? matchPlans(demoPlans, selected, minGb, dataType)
        : (
            await api<{ plans: Plan[] }>(
              `/v1/packages/match?countries=${selected.join(',')}&minGb=${minGb}&dataType=${dataType}`,
            )
          ).plans;
      if (version !== requestVersion.current) return;
      setResults(plans);
      setShowAll(false);
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
      if (version === requestVersion.current)
        setError(e instanceof Error ? e.message : 'Could not find plans. Please try again.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }
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
              setResults(null);
            }}
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
              setResults(null);
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
                        setResults(null);
                      }}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
                <button className="add-country" aria-expanded={open} onClick={() => setOpen(!open)}>
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
                <div className="country-popover">
                  <div className="country-search">
                    <Search size={17} />
                    <input
                      aria-label="Search countries"
                      placeholder="Search a country…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
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
                  <div className="country-options">
                    {filtered.map((c) => (
                      <button key={c.code} onClick={() => add(c.code)}>
                        <span>
                          {c.flag} {c.name}
                        </span>
                        <Plus size={14} />
                      </button>
                    ))}
                    {!filtered.length && <p>No matching destinations.</p>}
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
                    if (results !== null) void search(value);
                  }}
                >
                  <option value="all">All data plans</option>
                  <option value="1">1 GB or more</option>
                  <option value="3">3 GB or more</option>
                  <option value="5">5 GB or more</option>
                  <option value="10">10 GB or more</option>
                  <option value="20">20 GB or more</option>
                  <option value="50">50 GB or more</option>
                  <option value="daily">Daily data plans</option>
                  <option value="unlimited">Unlimited (check fair use)</option>
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
                  {sorted.length
                    ? `${sorted.length} plans. Every stop covered.`
                    : 'No complete match for this itinerary'}
                </h2>
                <p>
                  {sorted.length
                    ? `Covers all your selected countries: ${selected.map(countryName).join(', ')}.`
                    : 'No plans match every selected country and this allowance. Try another allowance or destination combination.'}
                </p>
              </div>
              {sorted.length > 0 && (
                <label className="sort-control">
                  <SlidersHorizontal size={16} />
                  <select
                    aria-label="Sort plans"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="recommended">Recommended data sizes</option>
                    <option value="value">Best value per GB</option>
                    <option value="price">Lowest total price</option>
                    <option value="data">Most data</option>
                  </select>
                </label>
              )}
            </div>
            <div className="plan-grid">
              {(showAll
                ? sorted
                : sort === 'recommended'
                  ? suggestedPlans(sorted)
                  : sorted.slice(0, 4)
              ).map((p, i) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  highlight={i === 0 && sort === 'value' && p.dataType === 'fixed'}
                />
              ))}
            </div>
            {sorted.length > 4 && (
              <button className="button" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show recommendations' : `Show all ${sorted.length} matching plans`}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
export function PlanCard({ plan, highlight = false }: { plan: Plan; highlight?: boolean }) {
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
          <>
            {plan.dataGb}
            <span>GB</span>
          </>
        ) : (
          <span className="plan-allowance">{dataLabel(plan)}</span>
        )}
        <span className="plan-days">{plan.days} days</span>
      </div>
      {plan.dataType !== 'fixed' && <p className="muted">{plan.fairUse}</p>}
      <div className="plan-coverage">
        <Check size={15} /> {coverageLabel(plan)}
      </div>
      <div className="plan-bottom">
        <div>
          <strong>{money(plan.priceCents)}</strong>
          <span> USD{plan.demo ? ' · sample price' : ''}</span>
        </div>
        <Link href={`/plans/${plan.id}`} className="button small">
          View plan <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}
