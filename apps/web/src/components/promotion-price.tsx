'use client';
import { useEffect, useState } from 'react';
import { money, type Plan } from '@alozuri/shared';
export function PromotionPrice({
  amount,
  currency,
  promotion,
}: {
  amount: number;
  currency: string;
  promotion?: Plan['promotionPrice'];
}) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!promotion) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [promotion]);
  if (!promotion) return <>{money(amount, currency)}</>;
  // The next price must come from the server, not a browser calculation.
  if (Date.parse(promotion.expiresAt) <= now) return <span aria-busy="true">—</span>;
  return (
    <span className="promotion-price">
      <del>{money(promotion.originalPriceCents, currency)}</del>
      <span>{money(amount, currency)}</span>
      <small>−{promotion.discountPercent}%</small>
    </span>
  );
}
