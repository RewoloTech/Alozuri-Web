'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { OrderDetails } from './order-details';
export function OrderLookup() {
  const id = useSearchParams().get('id');
  if (!id || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    return (
      <section className="container section">
        <h1 className="compact-title">Choose an order</h1>
        <p>Open an order from your account to see its status.</p>
        <Link className="button" href="/dashboard">
          My eSIMs
        </Link>
      </section>
    );
  return <OrderDetails key={id} id={id} />;
}
