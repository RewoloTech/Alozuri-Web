import {
  cartItems,
  mergeCartItems,
  MAX_QUANTITY,
  MAX_CART_UNITS,
  type CartItem,
  type CartLine,
} from '@alozuri/shared';

export type CartMergeIntent = { uid: string; mergeId: string; items: CartItem[] };
export function readMergeIntent(value: string | null): CartMergeIntent | null {
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('uid' in parsed) ||
    typeof parsed.uid !== 'string' ||
    !('mergeId' in parsed) ||
    typeof parsed.mergeId !== 'string' ||
    !('items' in parsed) ||
    !Array.isArray(parsed.items)
  )
    return null;
  const items: CartItem[] = [];
  for (const item of parsed.items) {
    if (
      !item ||
      typeof item !== 'object' ||
      !('planId' in item) ||
      typeof item.planId !== 'string' ||
      !('quantity' in item) ||
      typeof item.quantity !== 'number'
    )
      return null;
    items.push({ planId: item.planId, quantity: item.quantity });
  }
  return { uid: parsed.uid, mergeId: parsed.mergeId, items: mergeCartItems([], items) };
}
// The server already contains the initial guest merge. Apply only edits made
// locally since that frozen request; adding the entire cart again would double it.
export function preserveCartEdits(
  server: CartLine[],
  baseline: CartItem[],
  current: CartLine[],
): CartLine[] {
  const before = new Map(mergeCartItems([], baseline).map((item) => [item.planId, item.quantity]));
  const after = new Map(
    mergeCartItems([], cartItems(current)).map((item) => [item.planId, item.quantity]),
  );
  const result = new Map(server.map((line) => [line.plan.id, line]));
  const local = new Map(current.map((line) => [line.plan.id, line]));
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const delta = (after.get(id) ?? 0) - (before.get(id) ?? 0);
    if (!delta) continue;
    const existing = result.get(id),
      quantity = (existing?.quantity ?? 0) + delta;
    if (quantity <= 0) result.delete(id);
    else {
      const line = existing ?? local.get(id);
      if (!line || quantity > MAX_QUANTITY)
        throw new Error(
          'Your combined cart exceeds the limit. Review your saved account cart before continuing.',
        );
      result.set(id, { ...line, quantity });
    }
  }
  const lines = [...result.values()];
  if (lines.reduce((sum, line) => sum + line.quantity, 0) > MAX_CART_UNITS)
    throw new Error(
      'Your combined cart exceeds the limit. Review your saved account cart before continuing.',
    );
  return lines;
}
