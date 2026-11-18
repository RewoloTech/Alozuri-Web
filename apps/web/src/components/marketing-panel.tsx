'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { LOCALES, LOCALE_NAMES } from '@alozuri/shared/i18n';
import { api, apiBlob } from '@/lib/api';
function MarketingImagePreview({ src }: { src: string }) {
  const [preview, setPreview] = useState('');
  const [failed, setFailed] = useState(false);
  const internal =
    src.startsWith('/api/store/v1/marketing/images/') || src.startsWith('/v1/marketing/images/');
  useEffect(() => {
    if (!internal) return;
    let active = true;
    let url = '';
    setPreview('');
    setFailed(false);
    void apiBlob(src.replace(/^\/api\/store/, ''), {}, true, 'image')
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (active) setPreview(url);
        else URL.revokeObjectURL(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src, internal]);
  const resolved = internal ? preview : src;
  return resolved ? (
    <Image
      unoptimized
      src={resolved}
      alt=""
      width={1160}
      height={400}
      style={{ width: '100%', height: 'auto' }}
    />
  ) : (
    <p role="status">{failed ? 'Image preview unavailable.' : 'Loading image…'}</p>
  );
}
import { PromotionsPanel } from './promotions';
import type { PublicBanner } from './website-marketing';
type Campaign = {
  id: string;
  name: string;
  active: boolean;
  startsAt: string;
  expiresAt: string;
  status?: string;
};
type Banner = Omit<PublicBanner, 'revision'> & {
  name: string;
  active: boolean;
  priority: number;
  campaignId?: string;
  promotionId?: string;
  status?: string;
};
type Data = {
  performance?: {
    since: string;
    truncated: boolean;
    excludedRecords: number;
    rows: {
      campaign: string;
      currency: string;
      revenueMinor: number;
      discountMinor: number;
      estimatedContributionMinor: number | null;
      purchases: number;
    }[];
  };
  campaigns: Campaign[];
  banners: Banner[];
  promotions: {
    id: string;
    campaignId: string | null;
    status: string;
    totals: Record<string, { revenueMinor: number; discountMinor: number }>;
  }[];
  overview: {
    marginWarnings: number;
    blockedPackages?: { promotionId: string; productId: string }[];
    catalogueTruncated?: boolean;
    activePromotions: number;
    scheduledPromotions: number;
    announcements: number;
    homepageBanners: number;
    upcomingExpirations: { id: string; name: string; expiresAt: string }[];
  };
};
const schedule = () => ({
  active: false,
  startsAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
});
const blankCampaign = (): Campaign => ({ id: '', name: '', ...schedule() });
const blankBanner = (): Banner => ({
  id: '',
  name: '',
  ...schedule(),
  placement: 'announcement',
  targets: [],
  homepageOnly: false,
  desktop: true,
  mobile: true,
  priority: 0,
  dismissible: false,
  background: '#4338CA',
  foreground: '#FFFFFF',
  translations: {
    en: { heading: '', description: '', ctaLabel: '', dismissLabel: 'Dismiss announcement' },
  },
});
const tabs = [
  'Promotions & Discounts',
  'Website Banners',
  'Campaign Management',
  'Campaign Performance',
];
function utc(value: string) {
  return value ? new Date(value + 'Z').toISOString() : '';
}
export function MarketingPanel({ uid }: { uid: string }) {
  const [tab, setTab] = useState(tabs[0]),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const [campaign, setCampaign] = useState<Campaign>(blankCampaign),
    [banner, setBanner] = useState<Banner>(blankBanner),
    [language, setLanguage] = useState('en'),
    [device, setDevice] = useState('desktop');
  useEffect(() => {
    const controller = new AbortController();
    void api<Data>('/v1/operations/marketing', { signal: controller.signal }, uid)
      .then((r) => {
        if (!Array.isArray(r.campaigns) || !Array.isArray(r.banners))
          throw new Error('Marketing data unavailable.');
        setData(r);
        setError('');
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Marketing could not be loaded. Retry to manage campaigns and banners.');
      });
    return () => controller.abort();
  }, [uid, refresh]);
  async function save(kind: 'campaigns' | 'banners') {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const value = kind === 'campaigns' ? campaign : banner;
    const { status: ignored, ...clean } = value;
    void ignored;
    try {
      const body =
        kind === 'banners'
          ? {
              ...clean,
              campaignId: banner.campaignId || undefined,
              promotionId: banner.promotionId || undefined,
              ctaUrl: banner.ctaUrl || undefined,
              desktopImage: banner.desktopImage || undefined,
              mobileImage: banner.mobileImage || undefined,
            }
          : clean;
      await api(
        '/v1/operations/marketing/' + kind,
        { method: 'PUT', body: JSON.stringify(body) },
        uid,
      );
      setNotice('Saved. Publication follows the active setting and UTC schedule.');
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }
  async function remove(kind: 'campaigns' | 'banners', id: string) {
    if (
      !window.confirm('Delete this ' + (kind === 'banners' ? 'banner' : 'unlinked campaign') + '?')
    )
      return;
    setBusy(true);
    try {
      await api(
        '/v1/operations/marketing/' + kind + '/' + encodeURIComponent(id),
        { method: 'DELETE' },
        uid,
      );
      setRefresh((n) => n + 1);
      setNotice('Deleted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.');
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined, mobile: boolean) {
    if (!file) return;
    if (file.size > 500000) {
      setError('Choose a PNG, JPEG or WebP image under 500 KB.');
      return;
    }
    setBusy(true);
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result.split(',')[1])
            : reject(new Error('Could not read image.'));
        reader.onerror = () => reject(new Error('Could not read image.'));
        reader.readAsDataURL(file);
      });
      const result = await api<{ path: string }>(
        '/v1/operations/marketing/images',
        { method: 'POST', body: JSON.stringify({ content, contentType: file.type }) },
        uid,
      );
      setBanner((old) => ({
        ...old,
        [mobile ? 'mobileImage' : 'desktopImage']: '/api/store' + result.path,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed.');
    } finally {
      setBusy(false);
    }
  }
  const copy = banner.translations[language] ?? {
    heading: '',
    description: '',
    ctaLabel: '',
    dismissLabel: '',
  };
  const previewCopy = copy.heading || copy.description ? copy : banner.translations.en;
  function text(key: keyof typeof copy, value: string) {
    setBanner((old) => ({
      ...old,
      translations: { ...old.translations, [language]: { ...copy, [key]: value } },
    }));
  }
  return (
    <div className="stack">
      <h2>Marketing</h2>
      <nav className="operations-esim-search" aria-label="Marketing sections">
        {tabs.map((t) => (
          <button
            className="button small"
            type="button"
            aria-pressed={tab === t}
            key={t}
            onClick={() => {
              setTab(t);
              setError('');
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      {data?.overview && (
        <div className="operations-summary">
          {[
            ['Active promotions', data.overview.activePromotions],
            ['Scheduled promotions', data.overview.scheduledPromotions],
            ['Published announcement bars', data.overview.announcements],
            ['Active homepage banners', data.overview.homepageBanners],
            ['Contribution margin warnings', data.overview.marginWarnings],
          ].map(([label, count]) => (
            <div className="surface" key={label}>
              <span>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      )}
      {!!data?.overview.blockedPackages?.length && (
        <details className="notice">
          <summary>
            Discounts blocked by margin protection ({data.overview.blockedPackages.length})
          </summary>
          <ul>
            {data.overview.blockedPackages.slice(0, 50).map((p) => (
              <li key={p.promotionId + ':' + p.productId}>
                {p.promotionId} · {p.productId}
              </li>
            ))}
          </ul>
          {data.overview.blockedPackages.length > 50 && (
            <p>Showing the first 50 blocked package / promotion combinations.</p>
          )}
        </details>
      )}
      {data?.overview.catalogueTruncated && (
        <p className="notice">
          Margin overview covers the first 1,000 active products. Checkout always validates every
          purchased item.
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && tab !== tabs[0] && (
        <p role="alert">
          {error}{' '}
          <button className="button small" onClick={() => setRefresh((n) => n + 1)}>
            Retry
          </button>
        </p>
      )}
      {tab === tabs[0] ? (
        <PromotionsPanel uid={uid} />
      ) : tab === tabs[1] ? (
        <>
          <h3>Website Banners</h3>
          <div className="operations-esim-search">
            <button
              className="button"
              onClick={() => {
                setBanner(blankBanner());
                setLanguage('en');
              }}
            >
              New banner
            </button>
            {(data?.banners ?? []).map((b) => (
              <div className="surface" key={b.id}>
                <strong>{b.name}</strong>
                <p>
                  {b.placement} · {b.status}
                </p>
                <button className="button small" onClick={() => setBanner(b)}>
                  Edit / pause
                </button>
                <button
                  className="button small"
                  disabled={busy}
                  onClick={() => void remove('banners', b.id)}
                >
                  Delete banner
                </button>
              </div>
            ))}
          </div>
          <div className="surface stack">
            <label>
              Banner ID
              <input
                className="commerce-input"
                value={banner.id}
                onChange={(e) => setBanner({ ...banner, id: e.target.value })}
                maxLength={100}
              />
            </label>
            <label>
              Internal name
              <input
                className="commerce-input"
                value={banner.name}
                onChange={(e) => setBanner({ ...banner, name: e.target.value })}
              />
            </label>
            <label>
              Placement
              <select
                className="commerce-input"
                value={banner.placement}
                onChange={(e) => setBanner({ ...banner, placement: e.target.value })}
              >
                <option value="announcement">Top Announcement Bar</option>
                <option value="homepage">Homepage Banners</option>
                <option value="destination">Destination page</option>
                <option value="region">Regional page</option>
              </select>
            </label>
            {['destination', 'region'].includes(banner.placement) && (
              <label>
                Target destination codes / region IDs (comma-separated)
                <input
                  className="commerce-input"
                  defaultValue={banner.targets.join(', ')}
                  key={banner.id + banner.placement}
                  onBlur={(e) =>
                    setBanner({
                      ...banner,
                      targets: e.target.value
                        .split(',')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            )}
            <label>
              Campaign
              <select
                className="commerce-input"
                value={banner.campaignId ?? ''}
                onChange={(e) => setBanner({ ...banner, campaignId: e.target.value })}
              >
                <option value="">Independent banner</option>
                {(data?.campaigns ?? []).map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Discount connection
              <select
                className="commerce-input"
                value={banner.promotionId ?? ''}
                onChange={(e) => setBanner({ ...banner, promotionId: e.target.value })}
              >
                <option value="">No discount</option>
                {(data?.promotions ?? []).map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.id} · {p.status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Content language
              <select
                className="commerce-input"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {LOCALE_NAMES[l]}
                  </option>
                ))}
              </select>
            </label>
            <p>Missing translations use the English campaign content.</p>
            <label>
              Heading / announcement message
              <input
                className="commerce-input"
                value={copy.heading}
                onChange={(e) => text('heading', e.target.value)}
                maxLength={160}
              />
            </label>
            <label>
              Description
              <textarea
                className="commerce-input"
                value={copy.description}
                onChange={(e) => text('description', e.target.value)}
                maxLength={500}
              />
            </label>
            <label>
              CTA label
              <input
                className="commerce-input"
                value={copy.ctaLabel}
                onChange={(e) => text('ctaLabel', e.target.value)}
                maxLength={80}
              />
            </label>
            <label>
              CTA destination URL
              <input
                className="commerce-input"
                value={banner.ctaUrl ?? ''}
                onChange={(e) => setBanner({ ...banner, ctaUrl: e.target.value })}
              />
            </label>
            <label>
              Dismiss button label
              <input
                className="commerce-input"
                value={copy.dismissLabel}
                onChange={(e) => text('dismissLabel', e.target.value)}
              />
            </label>
            {banner.placement !== 'announcement' && (
              <>
                <label>
                  Desktop image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={(e) => void upload(e.target.files?.[0], false)}
                  />
                </label>
                <label>
                  Mobile image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={(e) => void upload(e.target.files?.[0], true)}
                  />
                </label>
                <label>
                  Desktop image URL
                  <input
                    className="commerce-input"
                    value={banner.desktopImage ?? ''}
                    onChange={(e) => setBanner({ ...banner, desktopImage: e.target.value })}
                  />
                </label>
                <label>
                  Mobile image URL
                  <input
                    className="commerce-input"
                    value={banner.mobileImage ?? ''}
                    onChange={(e) => setBanner({ ...banner, mobileImage: e.target.value })}
                  />
                </label>
              </>
            )}
            <div className="name-fields">
              <label>
                Background
                <input
                  type="color"
                  value={banner.background}
                  onChange={(e) => setBanner({ ...banner, background: e.target.value })}
                />
              </label>
              <label>
                Text colour
                <input
                  type="color"
                  value={banner.foreground}
                  onChange={(e) => setBanner({ ...banner, foreground: e.target.value })}
                />
              </label>
            </div>
            <div className="name-fields">
              <label>
                Start (UTC)
                <input
                  className="commerce-input"
                  type="datetime-local"
                  value={banner.startsAt.slice(0, 16)}
                  onChange={(e) => setBanner({ ...banner, startsAt: utc(e.target.value) })}
                />
              </label>
              <label>
                Expiry (UTC)
                <input
                  className="commerce-input"
                  type="datetime-local"
                  value={banner.expiresAt.slice(0, 16)}
                  onChange={(e) => setBanner({ ...banner, expiresAt: utc(e.target.value) })}
                />
              </label>
            </div>
            <label>
              Priority
              <input
                className="commerce-input"
                type="number"
                min={0}
                max={10000}
                value={banner.priority}
                onChange={(e) => setBanner({ ...banner, priority: Number(e.target.value) })}
              />
            </label>
            {(['active', 'homepageOnly', 'mobile', 'desktop', 'dismissible'] as const).map(
              (key) => (
                <label className="checkbox-label" key={key}>
                  <input
                    type="checkbox"
                    checked={banner[key]}
                    onChange={(e) => setBanner({ ...banner, [key]: e.target.checked })}
                  />
                  {key === 'active'
                    ? 'Publish / activate (subject to schedule)'
                    : key === 'homepageOnly'
                      ? 'Homepage only (announcement bar)'
                      : key === 'dismissible'
                        ? 'Allow dismissal'
                        : key + ' visibility'}
                </label>
              ),
            )}
            <h3>Preview before publishing</h3>
            <div className="operations-esim-search">
              <button className="button small" onClick={() => setDevice('desktop')}>
                Desktop preview
              </button>
              <button className="button small" onClick={() => setDevice('mobile')}>
                Mobile preview
              </button>
            </div>
            <div
              style={{
                maxWidth: device === 'mobile' ? 390 : '100%',
                background: banner.background,
                color: banner.foreground,
                borderRadius: 12,
                padding: banner.placement === 'announcement' ? 12 : 24,
              }}
            >
              <div className={banner.placement === 'announcement' ? 'marketing-copy' : 'stack'}>
                {(device === 'mobile'
                  ? banner.mobileImage || banner.desktopImage
                  : banner.desktopImage) && (
                  <MarketingImagePreview
                    src={
                      (device === 'mobile'
                        ? banner.mobileImage || banner.desktopImage
                        : banner.desktopImage) || ''
                    }
                  />
                )}
                <strong>{previewCopy?.heading}</strong>
                {previewCopy?.description && (
                  <p style={{ color: 'inherit' }}>{previewCopy.description}</p>
                )}
                {previewCopy?.ctaLabel && banner.ctaUrl && (
                  <span
                    className={banner.placement === 'announcement' ? 'text-link' : 'button'}
                    style={{
                      color: banner.placement === 'announcement' ? 'inherit' : '#171C2E',
                      textDecoration: banner.placement === 'announcement' ? 'underline' : undefined,
                    }}
                  >
                    {previewCopy.ctaLabel} →
                  </span>
                )}
              </div>
            </div>
            <button className="button primary" disabled={busy} onClick={() => void save('banners')}>
              Save banner
            </button>
          </div>
        </>
      ) : tab === tabs[2] ? (
        <>
          <h3>Campaign Management</h3>
          <button className="button" onClick={() => setCampaign(blankCampaign())}>
            New campaign
          </button>
          {(data?.campaigns ?? []).map((c) => (
            <div className="surface" key={c.id}>
              <strong>{c.name}</strong>
              <p>
                {c.status} · {c.startsAt} — {c.expiresAt}
              </p>
              <button className="button small" onClick={() => setCampaign(c)}>
                Edit / pause campaign
              </button>
              <button
                className="button small"
                disabled={busy}
                onClick={() => void remove('campaigns', c.id)}
              >
                Delete unlinked campaign
              </button>
            </div>
          ))}
          <div className="surface stack">
            <label>
              Campaign ID
              <input
                className="commerce-input"
                value={campaign.id}
                onChange={(e) => setCampaign({ ...campaign, id: e.target.value })}
              />
            </label>
            <label>
              Campaign name
              <input
                className="commerce-input"
                value={campaign.name}
                onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
              />
            </label>
            <label>
              Start (UTC)
              <input
                className="commerce-input"
                type="datetime-local"
                value={campaign.startsAt.slice(0, 16)}
                onChange={(e) => setCampaign({ ...campaign, startsAt: utc(e.target.value) })}
              />
            </label>
            <label>
              Expiry (UTC)
              <input
                className="commerce-input"
                type="datetime-local"
                value={campaign.expiresAt.slice(0, 16)}
                onChange={(e) => setCampaign({ ...campaign, expiresAt: utc(e.target.value) })}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={campaign.active}
                onChange={(e) => setCampaign({ ...campaign, active: e.target.checked })}
              />
              Active (subject to schedule)
            </label>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void save('campaigns')}
            >
              Save campaign
            </button>
          </div>
        </>
      ) : (
        <>
          <h3>Campaign Performance</h3>
          <p>
            Recorded gross paid revenue and discounts by currency, before refunds and operating
            costs. Currency totals are never added together.
          </p>
          <p>
            Last 30 days, from {data?.performance?.since ?? '—'}. Contributions are allocated
            estimates from the saved checkout snapshot, not final reconciled profit.
          </p>
          {(data?.performance?.truncated || data?.performance?.excludedRecords) && (
            <p role="status">
              This report is partial: narrow the period in Financial Overview for a complete
              financial audit.
            </p>
          )}
          {(data?.performance?.rows ?? []).map((row) => (
            <div className="surface" key={row.campaign + row.currency}>
              <strong>
                {row.campaign} · {row.currency}
              </strong>
              <p>
                {row.purchases} paid purchases · Revenue {(row.revenueMinor / 100).toFixed(2)} ·
                Discounts {(row.discountMinor / 100).toFixed(2)} · Estimated contribution{' '}
                {row.estimatedContributionMinor === null
                  ? 'Unavailable'
                  : (row.estimatedContributionMinor / 100).toFixed(2)}
              </p>
            </div>
          ))}
          <h3>Upcoming expirations</h3>
          {(data?.overview?.upcomingExpirations ?? []).map((p) => (
            <p key={p.id}>
              {p.name} · {p.expiresAt}
            </p>
          ))}
        </>
      )}
    </div>
  );
}
