'use client';
import { useEffect } from 'react';
import { useLocalizedRouter as useRouter } from '@/lib/localized-router';
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
