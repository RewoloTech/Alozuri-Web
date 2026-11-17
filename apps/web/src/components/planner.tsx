'use client';
import { useLocale, useTranslations } from 'next-intl';
import { destinationName } from '@alozuri/shared/i18n/destinations';
import { localeDirection } from '@alozuri/shared/i18n';
import type { Messages } from '@alozuri/shared/i18n/messages';
import { ERROR_MESSAGES, type ErrorCode } from '@alozuri/shared/i18n/errors';
import { StoreApiError } from '@/lib/api-error';
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import Link from '@/components/localized-link';
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
  countryFlag,
  uniqueDestinations,
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
  comparePlanValue,
  allowanceFilter,
  DATA_ALLOWANCES,
  type DataAllowance,
} from '@alozuri/shared';
import { usePlanCopy } from '@/lib/use-plan-copy';
import { demoPlans } from '@alozuri/shared/demo';
import { useCurrency } from './currency-provider';
import { api, demoMode } from '@/lib/api';
type SearchFailure = { key: keyof Messages['search'] } | { code: ErrorCode };
export function Planner({
  initialCountries = [],
  compact = false,
  destinationMode = false,
  simplified = false,
}: {
  initialCountries?: string[];
  compact?: boolean;
  destinationMode?: boolean;
  simplified?: boolean;
}) {
  const errorMessage = useTranslations('errors');
  const t = useTranslations('search');
  const home = useTranslations('home');
  const plans = useTranslations('plans');
  const locale = useLocale();
  const dir = localeDirection(locale);
  const name = (code: string) => destinationName(code, locale);
  const dispatch = useDispatch();
  const { currency, refresh, ready } = useCurrency();
  const currencyKey = currency + refresh + ready;
  const previousCurrency = useRef(currencyKey);
  const saved = useSelector((s: RootState) => s.itinerary);
  const [error, setError] = useState<SearchFailure | null>(null);
  // Tabs show the user's choice immediately; draft validation stays in the shared state.
  const mode = saved.chooseSingle ? 'country' : saved.chooseTrip ? 'trip' : saved.mode;
  const selected = saved.chooseSingle ? [] : saved.countries;
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
  useEffect(() => {
    if (!saved.initialized) return;
    const url = new URL(window.location.href);
    const next = new URLSearchParams(url.search);
    next.set('mode', saved.mode);
    next.set('coverage', mode === 'country' ? 'local' : 'all');
    next.set('countries', saved.countries.join(','));
    next.set('single', saved.single || '');
    next.set('trip', saved.trip.join(','));
    next.set('intent', saved.chooseSingle ? 'country' : saved.chooseTrip ? 'trip' : '');
    if (next.toString() !== url.searchParams.toString()) {
      const selectionUnchanged =
        next.get('mode') === url.searchParams.get('mode') &&
        next.get('countries') === url.searchParams.get('countries') &&
        (next.get('intent') || '') === (url.searchParams.get('intent') || '');
      url.search = next.toString();
      // Normalising an old coverage URL must not trap the browser's Back button.
      if (selectionUnchanged) window.history.replaceState({}, '', url);
      else window.history.pushState({}, '', url);
    }
  }, [saved, mode]);
  const [countriesLoading, setCountriesLoading] = useState(!demoMode);
  const [availableCountries, setAvailableCountries] = useState<Country[]>(
    demoMode ? countries : [],
  );
  useEffect(() => {
    if (!demoMode)
      void api<{ countries: Country[] }>('/v1/countries')
        .then((r) => setAvailableCountries(uniqueDestinations(r.countries)))
        .catch(() => setError({ key: 'destinationsError' }))
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
  const restorePickerFocus = useRef(false);
  const pickerId = useId();
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) {
      if (picker.current && !picker.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  // Search native country names as well as the supplier's English names and ISO codes.
  const nativeCountries = availableCountries.map((country) => ({
    ...country,
    name: name(country.code),
  }));
  const matches = new Set(
    [
      ...filterDestinations(availableCountries, query),
      ...filterDestinations(nativeCountries, query),
    ].map((country) => country.code),
  );
  const filtered = nativeCountries
    .filter((country) => matches.has(country.code))
    .filter(
      (c) =>
        (mode === 'country' && !saved.chooseTrip) ||
        saved.chooseSingle ||
        !selected.includes(c.code),
    );
  const sorted = results;
  const total = page?.total ?? 0;
  const coveringTotal = page?.facets.all ?? 0;
  function add(code: string) {
    dispatch(chooseCountry(code));
    setOpen(false);
    setQuery('');
    setPage(null);
    restorePickerFocus.current = true;
  }
  useEffect(() => {
    if (open || !restorePickerFocus.current) return;
    const frame = requestAnimationFrame(() => {
      picker.current?.querySelector<HTMLButtonElement>('.add-country')?.focus();
      restorePickerFocus.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, selectionKey]);
  useEffect(() => {
    requestVersion.current++;
    controller.current?.abort();
    setPage(null);
    setLoading(false);
    setLoadingMore(false);
    setRefreshRequired(false);
    setError(null);
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
    order: SearchSort = sort,
    cursor?: string,
  ) {
    if (!ready) return;
    const { minGb, dataType } = allowanceFilter(value);
    const version = ++requestVersion.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const url = new URL(window.location.href);
    url.searchParams.set('allowance', value);
    url.searchParams.set('coverage', mode === 'country' ? 'local' : 'all');
    url.searchParams.set('sort', order);
    if (!cursor && url.href !== window.location.href) window.history.pushState({}, '', url);
    if (saved.chooseTrip || saved.chooseSingle || !selected.length) {
      setError({
        key: saved.chooseTrip
          ? 'chooseTwoError'
          : saved.chooseSingle
            ? 'chooseOneError'
            : 'chooseFirstError',
      });
      setOpen(true);
      return;
    }
    const previous = page;
    if (cursor) setLoadingMore(true);
    else {
      setLoading(true);
      setPage(null);
    }
    setError(null);
    setRefreshRequired(false);
    try {
      let response: SearchPage;
      if (demoMode) {
        if (currency !== 'USD') throw new Error('Sample plans are available in USD only.');
        const matches = matchPlans(demoPlans, selected, minGb, dataType).filter(
          (p) => mode === 'trip' || p.countries.length === 1,
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
                (p) => mode === 'trip' || p.countries.length === 1,
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
          coverage: mode === 'country' ? 'local' : 'all',
          sort: order,
          pageSize: '12',
        });
        if (currency !== 'USD') params.set('currency', currency);
        if (cursor) params.set('cursor', cursor);
        response = await api<SearchPage>('/v2/search/plans?' + params, { signal: abort.signal });
      }
      if (version !== requestVersion.current) return;
      if (cursor && previous && response.revision !== previous.revision)
        throw new StoreApiError(errorMessage('catalogueChanged'), 'CATALOGUE_CHANGED', 409);
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
        setError(
          e instanceof StoreApiError
            ? { code: e.code }
            : { key: demoMode && currency !== 'USD' ? 'sampleCurrencyError' : 'searchError' },
        );
        if (
          cursor &&
          e instanceof StoreApiError &&
          ['CATALOGUE_CHANGED', 'SEARCH_PAGE_INVALID'].includes(e.code)
        ) {
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
        dir={dir}
        aria-label={t('find')}
      >
        <div className="planner-tabs" dir="ltr">
          <button
            onClick={() => {
              dispatch(switchSearch('trip'));
              setPage(null);
            }}
            aria-label={t('multiTrip')}
            aria-pressed={mode === 'trip'}
            className={mode === 'trip' ? 'active' : ''}
          >
            <Globe2 size={16} />
            {simplified ? t('multi') : t('multiTrip')}
            {!simplified && <span className="small-badge">{t('matcher')}</span>}
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
            {t('single')}
          </button>
        </div>
        <div className="planner-inner">
          {!simplified && (
            <div className="planner-heading" dir="ltr">
              <div dir={dir}>
                <h2>{mode === 'trip' ? t('whereTrip') : t('whereCountry')}</h2>
                <p>{mode === 'trip' ? t('tripHint') : t('countryHint')}</p>
              </div>
              <span className="planner-doodle">
                <ShieldCheck size={16} /> {t('covered')}
              </span>
            </div>
          )}
          {saved.chooseTrip && (
            <p className="notice" role="status">
              {selected.length ? t('addAnother') : t('chooseTwo')}
            </p>
          )}
          {saved.chooseSingle && (
            <p className="notice" role="status">
              {t('chooseOneNotice')}
            </p>
          )}
          <div className="planner-controls" dir="ltr">
            <div className="country-field" ref={picker} dir={dir}>
              {!simplified && (
                <span className="field-label">
                  {mode === 'trip' ? t('destinations') : t('destination')}
                </span>
              )}
              <div className="country-chips">
                {selected.map((code) => (
                  <span className="country-chip" key={code}>
                    <span>{countryFlag(code)}</span>
                    {name(code)}
                    <button
                      aria-label={t('remove', { country: name(code) })}
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
                  {simplified ? <MapPin size={16} aria-hidden="true" /> : <Plus size={16} />}
                  {saved.chooseTrip
                    ? t('add')
                    : selected.length
                      ? mode === 'country'
                        ? t('change')
                        : t('addStop')
                      : t('choose')}
                </button>
              </div>
              {open && (
                <div
                  className="country-popover"
                  id={pickerId}
                  role="dialog"
                  aria-label={t('chooseCountry')}
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
                      aria-label={t('searchCountries')}
                      placeholder={t('searchPlaceholder')}
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
                    <button aria-label={t('closeSearch')} onClick={() => setOpen(false)}>
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
                          {countryFlag(c.code)} {c.name}
                        </span>
                        <Plus size={14} />
                      </button>
                    ))}
                    {countriesLoading ? (
                      <p role="status">{t('loadingDestinations')}</p>
                    ) : (
                      !filtered.length && <p>{t('noDestinations')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <label className="data-field" dir={dir}>
              <span className="field-label">{plans('allowance')}</span>
              <span className="select-wrap">
                <select
                  aria-label={plans('allowance')}
                  value={allowance}
                  onChange={(e) => {
                    const value = e.target.value as DataAllowance;
                    setAllowance(value);
                    if (results !== null || loading) void search(value);
                  }}
                >
                  <option value="all">
                    {t('allData')}
                    {page ? ` (${page.facets['all']})` : ''}
                  </option>
                  <option value="1">
                    {t('minimumData', { amount: 1 })}
                    {page ? ` (${page.facets['1']})` : ''}
                  </option>
                  <option value="3">
                    {t('minimumData', { amount: 3 })}
                    {page ? ` (${page.facets['3']})` : ''}
                  </option>
                  <option value="5">
                    {t('minimumData', { amount: 5 })}
                    {page ? ` (${page.facets['5']})` : ''}
                  </option>
                  <option value="10">
                    {t('minimumData', { amount: 10 })}
                    {page ? ` (${page.facets['10']})` : ''}
                  </option>
                  <option value="20">
                    {t('minimumData', { amount: 20 })}
                    {page ? ` (${page.facets['20']})` : ''}
                  </option>
                  <option value="50">
                    {t('minimumData', { amount: 50 })}
                    {page ? ` (${page.facets['50']})` : ''}
                  </option>
                  <option value="daily">
                    {t('daily')}
                    {page ? ` (${page.facets['daily']})` : ''}
                  </option>
                  <option value="unlimited">
                    {t('unlimited')}
                    {page ? ` (${page.facets['unlimited']})` : ''}
                  </option>
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </span>
            </label>
            <button
              className="button primary search-button"
              disabled={loading || !ready}
              onClick={() => void search()}
            >
              {loading ? t('finding') : home('findEsim')}
              <ArrowRight size={18} />
            </button>
          </div>
          {(!simplified || demoMode) && (
            <div className="planner-note">
              {!simplified && (
                <span>
                  <ShieldCheck size={14} />
                  {t('coverageChecked')}
                </span>
              )}
              {demoMode && <span>{t('demoNotice')}</span>}
            </div>
          )}
          {loading && <p role="status">{t('searching')}</p>}
          {refreshRequired && (
            <button className="button" onClick={() => void search()}>
              {t('refresh')}
            </button>
          )}
          {error && (
            <p role="alert" className="error-message">
              {'code' in error ? errorMessage(ERROR_MESSAGES[error.code]) : t(error.key)}
            </p>
          )}
        </div>
      </section>
      <div ref={resultRef} className="search-results" aria-live="polite">
        {sorted && (
          <>
            <div className="results-heading" dir="ltr">
              <div dir={dir}>
                <span className="eyebrow">{t('matched')}</span>
                <h2>
                  {total
                    ? mode === 'country'
                      ? t('localResults', {
                          count: total,
                          countries: selected.map(name).join(', '),
                        })
                      : t('tripResults', { count: total })
                    : coveringTotal > 0
                      ? t('noAllowance')
                      : mode === 'country'
                        ? t('noLocal')
                        : t('noCoverage')}
                </h2>
                <p>
                  {total
                    ? mode === 'country'
                      ? t('localExplanation')
                      : t('tripExplanation', { countries: selected.map(name).join(', ') })
                    : coveringTotal > 0
                      ? t('mismatchExplanation', { count: coveringTotal })
                      : mode === 'country'
                        ? t('noLocalExplanation')
                        : t('noCoverageExplanation')}
                </p>
              </div>
              {sorted.length > 0 && (
                <label className="sort-control">
                  <SlidersHorizontal size={16} />
                  <select
                    aria-label={t('sort')}
                    value={sort}
                    onChange={(e) => {
                      const order = SEARCH_SORTS.find((v) => v === e.target.value) || 'recommended';
                      setSort(order);
                      void search(allowance, order);
                    }}
                  >
                    <option value="recommended">{t('recommended')}</option>
                    <option value="value">{t('value')}</option>
                    <option value="price">{t('price')}</option>
                    <option value="data">{t('mostData')}</option>
                  </select>
                </label>
              )}
            </div>
            {!total && coveringTotal > 0 && allowance !== 'all' && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  setAllowance('all');
                  void search('all');
                }}
              >
                {t('showAll')}
              </button>
            )}
            <p className="muted" role="status">
              {t('showing', { shown: sorted.length, total })}
            </p>
            <div className="plan-grid" dir="ltr" aria-live="off">
              {sorted.map((p) => (
                <PlanCard key={p.id} plan={p} />
              ))}
            </div>
            {page?.nextCursor && (
              <button
                className="button show-more-plans"
                disabled={loadingMore}
                onClick={() => void search(allowance, sort, page.nextCursor!)}
              >
                {loadingMore ? t('loadingMore') : t('showMore', { shown: sorted.length, total })}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
export function PlanCard({ plan, highlight = false }: { plan: PlanSummary; highlight?: boolean }) {
  const t = useTranslations('plans');
  const s = useTranslations('search');
  const { allowance, title } = usePlanCopy();
  const locale = useLocale();
  const { currency, ready } = useCurrency();
  return (
    <article className={`plan-card ${highlight ? 'featured' : ''}`} dir={localeDirection(locale)}>
      <div className="plan-top" dir="ltr">
        <span className="plan-globe">
          <Globe2 size={22} />
        </span>
        {highlight && <span className="small-badge">{s('bestValue')}</span>}
      </div>
      <h3>{title(plan)}</h3>
      <p className="muted">
        {plan.countries.length === 1
          ? destinationName(plan.countries[0], locale)
          : s('destinationsCount', { count: plan.countries.length })}{' '}
        · {s('dataOnly')}
      </p>
      <div className="plan-data" dir="ltr">
        {plan.dataType === 'fixed' ? (
          <span className="plan-fixed-allowance">{allowance(plan)}</span>
        ) : (
          <span className="plan-allowance">{allowance(plan)}</span>
        )}
        <span className="plan-days">{t('days', { count: plan.days })}</span>
      </div>
      {plan.dataType !== 'fixed' && <p className="muted">{plan.fairUse}</p>}
      <div className="plan-coverage">
        <Check size={15} /> {s('coverage', { count: plan.countries.length })}
      </div>
      <div className="plan-bottom" dir="ltr">
        <div>
          <strong dir="ltr">
            {!ready || plan.currency === currency ? money(plan.priceCents, plan.currency) : '—'}
          </strong>
          <span>
            {' '}
            {ready ? currency : plan.currency}
            {plan.demo ? ' · ' + s('samplePrice') : ''}
          </span>
        </div>
        <Link href={`/plans/${plan.id}`} className="button small">
          {t('view')} <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}
