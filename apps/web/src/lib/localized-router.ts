'use client';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { localePath, internalLocalePath } from '@alozuri/shared/i18n';

export function useLocalizedRouter() {
  const router = useRouter();
  const locale = useLocale();
  const local = (href: string) =>
    href.startsWith('/') && !href.startsWith('//') && !internalLocalePath(href)
      ? localePath(href, locale)
      : href;
  return {
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) =>
      router.push(local(href), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
      router.replace(local(href), options),
    prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) =>
      router.prefetch(local(href), options),
  };
}
