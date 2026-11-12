import type { Plan } from './index.ts';
export const CONTRACT_PDF_FILENAME = 'Alozuri-Order-Confirmation.pdf';
export type ContractLegal = {
  version: string;
  effectiveDate: string;
  acceptedAt: string;
  termsVersion?: string;
  refundVersion?: string;
  noticeText?: string;
  requestText: string;
  acknowledgementText: string;
  termsText: string;
  refundText: string;
  business?: { company: string; identity: string; address: string; email: string };
};
export type ContractOrder = {
  id: string;
  email: string;
  customerName?: string;
  createdAt: string;
  paidAt?: string;
  status?: string;
  contractDownloadAvailable?: boolean;
  currency: string;
  totalCents: number;
  subtotalCents?: number;
  taxCents?: number;
  test: boolean;
  items: { plan: Plan; quantity: number }[];
  legal: ContractLegal;
};
export function orderReference(id: string): string {
  if (!/^purchase_[a-f0-9]{48}$/.test(id)) throw new Error('Invalid order reference.');
  return (
    'AZ-' +
    id
      .slice(9, 25)
      .toUpperCase()
      .match(/.{1,4}/g)!
      .join('-')
  );
}
export function contractMoney(cents: number, currency: string): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Invalid recorded amount.');
  const amount = BigInt(cents);
  return `${currency} ${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`;
}
export function contractPaymentConfirmed(
  order: Pick<ContractOrder, 'paidAt' | 'status' | 'contractDownloadAvailable'>,
): boolean {
  if (order.contractDownloadAvailable !== undefined) return order.contractDownloadAvailable;
  // Older authorised order responses omit the PDF capability flag and paidAt.
  return Boolean(order.paidAt || order.status === 'paid' || order.status === 'refunded');
}
export function validateContractOrder(order: ContractOrder): void {
  orderReference(order.id);
  if (!contractPaymentConfirmed(order))
    throw new Error('Your contract is available after payment is confirmed.');
  if (
    !order.legal?.termsText?.trim() ||
    !order.legal.refundText?.trim() ||
    !order.legal.version?.trim()
  )
    throw new Error('The recorded contract is incomplete. Please contact support.');
  for (const date of [
    order.createdAt,
    order.legal.acceptedAt,
    ...(order.paidAt ? [order.paidAt] : []),
  ])
    if (!/^\d{4}-\d{2}-\d{2}T/.test(date) || !Number.isFinite(Date.parse(date)))
      throw new Error('The recorded contract dates are invalid. Please contact support.');
  if (
    !['USD', 'GBP', 'EUR'].includes(order.currency) ||
    !order.items.length ||
    order.items.length > 10
  )
    throw new Error('The recorded purchase is invalid. Please contact support.');
  contractMoney(order.totalCents, order.currency);
  if (order.totalCents <= 0) throw new Error('The recorded purchase total is invalid.');
  if (order.taxCents !== undefined) contractMoney(order.taxCents, order.currency);
  if (order.subtotalCents !== undefined) contractMoney(order.subtotalCents, order.currency);
  let subtotal = 0n;
  for (const { plan, quantity } of order.items) {
    contractMoney(plan.priceCents, order.currency);
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 5 ||
      plan.currency !== order.currency
    )
      throw new Error('The recorded purchase is invalid. Please contact support.');
    subtotal += BigInt(plan.priceCents) * BigInt(quantity);
  }
  if (
    subtotal + BigInt(order.taxCents ?? 0) !== BigInt(order.totalCents) ||
    (order.subtotalCents !== undefined && subtotal !== BigInt(order.subtotalCents))
  )
    throw new Error('Contract amounts do not match the recorded purchase.');
}
