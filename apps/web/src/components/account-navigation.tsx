'use client';
import { useLocale, useTranslations } from 'next-intl';
import { localeDirection } from '@alozuri/shared/i18n';
import Link from '@/components/localized-link';
export type AccountSection = 'esims' | 'usage' | 'orders' | 'profile';
const sections: { id: AccountSection; href: string }[] = [
  { id: 'esims', href: '/account/esims' },
  { id: 'usage', href: '/account/usage' },
  { id: 'orders', href: '/account/orders' },
  { id: 'profile', href: '/dashboard#account-settings' },
];
export function AccountNavigation({ active }: { active: AccountSection }) {
  const site = useTranslations('site');
  const account = useTranslations('account');
  const dir = localeDirection(useLocale());
  const labels = {
    esims: site('myEsims'),
    usage: site('usage'),
    orders: site('orders'),
    profile: account('profile'),
  };
  return (
    <nav className="account-sections" aria-label={site('accountNav')} dir="ltr">
      {sections.map((section) => (
        <Link
          key={section.id}
          href={section.href}
          dir={dir}
          aria-current={active === section.id ? 'page' : undefined}
        >
          {labels[section.id]}
        </Link>
      ))}
    </nav>
  );
}
