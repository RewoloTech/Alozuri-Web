export type OperationsRow = {
  id: string;
  source: 'purchases' | 'orders';
  createdAt: string;
  reference: string;
  email: string | null;
  customerId: string | null;
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
    purchasedUnits: number | null;
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
export type OperationsReport = {
  from: string;
  to: string;
  timezone: 'Europe/London';
  currency: 'GBP';
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
