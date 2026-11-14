'use client';
import { OperationsCountries } from './operations-countries';
import { countryName } from '@alozuri/shared';
import { useEffect, useRef, useState } from 'react';
import type { OperationsTrends } from '@alozuri/shared/financial';
const gbp = (n: number | null) =>
  n === null
    ? 'Pending'
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n / 100);
const period = (start: string, data: OperationsTrends) => {
  if (data.grain === 'year')
    return data.step === 1
      ? start.slice(0, 4)
      : `${start.slice(0, 4)}–${Number(start.slice(0, 4)) + data.step - 1}`;
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    ...(data.grain === 'month'
      ? ({ month: 'short', year: 'numeric' } as const)
      : ({ day: 'numeric', month: 'short' } as const)),
  }).format(new Date(start + 'T00:00:00Z'));
  return data.grain === 'week' ? `Week of ${date}` : date;
};
function MoneyChart({
  title,
  data,
  field,
}: {
  title: string;
  data: OperationsTrends;
  field: 'revenueGbp' | 'profitGbp';
}) {
  const latest = data.points.reduce((last, p, i) => (p.orders ? i : last), 0);
  const selectedIndex = useRef(latest);
  const scroll = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(latest);
  const choose = (index: number) => {
    selectedIndex.current = index;
    setActive(index);
  };
  useEffect(() => {
    const node = scroll.current;
    if (!node) return;
    const reveal = () => {
      node.scrollLeft = Math.max(0, selectedIndex.current * 28 - node.clientWidth / 2);
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const point = data.points[Math.min(active, data.points.length - 1)];
  const values = data.points.flatMap((p) => (p[field] === null ? [] : [p[field]]));
  const min = Math.min(0, ...values),
    max = Math.max(0, ...values),
    range = max - min || 1;
  const zero = max === min ? 50 : (max / range) * 100;
  const provisional = (p: OperationsTrends['points'][number]) =>
    field === 'profitGbp' ? p.profitProvisional : p.revenueProvisional;
  return (
    <section className="surface operations-trend-card" aria-label={title}>
      <h3>{title}</h3>
      {!data.points.some((p) => p.orders) ? (
        <p>No paid orders in this date range.</p>
      ) : (
        <>
          <p className="fine-print">
            Select a bar to inspect it. Use arrow keys to move between periods.
          </p>
          <p className="operations-trend-readout" aria-live="polite">
            {point && (
              <>
                <strong>
                  {period(point.periodStart, data)}: {gbp(point[field])}
                </strong>{' '}
                · {point.orders} {point.orders === 1 ? 'order' : 'orders'}
                {provisional(point) ? ' · Provisional' : ''}
              </>
            )}
          </p>
          <p className="fine-print">
            Scale: {gbp(min)} to {gbp(max)}
          </p>
          <div
            className="operations-trend-scroll"
            ref={scroll}
            role="region"
            aria-label={`${title} chart`}
            tabIndex={0}
          >
            <div className="operations-trend-bars" style={{ minWidth: data.points.length * 28 }}>
              {data.points.map((p, i) => {
                const value = p[field];
                const top =
                  value === null
                    ? 0
                    : value === 0
                      ? zero
                      : value > 0
                        ? ((max - value) / range) * 100
                        : zero;
                const height = value === null ? 100 : (Math.abs(value) / range) * 100;
                return (
                  <button
                    key={p.periodStart}
                    type="button"
                    className={`operations-trend-bar ${provisional(p) ? 'is-provisional' : ''} ${value === null ? 'is-pending' : ''} ${value !== null && value < 0 ? 'is-negative' : ''}`}
                    tabIndex={i === Math.min(active, data.points.length - 1) ? 0 : -1}
                    aria-pressed={i === active}
                    aria-label={`${period(p.periodStart, data)}: ${gbp(value)}, ${p.orders} orders${provisional(p) ? ', provisional' : ''}`}
                    onClick={() => choose(i)}
                    onMouseEnter={() => choose(i)}
                    onFocus={() => choose(i)}
                    onKeyDown={(e) => {
                      const next =
                        e.key === 'ArrowRight'
                          ? Math.min(data.points.length - 1, i + 1)
                          : e.key === 'ArrowLeft'
                            ? Math.max(0, i - 1)
                            : e.key === 'Home'
                              ? 0
                              : e.key === 'End'
                                ? data.points.length - 1
                                : null;
                      if (next === null) return;
                      e.preventDefault();
                      choose(next);
                      const siblings =
                        e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                          'button',
                        );
                      siblings?.[next]?.focus();
                    }}
                  >
                    <span className="operations-trend-zero" style={{ top: `${zero}%` }} />
                    <span
                      className="operations-trend-fill"
                      style={{ top: `${top}%`, height: `${height}%` }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="operations-trend-axis" aria-hidden="true">
            <span>Range: {data.points[0] && period(data.points[0].periodStart, data)}</span>
            <span>{data.points.at(-1) && period(data.points.at(-1)!.periodStart, data)}</span>
          </div>
          <p className="fine-print">
            GBP ·{' '}
            {data.grain === 'week'
              ? 'Weekly'
              : data.grain === 'month'
                ? 'Monthly'
                : data.grain === 'year'
                  ? `${data.step}-year`
                  : 'Daily'}{' '}
            periods. Dashed bars are provisional; hatched columns are pending. Scroll the chart to
            view additional periods.
          </p>
          <details>
            <summary>View chart data</summary>
            <div
              className="operations-table-scroll"
              tabIndex={0}
              role="region"
              aria-label={`${title} data table`}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Period</th>
                    <th scope="col">Orders</th>
                    <th scope="col">GBP</th>
                    <th scope="col">Calculation</th>
                  </tr>
                </thead>
                <tbody>
                  {data.points.map((p) => (
                    <tr key={p.periodStart}>
                      <th scope="row">{period(p.periodStart, data)}</th>
                      <td>{p.orders}</td>
                      <td>{gbp(p[field])}</td>
                      <td>
                        {p[field] === null ? 'Pending' : provisional(p) ? 'Provisional' : 'Final'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
export function OperationsTrendCharts({ data }: { data: OperationsTrends }) {
  const [planSearch, setPlanSearch] = useState('');
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [planPage, setPlanPage] = useState(0);
  const allPlans = data.planSales ?? data.topPlans;
  const normalise = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  const words = normalise(planSearch).trim().split(/\s+/).filter(Boolean);
  const searching = words.length > 0;
  const filteredPlans = allPlans.filter((plan) => {
    const label = normalise(
      [
        plan.name,
        ...plan.countries.flatMap((code) => [
          code,
          countryName(code),
          ...(code === 'GB' ? ['UK'] : []),
        ]),
      ].join(' '),
    );
    return words.every((word) => label.includes(word));
  });
  const expanded = showAllPlans || searching;
  const shownPlans = expanded ? filteredPlans : data.topPlans;
  const lastPage = Math.max(0, Math.ceil(shownPlans.length / 8) - 1);
  const activePage = Math.min(planPage, lastPage);
  const pagePlans = shownPlans.slice(activePage * 8, activePage * 8 + 8);
  const max = Math.max(1, ...shownPlans.map((p) => p.quantity));
  return (
    <>
      <p className="fine-print">
        Refund-adjusted revenue and profit, grouped by the original order date in Europe/London.
        Profit is before other operating expenses and taxes. Partial periods include only the
        selected dates.
      </p>
      <section className="surface operations-trend-card" aria-label="Sales by billing country">
        <h3>Sales by billing country</h3>
        <p className="fine-print">
          Country supplied with Stripe payment, not the eSIM destination or verified physical
          location. Paid order counts include later refunds; revenue is adjusted for refunds.
          Missing countries remain unknown.
        </p>
        {!data.billingCountries?.length ? (
          <p>No billing-country data in this date range.</p>
        ) : (
          <div
            className="operations-table-scroll"
            role="region"
            aria-label="Billing country sales"
            tabIndex={0}
          >
            <table>
              <caption className="sr-only">
                Paid orders and refund-adjusted revenue by Stripe billing country
              </caption>
              <thead>
                <tr>
                  <th scope="col">Billing country</th>
                  <th scope="col">Paid orders</th>
                  <th scope="col">Revenue (GBP)</th>
                </tr>
              </thead>
              <tbody>
                {data.billingCountries.map((row) => (
                  <tr key={row.country ?? 'unknown'}>
                    <td>{row.country ? countryName(row.country) : 'Unknown / not recorded'}</td>
                    <td>{row.orders}</td>
                    <td>
                      {gbp(row.revenueGbp)}
                      {row.revenueProvisional && <small>Provisional</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="operations-trend-grid">
        <MoneyChart
          key={`revenue-${data.points[0]?.periodStart}-${data.grain}`}
          title="Revenue over time"
          data={data}
          field="revenueGbp"
        />
        <MoneyChart
          key={`profit-${data.points[0]?.periodStart}-${data.grain}`}
          title="Profit over time"
          data={data}
          field="profitGbp"
        />
        <section
          className="surface operations-trend-card operations-top-plans"
          aria-label="Top-selling plans"
        >
          <h3>Top-selling plans</h3>
          <p className="fine-print">
            Plans ranked by units sold in the selected dates. Search all recorded sold plans by name
            or destination. Counts include later refunds and group recorded plan name and coverage;
            they measure sales volume, not revenue or profit.
          </p>
          <label htmlFor="plan-sales-search">Find a package</label>
          <input
            id="plan-sales-search"
            type="search"
            className="commerce-input"
            placeholder="Package name or destination"
            maxLength={100}
            value={planSearch}
            onChange={(event) => {
              setPlanSearch(event.target.value);
              setPlanPage(0);
            }}
          />
          <div className="operations-plan-search-actions">
            {planSearch && (
              <button
                type="button"
                className="button small"
                onClick={() => {
                  setPlanSearch('');
                  setPlanPage(0);
                }}
              >
                Clear package search
              </button>
            )}
            {data.planSales && (
              <button
                type="button"
                className="button small"
                onClick={() => {
                  setShowAllPlans((value) => !value);
                  setPlanSearch('');
                  setPlanPage(0);
                }}
              >
                {showAllPlans ? 'Show top eight' : 'Browse all sold packages'}
              </button>
            )}
          </div>
          {!data.planSales && data.otherPlanQuantity > 0 && (
            <p role="status">
              Only the top eight are available from this API version. Update the backend to search
              all sold packages.
            </p>
          )}
          {!allPlans.length ? (
            <p>No paid orders in this date range.</p>
          ) : !shownPlans.length ? (
            <p role="status">
              No recorded paid sales match this package search in the selected dates. Try another
              name, destination or date range.
            </p>
          ) : (
            <>
              {expanded && (
                <p role="status" className="fine-print">
                  {filteredPlans.length} matching{' '}
                  {filteredPlans.length === 1 ? 'package' : 'packages'}
                  {lastPage > 0 && ` · Page ${activePage + 1} of ${lastPage + 1}`}
                </p>
              )}
              <ol start={activePage * 8 + 1}>
                {pagePlans.map((p) => (
                  <li key={JSON.stringify([p.name, p.countries])}>
                    <div>
                      <span>{p.name}</span>
                      <strong>{p.quantity} sold</strong>
                    </div>
                    {expanded && <OperationsCountries countries={p.countries} />}
                    <div className="operations-plan-track" aria-hidden="true">
                      <span style={{ width: `${(p.quantity / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
              {expanded && lastPage > 0 && (
                <div className="operations-pagination">
                  <button
                    type="button"
                    className="button"
                    disabled={activePage === 0}
                    onClick={() => setPlanPage(activePage - 1)}
                  >
                    Previous packages
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={activePage === lastPage}
                    onClick={() => setPlanPage(activePage + 1)}
                  >
                    Next packages
                  </button>
                </div>
              )}
            </>
          )}
          {!expanded && data.otherPlanQuantity > 0 && (
            <p className="fine-print">
              Top eight shown; {data.otherPlanQuantity} further packages sold across other plans.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
