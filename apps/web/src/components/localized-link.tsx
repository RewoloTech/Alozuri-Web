'use client';
import NextLink from 'next/link';
import { useLocale } from 'next-intl';
import { localePath, internalLocalePath } from '@alozuri/shared/i18n';
import type { ComponentProps } from 'react';

export default function LocalizedLink(props: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  const href = props.href;
  const localized =
    typeof href === 'string'
      ? href.startsWith('/') && !href.startsWith('//') && !internalLocalePath(href)
        ? localePath(href, locale)
        : href
      : href.pathname?.startsWith('/') && !internalLocalePath(href.pathname)
        ? { ...href, pathname: localePath(href.pathname, locale) }
        : href;
  return <NextLink {...props} href={localized} />;
}
