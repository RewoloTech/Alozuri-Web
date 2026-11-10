'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export function LegacyCheckout({ id }: { id: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace('/checkout?buy=' + encodeURIComponent(id));
  }, [id, router]);
  return (
    <div className="loading-page" role="status">
      Opening secure checkout…
    </div>
  );
}
