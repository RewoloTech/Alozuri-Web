'use client';
import { useTranslations } from 'next-intl';
import Link from '@/components/localized-link';
import { useSearchParams } from 'next/navigation';
import { OrderDetails } from './order-details';
export function OrderLookup() {
  const t = useTranslations('legacyOrder');
  const site = useTranslations('site');
  const id = useSearchParams().get('id');
  if (!id || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    return (
      <section className="container section">
        <h1 className="compact-title">{t('choose')}</h1>
        <p>{t('chooseHint')}</p>
        <Link className="button" href="/dashboard">
          {site('myEsims')}
        </Link>
      </section>
    );
  return <OrderDetails key={id} id={id} />;
}
