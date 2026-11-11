// Server-only money arithmetic. Supplier units are 1/10,000 USD; retail units are cents.
export const PRICING_VERSION = 'tiered-usd-v1';
export const MINIMUM_USD_CENTS = 199;
const tiers = [
  { from: 0n, multiplier: 240n },
  { from: 10000n, multiplier: 200n },
  { from: 50000n, multiplier: 180n },
  { from: 150000n, multiplier: 165n },
  { from: 300000n, multiplier: 150n },
];
export const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;
export function moneyInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
export function checkedMoney(value: bigint): number {
  if (value <= 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Invalid money amount.');
  return Number(value);
}
export function roundRetailUp(cents: number): number {
  if (!moneyInteger(cents)) throw new Error('Invalid money amount.');
  // 49, 99, 149, 199, ...; an already matching price is retained.
  return checkedMoney(ceilDiv(BigInt(cents) + 1n, 50n) * 50n - 1n);
}
export function supplierCostCents(units: number): number {
  if (!moneyInteger(units)) throw new Error('Invalid supplier cost.');
  return checkedMoney(ceilDiv(BigInt(units), 100n));
}
export function profitable(units: number, cents: unknown): cents is number {
  return (
    moneyInteger(units) &&
    moneyInteger(cents) &&
    cents >= MINIMUM_USD_CENTS &&
    BigInt(cents) * 700n >= BigInt(units) * 10n
  );
}
export function calculateSellingPrice(units: number): number {
  if (!moneyInteger(units)) throw new Error('Invalid supplier cost.');
  const cost = BigInt(units);
  let floor = BigInt(MINIMUM_USD_CENTS),
    multiplier = tiers[0].multiplier;
  for (let i = 1; i < tiers.length; i++) {
    if (cost < tiers[i].from) break;
    // The least non-decreasing envelope of the tier schedule, including sub-cent costs.
    const previousMaximum = ceilDiv((tiers[i].from - 1n) * tiers[i - 1].multiplier, 10000n);
    if (previousMaximum > floor) floor = previousMaximum;
    multiplier = tiers[i].multiplier;
  }
  const markedUp = ceilDiv(cost * multiplier, 10000n);
  const minimumMargin = ceilDiv(cost * 10n, 700n);
  const price = roundRetailUp(
    checkedMoney([floor, markedUp, minimumMargin].reduce((a, b) => (a > b ? a : b))),
  );
  if (price > 99999999) throw new Error('Supplier cost exceeds supported selling amount.');
  return price;
}
