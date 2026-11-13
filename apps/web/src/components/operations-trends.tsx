'use client';
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
  const max = Math.max(1, ...data.topPlans.map((p) => p.quantity));
  return (
    <>
      <p className="fine-print">
        Refund-adjusted revenue and profit, grouped by the original order date in Europe/London.
        Profit is before other operating expenses and taxes. Partial periods include only the
        selected dates.
      </p>
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
            Gross quantities from paid orders, including later refunds. Grouped by recorded plan
            name and coverage.
          </p>
          {!data.topPlans.length ? (
            <p>No paid orders in this date range.</p>
          ) : (
            <ol>
              {data.topPlans.map((p) => (
                <li key={JSON.stringify([p.name, p.countries])}>
                  <div>
                    <span>{p.name}</span>
                    <strong>{p.quantity} sold</strong>
                  </div>
                  <div className="operations-plan-track" aria-hidden="true">
                    <span style={{ width: `${(p.quantity / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
          {data.otherPlanQuantity > 0 && (
            <p className="fine-print">
              Top eight shown; {data.otherPlanQuantity} further packages sold across other plans.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
