'use client';
import NextLink from 'next/link';
import { useLocale } from 'next-intl';
import { navigationLocalePath, internalLocalePath, isLocale } from '@alozuri/shared/i18n';
import type { ComponentProps } from 'react';

export default function LocalizedLink(props: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  if (!isLocale(locale)) throw new Error('Unsupported locale context.');
  const href = props.href;
  const localized =
    typeof href === 'string'
      ? href.startsWith('/') && !href.startsWith('//') && !internalLocalePath(href)
        ? navigationLocalePath(href, locale)
        : href
      : href.pathname?.startsWith('/') && !internalLocalePath(href.pathname)
        ? { ...href, pathname: navigationLocalePath(href.pathname, locale) }
        : href;
  return <NextLink {...props} href={localized} />;
}
