import Link from 'next/link';
export type AccountSection = 'esims' | 'usage' | 'orders' | 'profile';
const sections: { id: AccountSection; label: string; href: string }[] = [
  { id: 'esims', label: 'My eSIMs', href: '/account/esims' },
  { id: 'usage', label: 'Data usage', href: '/account/usage' },
  { id: 'orders', label: 'Orders', href: '/account/orders' },
  { id: 'profile', label: 'Profile', href: '/dashboard#account-settings' },
];
export function AccountNavigation({ active }: { active: AccountSection }) {
  return (
    <nav className="account-sections" aria-label="Account sections">
      {sections.map((section) => (
        <Link
          key={section.id}
          href={section.href}
          aria-current={active === section.id ? 'page' : undefined}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
