'use client';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { navigationLocalePath, internalLocalePath, isLocale } from '@alozuri/shared/i18n';
import { useLanguage } from '@/components/language-provider';

export function useLocalizedRouter() {
  const router = useRouter();
  const locale = useLocale();
  const { prepareNavigation } = useLanguage();
  if (!isLocale(locale)) throw new Error('Unsupported locale context.');
  const local = (href: string) =>
    href.startsWith('/') && !href.startsWith('//') && !internalLocalePath(href)
      ? navigationLocalePath(href, locale)
      : href;
  return {
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => {
      const target = local(href);
      prepareNavigation(href, target);
      router.push(target, options);
    },
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => {
      const target = local(href);
      prepareNavigation(href, target);
      router.replace(target, options);
    },
    prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) =>
      router.prefetch(local(href), options),
  };
}
