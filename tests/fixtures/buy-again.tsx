'use client';
import { BuyAgain } from '@/components/buy-again';
export default function BuyAgainFixture() {
  return (
    <div className="container section" id="repeat-fixture">
      <BuyAgain orderId={'order_' + 'a'.repeat(48)} />
    </div>
  );
}
