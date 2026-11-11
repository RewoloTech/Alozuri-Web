import { createHash } from 'node:crypto';
// Supplier amounts are integer 1/10,000 USD; every calculation rounds costs up.
export const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;
export function moneyInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
export function checkedMoney(value: bigint): number {
  if (value <= 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Invalid money amount.');
  return Number(value);
}
function setting(name: string, fallback: number, maximum = 10000): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`Invalid pricing configuration: ${name}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum)
    throw new Error(`Invalid pricing configuration: ${name}`);
  return value;
}
// USD equivalents are conservative assumptions, not a claim about negotiated Stripe fees.
export const PRICING_POLICY = {
  fees: [
    {
      name: 'domestic',
      bps: setting('PRICING_DOMESTIC_FEE_BPS', 150),
      fixedCents: setting('PRICING_FIXED_FEE_USD_CENTS', 30, 10000),
    },
    {
      name: 'eea_fx',
      bps: setting('PRICING_EEA_FEE_BPS', 250) + setting('PRICING_FX_FEE_BPS', 200),
      fixedCents: setting('PRICING_FIXED_FEE_USD_CENTS', 30, 10000),
    },
    {
      name: 'international_fx',
      bps: setting('PRICING_INTERNATIONAL_FEE_BPS', 315) + setting('PRICING_FX_FEE_BPS', 200),
      fixedCents: setting('PRICING_FIXED_FEE_USD_CENTS', 30, 10000),
    },
  ],
  otherCostCents: setting('PRICING_OTHER_COST_USD_CENTS', 0, 10000),
  minimumContributionCents: setting('PRICING_MIN_CONTRIBUTION_USD_CENTS', 50, 100000),
  minimumContributionBps: setting('PRICING_MIN_CONTRIBUTION_BPS', 1500),
  // Marginal contribution bands anchored to the observed catalogue quartiles.
  bands: [
    { fromUnits: 0, contributionBps: 9000 },
    { fromUnits: 16000, contributionBps: 6500 },
    { fromUnits: 40000, contributionBps: 4500 },
    { fromUnits: 107500, contributionBps: 3000 },
    { fromUnits: 263300, contributionBps: 2000 },
  ],
} as const;
if (
  PRICING_POLICY.minimumContributionCents < 1 ||
  PRICING_POLICY.fees.some((f) => f.bps + PRICING_POLICY.minimumContributionBps >= 10000)
)
  throw new Error('Pricing fees and minimum contribution must leave positive revenue.');
export const PRICING_VERSION =
  'contribution-usd-v2-' +
  createHash('sha256').update(JSON.stringify(PRICING_POLICY)).digest('hex').slice(0, 12);
export const MINIMUM_USD_CENTS = 50; // Stripe charge minimum, not a retail price floor.
export function roundRetailUp(cents: number): number {
  if (!moneyInteger(cents)) throw new Error('Invalid money amount.');
  return checkedMoney(ceilDiv(BigInt(cents) + 1n, 50n) * 50n - 1n);
}
export function supplierCostCents(units: number): number {
  if (!moneyInteger(units)) throw new Error('Invalid supplier cost.');
  return checkedMoney(ceilDiv(BigInt(units), 100n));
}
export function estimatedContribution(
  units: number,
  cents: number,
  fee: (typeof PRICING_POLICY.fees)[number] = PRICING_POLICY.fees[2],
): number {
  if (!moneyInteger(cents)) throw new Error('Invalid money amount.');
  return (
    cents -
    supplierCostCents(units) -
    Number(ceilDiv(BigInt(cents) * BigInt(fee.bps), 10000n)) -
    fee.fixedCents -
    PRICING_POLICY.otherCostCents
  );
}
export function profitable(units: number, cents: unknown): cents is number {
  if (!moneyInteger(units) || !moneyInteger(cents) || cents < MINIMUM_USD_CENTS || cents > 99999999)
    return false;
  return PRICING_POLICY.fees.every((fee) => {
    const contribution = estimatedContribution(units, cents, fee);
    return (
      contribution >= PRICING_POLICY.minimumContributionCents &&
      BigInt(contribution) * 10000n >= BigInt(cents) * BigInt(PRICING_POLICY.minimumContributionBps)
    );
  });
}
export function calculateSellingPrice(units: number): number {
  if (!moneyInteger(units)) throw new Error('Invalid supplier cost.');
  let weighted = 0n;
  for (let i = 0; i < PRICING_POLICY.bands.length; i++) {
    const band = PRICING_POLICY.bands[i],
      end = PRICING_POLICY.bands[i + 1]?.fromUnits ?? units;
    const covered = Math.max(0, Math.min(units, end) - band.fromUnits);
    weighted += BigInt(covered) * BigInt(band.contributionBps);
  }
  const target = [
    BigInt(PRICING_POLICY.minimumContributionCents),
    ceilDiv(weighted, 1000000n),
  ].reduce((a, b) => (a > b ? a : b));
  const cost = BigInt(supplierCostCents(units) + PRICING_POLICY.otherCostCents);
  let minimum = BigInt(MINIMUM_USD_CENTS);
  for (const fee of PRICING_POLICY.fees) {
    const fixed = cost + BigInt(fee.fixedCents),
      rate = BigInt(fee.bps);
    const candidate = ceilDiv((fixed + target) * 10000n, 10000n - rate);
    const margin = ceilDiv(
      fixed * 10000n,
      10000n - rate - BigInt(PRICING_POLICY.minimumContributionBps),
    );
    minimum = [minimum, candidate, margin].reduce((a, b) => (a > b ? a : b));
  }
  let price = roundRetailUp(checkedMoney(minimum));
  // Account for independent whole-cent rounding of the actual fee estimate.
  if (!profitable(units, price)) price = roundRetailUp(price + 1);
  if (!profitable(units, price)) throw new Error('Supplier cost exceeds supported selling amount.');
  return price;
}
