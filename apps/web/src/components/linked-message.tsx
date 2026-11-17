import { Fragment } from 'react';
import Link from './localized-link';

/** Plain ICU variables can place links naturally without accepting HTML in copy. */
export const MESSAGE_LINKS = {
  terms: '\uE000terms\uE001',
  refunds: '\uE000refunds\uE001',
  privacy: '\uE000privacy\uE001',
  verify: '\uE000verify\uE001',
  support: '\uE000support\uE001',
  guides: '\uE000guides\uE001',
  budget: '\uE000budget\uE001',
  us: '\uE000us\uE001',
  gb: '\uE000gb\uE001',
  europe: '\uE000europe\uE001',
  jp: '\uE000jp\uE001',
  th: '\uE000th\uE001',
  destinations: '\uE000destinations\uE001',
  compatibility: '\uE000compatibility\uE001',
  installation: '\uE000installation\uE001',
} as const;
function isMessageLinkKey(value: string): value is keyof typeof MESSAGE_LINKS {
  return Object.hasOwn(MESSAGE_LINKS, value);
}
export function LinkedMessage({
  message,
  links,
}: {
  message: string;
  links: Partial<Record<keyof typeof MESSAGE_LINKS, { href: string; label: string }>>;
}) {
  return message.split(/(\uE000[a-z]+\uE001)/u).map((part, index) => {
    const entry = Object.entries(MESSAGE_LINKS).find(([, token]) => token === part);
    const link = entry && isMessageLinkKey(entry[0]) ? links[entry[0]] : undefined;
    return (
      <Fragment key={index}>
        {link ? (
          <Link href={link.href} dir={link.href.startsWith('mailto:') ? 'ltr' : undefined}>
            {link.label}
          </Link>
        ) : (
          part
        )}
      </Fragment>
    );
  });
}
