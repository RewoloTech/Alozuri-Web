'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { X } from 'lucide-react';
import Link from './localized-link';
import { unlocalizedPath } from '@alozuri/shared/i18n';
import { api } from '@/lib/api';
type Copy = { heading: string; description: string; ctaLabel: string; dismissLabel: string };
export type PublicBanner = {
  id: string;
  revision: string;
  placement: string;
  targets: string[];
  homepageOnly: boolean;
  desktop: boolean;
  mobile: boolean;
  background: string;
  foreground: string;
  startsAt: string;
  expiresAt: string;
  dismissible: boolean;
  translations: Record<string, Copy>;
  ctaUrl?: string;
  desktopImage?: string;
  mobileImage?: string;
};
const Context = createContext<PublicBanner[]>([]);
export function WebsiteMarketingProvider({ children }: { children: React.ReactNode }) {
  const [banners, setBanners] = useState<PublicBanner[]>([]);
  const revision = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void api<{ banners: PublicBanner[]; revision: string }>('/v1/marketing')
        .then((result) => {
          if (!active || !Array.isArray(result.banners) || typeof result.revision !== 'string')
            return;
          setBanners(result.banners);
          if (revision.current !== null && revision.current !== result.revision)
            window.dispatchEvent(new Event('alozuri-promotions-changed'));
          revision.current = result.revision;
        })
        .catch(() => {
          if (active) setBanners([]);
        });
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return <Context.Provider value={banners}>{children}</Context.Provider>;
}
export function WebsiteBanner({ placement }: { placement: 'announcement' | 'page' }) {
  const banners = useContext(Context),
    locale = useLocale(),
    path = unlocalizedPath(usePathname());
  const [mobile, setMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const media = matchMedia('(max-width: 600px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [dismissed, setDismissed] = useState<string[]>([]),
    [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setDismissed((previous) => [
      ...new Set([
        ...previous,
        ...banners
          .filter((b) => {
            try {
              return (
                localStorage.getItem('alozuri-banner:' + b.id + ':' + b.revision) === 'dismissed'
              );
            } catch {
              return false;
            }
          })
          .map((b) => b.id + ':' + b.revision),
      ]),
    ]);
  }, [banners]);
  if (
    /^\/(?:operations|admin|api|checkout|account|dashboard|login|register|verify-email|forgot-password|cart)(?:\/|$)/.test(
      path,
    )
  )
    return null;
  const banner = banners.find(
    (b) =>
      mobile !== null &&
      (mobile ? b.mobile : b.desktop) &&
      !dismissed.includes(b.id + ':' + b.revision) &&
      Date.parse(b.startsAt) <= now &&
      now < Date.parse(b.expiresAt) &&
      (placement === 'announcement'
        ? b.placement === 'announcement' && (!b.homepageOnly || path === '/')
        : b.placement === 'homepage'
          ? path === '/'
          : b.placement === 'destination'
            ? b.targets.some((t) => path === '/destinations/' + t.toLowerCase())
            : b.placement === 'region' && b.targets.some((t) => path === '/destinations/' + t)),
  );
  if (!banner) return null;
  const translated = banner.translations[locale];
  const text =
    translated && (translated.heading || translated.description)
      ? translated
      : banner.translations.en;
  if (!text) return null;
  function dismiss() {
    if (!banner) return;
    setDismissed((old) => [...old, banner.id + ':' + banner.revision]);
    try {
      localStorage.setItem('alozuri-banner:' + banner.id + ':' + banner.revision, 'dismissed');
    } catch {
      /* Session dismissal still works. */
    }
  }
  return (
    <aside
      className={`${placement === 'announcement' ? 'marketing-announcement' : 'marketing-page-banner container'}${banner.mobile ? '' : ' marketing-desktop-only'}${banner.desktop ? '' : ' marketing-mobile-only'}`}
      style={{ background: banner.background, color: banner.foreground }}
    >
      {placement === 'page' && (banner.desktopImage || banner.mobileImage) && (
        <picture>
          {banner.mobileImage && <source media="(max-width: 600px)" srcSet={banner.mobileImage} />}
          <Image
            unoptimized
            src={banner.desktopImage || banner.mobileImage || ''}
            width={1160}
            height={400}
            alt=""
            className="marketing-image"
          />
        </picture>
      )}
      <div className="marketing-copy">
        {text.heading &&
          (placement === 'announcement' ? (
            <strong>{text.heading}</strong>
          ) : (
            <h2>{text.heading}</h2>
          ))}
        {text.description && <p>{text.description}</p>}
        {text.ctaLabel && banner.ctaUrl && (
          <Link
            className={placement === 'page' ? 'button' : 'text-link'}
            href={banner.ctaUrl}
            {...(banner.ctaUrl.startsWith('https://')
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            {text.ctaLabel}
            <span aria-hidden="true"> →</span>
          </Link>
        )}
      </div>
      {banner.dismissible && (
        <button
          className="marketing-dismiss"
          type="button"
          onClick={dismiss}
          aria-label={text.dismissLabel}
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </aside>
  );
}
