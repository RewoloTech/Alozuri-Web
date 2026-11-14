'use client';
import { useState } from 'react';
import { OperationsTrendCharts } from '@/components/operations-trends';
import type { OperationsTrends } from '@alozuri/shared/financial';
const planSales = Array.from({ length: 12 }, (_, index) => ({
  name: index === 11 ? 'Japan 1GB 7Days' : `Europe package ${String(index + 1).padStart(2, '0')}`,
  countries: index === 11 ? ['JP'] : ['FR', 'GB'],
  quantity: 12 - index,
}));
export default function PlanSalesFixture() {
  const [empty, setEmpty] = useState(false);
  const data: OperationsTrends = {
    grain: 'day',
    step: 1,
    points: [],
    topPlans: empty ? [] : planSales.slice(0, 8),
    planSales: empty ? [] : planSales,
    otherPlanQuantity: empty
      ? 0
      : planSales.slice(8).reduce((total, plan) => total + plan.quantity, 0),
  };
  return (
    <section className="container section">
      <button type="button" className="button" onClick={() => setEmpty((value) => !value)}>
        {empty ? 'Restore date range' : 'Use empty date range'}
      </button>
      <OperationsTrendCharts data={data} />
    </section>
  );
}
