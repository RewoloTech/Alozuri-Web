import type { PlanSummary, SearchPage } from '../../packages/shared/src/index';
export function searchPageFixture(
  plans: PlanSummary[],
  overrides: Partial<SearchPage> = {},
): SearchPage {
  return {
    plans,
    total: plans.length,
    nextCursor: null,
    revision: '0'.repeat(64),
    facets: {
      all: plans.length,
      '1': plans.filter((p) => p.dataType === 'fixed' && p.dataGb >= 1).length,
      '3': plans.filter((p) => p.dataType === 'fixed' && p.dataGb >= 3).length,
      '5': plans.filter((p) => p.dataType === 'fixed' && p.dataGb >= 5).length,
      '10': plans.filter((p) => p.dataType === 'fixed' && p.dataGb >= 10).length,
      '20': plans.filter((p) => p.dataType === 'fixed' && p.dataGb >= 20).length,
      '50': plans.filter((p) => p.dataType === 'fixed' && p.dataGb >= 50).length,
      daily: plans.filter((p) => p.dataType === 'daily').length,
      unlimited: plans.filter((p) => p.dataType === 'unlimited' || p.dailyPolicy === 'reduced')
        .length,
    },
    ...overrides,
  };
}
