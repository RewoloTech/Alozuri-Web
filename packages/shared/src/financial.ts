import type { EsimUsage } from './esim-usage.ts';
export type OperationsRow = {
  promotion?: { id: string; code: string; discountPercent: number };
  checkoutEstimate?: {
    currency: 'USD' | 'GBP' | 'EUR';
    revenueMinor: number;
    supplierMinor: number;
    feeMinor: number;
    contributionMinor: number;
    marginBps: number;
    basis: string;
  } | null;
  id: string;
  source: 'purchases' | 'orders';
  createdAt: string;
  reference: string;
  email: string | null;
  customerId: string | null;
  /** Billing country from the verified Stripe charge; not physical location. */
  billingCountry?: string | null;
  paid: boolean;
  paymentStatus: string;
  fulfilmentStatus: string;
  packages: { name: string; countries: string[]; quantity: number }[];
  selling: {
    currency: string;
    amountMinor: number;
    refundedMinor: number | null;
    discountMinor: number;
  };
  supplier: {
    currency: 'USD';
    scale: 10000;
    quotedUnits: number | null;
    /** Historical quoted cost of profiles confirmed purchased; not proof of debit. */
    purchasedUnits: number | null;
    /** Actual USD charges reconciled against supplier transaction evidence. */
    verifiedUnits: number | null;
    refundedUnits?: number;
  };
  stripe: {
    currency: string | null;
    feeMinor: number | null;
    balanceTransactions: string[];
    exchangeRates: (number | null)[];
    observedAt: string | null;
    revenueGbp: number | null;
    feesGbp: number | null;
    refundsPending: boolean;
  };
  usdGbp: { numerator: string; denominator: string; source: string; asOf: string } | null;
  saleExchange: { numerator: string; denominator: string; source: string; asOf: string } | null;
  revenueGbp: number | null;
  supplierGbp: number | null;
  feesGbp: number | null;
  grossProfitGbp: number | null;
  profitGbp: number | null;
  marginBps: number | null;
  calculationStatus: 'pending' | 'final';
  reasons: string[];
  updatedAt: string;
};
export type OperationsTrends = {
  grain: 'day' | 'week' | 'month' | 'year';
  step: number;
  points: {
    periodStart: string;
    orders: number;
    revenueGbp: number | null;
    profitGbp: number | null;
    revenueProvisional: boolean;
    profitProvisional: boolean;
  }[];
  topPlans: { name: string; countries: string[]; quantity: number }[];
  /** All date-scoped sold-plan aggregates, ranked by gross units. */
  planSales?: { name: string; countries: string[]; quantity: number }[];
  otherPlanQuantity: number;
  billingCountries?: {
    country: string | null;
    orders: number;
    revenueGbp: number | null;
    revenueProvisional?: boolean;
  }[];
};
export type OperationsReport = {
  from: string;
  to: string;
  timezone: 'Europe/London';
  currency: 'GBP';
  trends?: OperationsTrends;
  promotions?: {
    code: string;
    currency: string;
    sales: number;
    revenueMinor: number | null;
    discountMinor: number;
    supplierGbp: number | null;
    feesGbp: number | null;
    profitGbp: number | null;
    provisional: number;
    usage: { date: string; sales: number }[];
  }[];
  summary: {
    sales: number;
    revenueGbp: number | null;
    supplierGbp: number | null;
    feesGbp: number | null;
    profitGbp: number | null;
    marginBps: number | null;
    provisional: number;
    records: number;
  };
  rows: OperationsRow[];
  nextCursor: string | null;
};
export function londonDate(at = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function londonMonth(at = new Date()) {
  const today = londonDate(at);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return {
    from: today.slice(0, 8) + '01',
    to: `${today.slice(0, 8)}${new Date(Date.UTC(year, month, 0)).getUTCDate()}`,
  };
}

export type OperationsEsimReference = {
  id: string;
  name: string;
  supplier: { id: string; name: string };
  esimTranNo: string | null;
};
export type OperationsOrderSummary = {
  id: string;
  reference: string;
  createdAt: string;
  email: string | null;
  paymentStatus: string;
  amountMinor: number;
  currency: 'USD' | 'GBP' | 'EUR';
  plans: { name: string; quantity: number }[];
  esims: OperationsEsimReference[];
};
export type OperationsOrderSearch = {
  query: string;
  rows: OperationsOrderSummary[];
  nextCursor: string | null;
};
export type OperationsEsimDetails = {
  billingCountry?: string | null;
  purchaseId: string;
  stripePayment: { paymentIntentId: string; dashboardUrl: string } | null;
  items: { name: string; quantity: number }[];
  createdAt: string;
  amountMinor: number;
  currency: 'USD' | 'GBP' | 'EUR';
  fulfilmentStatus: string;
  reference: string;
  email: string | null;
  paymentStatus: string;
  units: {
    id: string;
    name: string;
    fulfilmentStatus: string;
    supplier: { id: string; name: string };
    amountMinor: number;
    currency: 'USD' | 'GBP' | 'EUR';
    supplierOrderNo: string | null;
    esimTranNo: string | null;
    supplierCost?: {
      originalUnits: number;
      verified: boolean;
      creditUnits: number;
      version: number;
      reference: string | null;
    };
    usage: EsimUsage;
  }[];
};
