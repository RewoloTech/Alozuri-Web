'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import { setCountries, type RootState } from '@/lib/store';
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
import { countries, countryName, matchPlans, money, type Plan } from '@voyaspan/shared';
import { demoPlans } from '@voyaspan/shared/demo';
import { api, demoMode } from '@/lib/api';
export function Planner({
  initialCountries = ['GB', 'FR', 'IT'],
  compact = false,
  destinationMode = false,
}: {
  initialCountries?: string[];
  compact?: boolean;
  destinationMode?: boolean;
}) {
  const [mode, setMode] = useState<'trip' | 'country'>(destinationMode ? 'country' : 'trip');
  const dispatch = useDispatch();
  const saved = useSelector((s: RootState) => s.itinerary);
  const [selected, updateSelected] = useState(
    destinationMode ? initialCountries : saved.initialized ? saved.countries : initialCountries,
  );
  function setSelected(next: string[]) {
    updateSelected(next);
    dispatch(setCountries(next));
  }
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [minGb, setMinGb] = useState('0');
  const [results, setResults] = useState<Plan[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('value');
  const picker = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) {
      if (picker.current && !picker.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const filtered = countries.filter(
    (c) =>
      !selected.includes(c.code) &&
      `${c.name} ${c.code}`.toLowerCase().includes(query.toLowerCase()),
  );
  const sorted = useMemo(
    () =>
      results
        ? [...results].sort((a, b) =>
            sort === 'price'
              ? a.priceCents - b.priceCents
              : sort === 'data'
                ? b.dataGb - a.dataGb
                : a.priceCents / a.dataGb - b.priceCents / b.dataGb,
          )
        : null,
    [results, sort],
  );
  function add(code: string) {
    setSelected(mode === 'country' ? [code] : [...selected, code]);
    setOpen(false);
    setQuery('');
    setResults(null);
  }
  async function search() {
    dispatch(setCountries(selected));
    if (!selected.length) {
      setError('Add at least one destination to find your eSIM.');
      setOpen(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const plans = demoMode
        ? matchPlans(demoPlans, selected, Number(minGb))
        : (
            await api<{ plans: Plan[] }>(
              `/v1/packages/match?countries=${selected.join(',')}&minGb=${minGb}`,
            )
          ).plans;
      setResults(plans);
      setTimeout(
        () => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        60,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not find plans. Please try again.');
    } finally {
      setLoading(false);
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
              setMode('trip');
              setResults(null);
            }}
            className={mode === 'trip' ? 'active' : ''}
          >
            <Globe2 size={16} />
            Multi-country trip<span className="small-badge">TRIP MATCHER</span>
          </button>
          <button
            onClick={() => {
              setMode('country');
              setSelected(selected.slice(0, 1));
              setResults(null);
            }}
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
          <div className="planner-controls">
            <div className="country-field" ref={picker}>
              <span className="field-label">
                {mode === 'trip' ? 'YOUR DESTINATIONS' : 'YOUR DESTINATION'}
              </span>
              <div className="country-chips">
                {selected.map((code) => (
                  <span className="country-chip" key={code}>
                    <span>{countries.find((c) => c.code === code)?.flag}</span>
                    {countryName(code)}
                    <button
                      aria-label={`Remove ${countryName(code)}`}
                      onClick={() => {
                        setSelected(selected.filter((c) => c !== code));
                        setResults(null);
                      }}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
                <button className="add-country" aria-expanded={open} onClick={() => setOpen(!open)}>
                  <Plus size={16} />
                  {selected.length ? 'Add stop' : 'Choose destination'}
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
                        if (e.key === 'Escape') setOpen(false);
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
                  value={minGb}
                  onChange={(e) => {
                    setMinGb(e.target.value);
                    setResults(null);
                  }}
                >
                  <option value="0">All data plans</option>
                  <option value="3">3 GB or more</option>
                  <option value="5">5 GB or more</option>
                  <option value="10">10 GB or more</option>
                  <option value="20">20 GB or more</option>
                </select>
                <ChevronDown size={16} />
              </span>
            </label>
            <button className="button primary search-button" disabled={loading} onClick={search}>
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
                : 'USD pricing · one-time payment'}
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
                    : 'No fixed-data plans cover all those stops. Try another destination combination or a lower data allowance.'}
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
                    <option value="value">Best value per GB</option>
                    <option value="price">Lowest total price</option>
                    <option value="data">Most data</option>
                  </select>
                </label>
              )}
            </div>
            <div className="plan-grid">
              {sorted.slice(0, 4).map((p, i) => (
                <PlanCard key={p.id} plan={p} highlight={i === 0 && sort === 'value'} />
              ))}
            </div>
            {sorted.length > 4 && (
              <p className="fine-print">
                Showing the first 4 matching plans. Adjust your data allowance or sorting to compare
                more options.
              </p>
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
        {plan.dataGb}
        <span>GB {plan.dataType === 'daily' ? 'per day' : ''}</span>
        <span className="plan-days">{plan.days} days</span>
      </div>
      <div className="plan-coverage">
        <Check size={15} />{' '}
        {plan.countries.length === 1 ? 'Local coverage' : 'One eSIM for your whole itinerary'}
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
