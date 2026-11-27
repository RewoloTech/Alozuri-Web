'use client';
import { useEffect, useRef, useState } from 'react';
import type { OperationsReport } from '@alozuri/shared/financial';
import { api } from '@/lib/api';
import { StoreApiError } from '@/lib/api-error';
type Promotion = {
  name?: string;
  scope?: { kind: string; values: string[]; excludedProducts: string[] };
  discount?: { kind: string; value: number };
  automatic?: boolean;
  priority?: number;
  minimumOrderUsdCents?: number;
  campaignId?: string;
  code: string;
  discountPercent: number;
  active: boolean;
  startsAt: string;
  expiresAt: string;
  maxUses: number | null;
  redemptionCount: number;
  reservedCount: number;
  totals: Record<string, { revenueMinor: number; discountMinor: number }>;
};
type Preview = {
  originalMinor: number;
  discountMinor: number;
  finalMinor: number;
  supplierMinor: number;
  estimatedFeeMinor: number;
  contributionMinor: number;
  marginBps: number;
  warning: string;
  feeBasis: string;
};
type PackageMatches = { rows: { id: string; name: string }[]; hasMore: boolean };
const defaultDiscountPercent = 10;
const usd = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' }).format(n / 100);
export function PromotionsPanel({ uid }: { uid: string }) {
  const [rows, setRows] = useState<Promotion[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [cursor, setCursor] = useState<string | undefined>(),
    [next, setNext] = useState<string | null>(null);
  const [code, setCode] = useState(''),
    [percent, setPercent] = useState(defaultDiscountPercent),
    [active, setActive] = useState(true),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [limit, setLimit] = useState(''),
    [editing, setEditing] = useState(false);
  const [destinationSearch, setDestinationSearch] = useState(''),
    [availableCountries, setAvailableCountries] = useState<{ code: string; name: string }[]>([]),
    [productTags, setProductTags] = useState('');
  useEffect(() => {
    void api<{ countries: { code: string; name: string }[] }>('/v1/countries')
      .then((r) => setAvailableCountries(Array.isArray(r.countries) ? r.countries : []))
      .catch(() => setAvailableCountries([]));
  }, []);
  const [targetText, setTargetText] = useState('');
  const [scopeKind, setScopeKind] = useState('all'),
    [targets, setTargets] = useState<string[]>([]),
    [excluded, setExcluded] = useState('');
  const [discountKind, setDiscountKind] = useState('percent'),
    [discountValue, setDiscountValue] = useState(100);
  const [campaignName, setCampaignName] = useState(''),
    [automatic, setAutomatic] = useState(false),
    [priority, setPriority] = useState(0),
    [minimum, setMinimum] = useState(0),
    [campaignId, setCampaignId] = useState('');
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    void api<{ campaigns: { id: string; name: string }[] }>('/v1/operations/marketing', {}, uid)
      .then((r) => setCampaigns(r.campaigns ?? []))
      .catch(() => setCampaigns([]));
  }, [uid]);
  const [packageSearch, setPackageSearch] = useState('');
  const [packageMatches, setPackageMatches] = useState<PackageMatches | null>(null);
  const [packageId, setPackageId] = useState('');
  const [packageBusy, setPackageBusy] = useState(false);
  const [packageError, setPackageError] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const packageRequest = useRef<AbortController | null>(null);
  const previewRequest = useRef<AbortController | null>(null);
  const packages = packageMatches?.rows ?? [];
  const selectedPackage = packages.find((p) => p.id === packageId);
  const validPercent = Number.isInteger(percent) && percent >= 1 && percent <= 50;
  const validAmount =
    Number.isInteger(discountValue) && discountValue >= 1 && discountValue <= 99999999;
  const validDiscount = discountKind === 'percent' ? validPercent : validAmount;
  const discountPercent = validPercent ? percent : defaultDiscountPercent;
  const discount = {
    kind: discountKind,
    value: discountKind === 'percent' ? percent : discountValue,
  };
  const canPreview = Boolean(selectedPackage) && validDiscount && !previewBusy;

  function clearPreview() {
    previewRequest.current?.abort();
    setPreview(null);
    setPreviewBusy(false);
    setPreviewError('');
  }
  function resetEditor() {
    setEditing(false);
    setCode('');
    clearPreview();
    setPercent(defaultDiscountPercent);
    setActive(true);
    setStart('');
    setEnd('');
    setLimit('');
    setScopeKind('all');
    setTargets([]);
    setTargetText('');
    setExcluded('');
    setDiscountKind('percent');
    setDiscountValue(100);
    setCampaignName('');
    setAutomatic(false);
    setPriority(0);
    setMinimum(0);
    setCampaignId('');
  }
  useEffect(() => {
    return () => {
      packageRequest.current?.abort();
      previewRequest.current?.abort();
    };
  }, [uid]);
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    const params = new URLSearchParams({ q });
    if (status) params.set('active', status);
    if (cursor) params.set('after', cursor);
    setBusy(true);
    setError('');
    void api<{ rows: Promotion[]; nextCursor: string | null }>(
      '/v1/operations/promotions?' + params,
      { signal: controller.signal },
      uid,
    )
      .then((r) => {
        if (live) {
          setRows(r.rows);
          setNext(r.nextCursor);
        }
      })
      .catch((e: unknown) => {
        if (live) {
          setRows([]);
          setError(e instanceof Error ? e.message : 'Could not load promotions.');
        }
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [uid, q, status, cursor, attempt]);
  function toggleTarget(id: string) {
    const next = targets.includes(id) ? targets.filter((value) => value !== id) : [...targets, id];
    setTargets(next);
    setTargetText(next.join(', '));
  }
  async function saveTags() {
    setBusy(true);
    setSaveError('');
    try {
      await api(
        '/v1/operations/promotions/products/' + encodeURIComponent(packageId) + '/tags',
        {
          method: 'PUT',
          body: JSON.stringify({
            tags: productTags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
          }),
        },
        uid,
      );
      setActionMessage('Product tags saved.');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save tags.');
    } finally {
      setBusy(false);
    }
  }
  async function findPackages() {
    if (packageBusy) return;
    const controller = new AbortController();
    packageRequest.current = controller;
    setPackageBusy(true);
    setPackageError('');
    setPackageMatches(null);
    setPackageId('');
    clearPreview();
    try {
      const result = await api<PackageMatches>(
        '/v1/operations/promotions/packages?' + new URLSearchParams({ q: packageSearch.trim() }),
        { signal: controller.signal },
        uid,
      );
      if (!controller.signal.aborted) setPackageMatches(result);
    } catch {
      if (!controller.signal.aborted) setPackageError('Could not find packages. Try again.');
    } finally {
      if (!controller.signal.aborted) setPackageBusy(false);
    }
  }
  async function check() {
    if (!canPreview) return;
    clearPreview();
    const controller = new AbortController();
    previewRequest.current = controller;
    setPreviewBusy(true);
    try {
      const result = await api<Preview>(
        '/v1/operations/promotions/preview',
        {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            packageId,
            discountPercent,
            discount,
          }),
        },
        uid,
      );
      if (!controller.signal.aborted) setPreview(result);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof StoreApiError && e.code === 'PROMO_CODE_NOT_APPLICABLE')
        setPreviewError('Set a discount that reduces the selected package price by up to 50%.');
      else if (e instanceof StoreApiError && e.code === 'PLAN_UNAVAILABLE')
        setPreviewError(
          'This package can no longer be previewed. Search again to choose an eligible package.',
        );
      else
        setPreviewError(
          e instanceof Error ? e.message : 'Could not estimate profitability. Try again.',
        );
    } finally {
      if (!controller.signal.aborted) setPreviewBusy(false);
    }
  }
  async function save() {
    setSaved(false);
    const missing: string[] = [];
    if (!/^[A-Z0-9_-]{3,32}$/.test(code.trim()))
      missing.push('Enter a code of 3–32 letters, numbers, hyphens or underscores.');
    if (discountKind === 'percent' && !validPercent)
      missing.push('Choose a whole-number discount between 1% and 50%.');
    if (discountKind !== 'percent' && !validAmount)
      missing.push('Enter a whole-number amount from 1 to 99,999,999 USD cents.');
    const starts = Date.parse(start + 'Z'),
      expires = Date.parse(end + 'Z');
    if (!Number.isFinite(starts)) missing.push('Set the start date and time (UTC).');
    if (!Number.isFinite(expires)) missing.push('Set the expiry date and time (UTC).');
    if (Number.isFinite(starts) && Number.isFinite(expires) && starts >= expires)
      missing.push('Set an expiry later than the start date.');
    if (limit && (!Number.isSafeInteger(Number(limit)) || Number(limit) <= 0))
      missing.push('Enter a positive whole-number usage limit, or leave it empty.');
    if (!preview)
      missing.push(
        'Choose a package and click Preview impact before saving. Profitability warnings do not prevent saving.',
      );
    setSaveError(missing.join(' '));
    if (missing.length) return;
    setBusy(true);
    setError('');
    try {
      await api(
        '/v1/operations/promotions',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify({
            code,
            ...(campaignName ? { name: campaignName } : {}),
            scope: {
              kind: scopeKind,
              values: targets,
              excludedProducts: excluded
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            },
            discount,
            automatic,
            priority,
            minimumOrderUsdCents: minimum,
            ...(campaignId ? { campaignId } : {}),
            discountPercent,
            active,
            startsAt: new Date(start + 'Z').toISOString(),
            expiresAt: new Date(end + 'Z').toISOString(),
            maxUses: limit ? Number(limit) : null,
          }),
        },
        uid,
      );
      setSaved(true);
      setAttempt((n) => n + 1);
      setCode('');
      setEditing(false);
      clearPreview();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }
  async function changePromotion(p: Promotion, remove = false) {
    if (
      remove &&
      !window.confirm(`Permanently delete unused promotion ${p.code}? This cannot be undone.`)
    )
      return;
    setActionBusy(p.code);
    setActionMessage('');
    setError('');
    try {
      await api(
        '/v1/operations/promotions/' + encodeURIComponent(p.code) + (remove ? '' : '/status'),
        {
          method: remove ? 'DELETE' : 'PATCH',
          ...(remove ? {} : { body: JSON.stringify({ active: !p.active }) }),
        },
        uid,
      );
      if (editing && code === p.code) {
        if (remove) {
          setEditing(false);
          setCode('');
          clearPreview();
        } else setActive(!p.active);
      }
      setActionMessage(`${p.code} ${remove ? 'deleted' : p.active ? 'deactivated' : 'activated'}.`);
      setCursor(undefined);
      setAttempt((value) => value + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Promotion could not be updated.');
    } finally {
      setActionBusy(null);
    }
  }
  return (
    <section className="promotions-panel">
      <h2>Promotions</h2>
      <p>One code per order. Maximum discount 50%. Profitability warnings are advisory.</p>
      {actionMessage && <p role="status">{actionMessage}</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="surface">
        <label>
          Find code
          <input
            className="commerce-input"
            value={q}
            maxLength={32}
            onChange={(e) => {
              setQ(e.target.value.toUpperCase());
              setCursor(undefined);
            }}
          />
        </label>
        <label>
          Status
          <select
            className="commerce-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setCursor(undefined);
            }}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        {busy && <p role="status">Loading…</p>}
        {rows.map((p) => (
          <div key={p.code}>
            <h3>
              {p.code} ·{' '}
              {p.discount && p.discount.kind !== 'percent'
                ? `${(p.discount.value / 100).toFixed(2)} USD ${p.discount.kind === 'fixed' ? 'off' : 'price'}`
                : `${p.discountPercent}%`}{' '}
              · {p.active ? 'Active' : 'Inactive'}
            </h3>
            <p>
              {p.redemptionCount} paid redemptions · {p.reservedCount} pending reservations
            </p>
            {Object.entries(p.totals).map(([c, t]) => (
              <p key={c}>
                {c}: gross revenue {(t.revenueMinor / 100).toFixed(2)} · discounts granted{' '}
                {(t.discountMinor / 100).toFixed(2)}
              </p>
            ))}
            <div className="operations-plan-search-actions">
              <button
                type="button"
                className="button"
                disabled={busy || Boolean(actionBusy)}
                onClick={() => void changePromotion(p)}
              >
                {p.active ? 'Deactivate code' : 'Activate code'}
              </button>
              <button
                type="button"
                className="button"
                disabled={
                  busy || Boolean(actionBusy) || p.redemptionCount > 0 || p.reservedCount > 0
                }
                onClick={() => void changePromotion(p, true)}
              >
                Delete unused code
              </button>
              <button
                className="button"
                disabled={busy || Boolean(actionBusy)}
                onClick={() => {
                  setScopeKind(p.scope?.kind ?? 'all');
                  setTargets(p.scope?.values ?? []);
                  setTargetText(p.scope?.values.join(', ') ?? '');
                  setExcluded(p.scope?.excludedProducts.join(',') ?? '');
                  setDiscountKind(p.discount?.kind ?? 'percent');
                  setDiscountValue(p.discount?.value ?? 100);
                  setCampaignName(p.name ?? '');
                  setAutomatic(p.automatic ?? false);
                  setPriority(p.priority ?? 0);
                  setMinimum(p.minimumOrderUsdCents ?? 0);
                  setCampaignId(p.campaignId ?? '');
                  setCode(p.code);
                  setPercent(p.discountPercent);
                  setActive(p.active);
                  setStart(p.startsAt.slice(0, 16));
                  setEnd(p.expiresAt.slice(0, 16));
                  setLimit(p.maxUses?.toString() ?? '');
                  setEditing(true);
                  clearPreview();
                }}
              >
                Edit code
              </button>
            </div>
            {(p.redemptionCount > 0 || p.reservedCount > 0) && (
              <p className="fine-print">Used or reserved codes can be deactivated, not deleted.</p>
            )}
          </div>
        ))}
        {!busy && !rows.length && <p>No promotions found.</p>}
        <div className="operations-pagination">
          <button className="button" disabled={!cursor} onClick={() => setCursor(undefined)}>
            First page
          </button>
          <button
            className="button"
            disabled={!next || busy}
            onClick={() => setCursor(next ?? undefined)}
          >
            Next codes
          </button>
        </div>
      </div>
      <div className="surface" onChange={() => setSaveError('')}>
        <h3>{editing ? 'Edit promotion' : 'Create promotion'}</h3>
        <label>
          Code
          <input
            className="commerce-input"
            value={code}
            disabled={editing}
            maxLength={32}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </label>
        <label>
          Campaign name
          <input
            className="commerce-input"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            maxLength={120}
          />
        </label>
        <label>
          Discount applies to
          <select
            className="commerce-input"
            value={scopeKind}
            onChange={(e) => {
              setScopeKind(e.target.value);
              setTargets([]);
              setTargetText('');
            }}
          >
            <option value="all">All packages (default)</option>
            <option value="products">Individual / multiple packages</option>
            <option value="destinations">Individual / multiple destinations</option>
            <option value="regions">Selected regions</option>
            <option value="tags">Product categories / tags</option>
          </select>
        </label>
        <p className="muted">
          Destination targeting requires the plan’s full coverage to be within the selected
          countries. Regional targeting uses verified regional bundle coverage; use destinations for
          local plans.
        </p>
        {scopeKind !== 'all' && (
          <label>
            Selected target IDs (comma-separated)
            <input
              className="commerce-input"
              value={targetText}
              onChange={(e) => {
                setTargetText(e.target.value);
                setTargets(
                  e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                );
              }}
            />
          </label>
        )}
        {scopeKind === 'products' && (
          <div className="notice">
            <p>Use the catalogue search below to select internal products.</p>
            {packages.map((product) => (
              <label className="checkbox-label" key={product.id}>
                <input
                  type="checkbox"
                  checked={targets.includes(product.id)}
                  onChange={() => toggleTarget(product.id)}
                />
                {product.name}
              </label>
            ))}
          </div>
        )}
        {scopeKind === 'destinations' && (
          <div className="notice">
            <label>
              Search destinations
              <input
                className="commerce-input"
                value={destinationSearch}
                onChange={(e) => setDestinationSearch(e.target.value)}
              />
            </label>
            {availableCountries
              .filter((c) =>
                (c.name + c.code).toLowerCase().includes(destinationSearch.toLowerCase()),
              )
              .slice(0, 16)
              .map((c) => (
                <label className="checkbox-label" key={c.code}>
                  <input
                    type="checkbox"
                    checked={targets.includes(c.code)}
                    onChange={() => toggleTarget(c.code)}
                  />
                  {c.name}
                </label>
              ))}
          </div>
        )}
        {scopeKind === 'destinations' && (
          <p className="fine-print">
            Use existing ISO destination codes. A plan must cover only the selected destinations to
            qualify.
          </p>
        )}
        {scopeKind === 'regions' && (
          <div className="operations-esim-search">
            {[
              'europe',
              'asia',
              'north-america',
              'global',
              'africa',
              'south-america',
              'oceania',
            ].map((region) => (
              <label className="checkbox-label" key={region}>
                <input
                  type="checkbox"
                  checked={targets.includes(region)}
                  onChange={() => toggleTarget(region)}
                />
                {region}
              </label>
            ))}
          </div>
        )}
        <label>
          Excluded internal package IDs (comma-separated)
          <input
            className="commerce-input"
            value={excluded}
            onChange={(e) => setExcluded(e.target.value)}
          />
        </label>
        <label>
          Discount type
          <select
            className="commerce-input"
            value={discountKind}
            onChange={(e) => {
              setDiscountKind(e.target.value);
              clearPreview();
            }}
          >
            <option value="percent">Percentage</option>
            <option value="fixed">Fixed amount off</option>
            <option value="price">Promotional selling price</option>
          </select>
        </label>
        {discountKind !== 'percent' && (
          <label>
            Amount in USD cents (100 = $1.00)
            <input
              className="commerce-input"
              type="number"
              min={1}
              max={99999999}
              step={1}
              value={discountValue}
              onChange={(e) => {
                setDiscountValue(Number(e.target.value));
                clearPreview();
              }}
            />
          </label>
        )}
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={automatic}
            onChange={(e) => {
              setAutomatic(e.target.checked);
              if (e.target.checked) {
                setMinimum(0);
                setLimit('');
              }
            }}
          />
          Apply automatically to website prices (no code entry)
        </label>
        <label>
          Priority (higher wins; code breaks ties)
          <input
            className="commerce-input"
            type="number"
            min={0}
            max={10000}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </label>
        <label>
          Minimum order value in USD cents (code discounts only)
          <input
            className="commerce-input"
            type="number"
            min={0}
            disabled={automatic}
            value={minimum}
            onChange={(e) => setMinimum(Number(e.target.value))}
          />
        </label>
        <label>
          Link to campaign
          <select
            className="commerce-input"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">Independent promotion</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div hidden={discountKind !== 'percent'}>
          <label>
            Discount % (1–50)
            <input
              className="commerce-input"
              type="number"
              min={1}
              max={50}
              step={1}
              value={percent}
              onChange={(e) => {
                setPercent(Number(e.target.value));
                clearPreview();
              }}
            />
          </label>
          <div className="operations-esim-search">
            {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((n) => (
              <button
                type="button"
                className="button small"
                key={n}
                onClick={() => {
                  setPercent(n);
                  clearPreview();
                }}
              >
                {n}%
              </button>
            ))}
          </div>
        </div>
        <label>
          Starts at (UTC)
          <input
            className="commerce-input"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Expires at (UTC)
          <input
            className="commerce-input"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label>
          Maximum paid uses (optional)
          <input
            className="commerce-input"
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
        <section aria-labelledby="promotion-profitability-heading">
          <h3 id="promotion-profitability-heading">Check a package’s estimated profitability</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void findPackages();
            }}
          >
            <label>
              Package search
              <input
                className="commerce-input"
                type="search"
                maxLength={100}
                placeholder="e.g. Global 1 GB 7 days"
                value={packageSearch}
                onChange={(e) => setPackageSearch(e.target.value)}
              />
            </label>
            <button type="submit" className="button" disabled={packageBusy}>
              Find packages
            </button>
          </form>
          <div role="status">
            {packageBusy && <p>Searching packages…</p>}
            {packageMatches &&
              (packages.length === 0 ? (
                <p>No eligible packages found. Try a shorter search.</p>
              ) : (
                <p>
                  {packageMatches.hasMore
                    ? `Showing ${packages.length} matches. Add details such as data or validity to narrow your search.`
                    : `${packages.length} ${packages.length === 1 ? 'package' : 'packages'} found.`}
                </p>
              ))}
          </div>
          {packageError && (
            <p className="error-message" role="alert">
              {packageError}
            </p>
          )}
          <label>
            Package
            <select
              className="commerce-input"
              value={packageId}
              disabled={packages.length === 0}
              onChange={(e) => {
                setPackageId(e.target.value);
                clearPreview();
              }}
            >
              <option value="">Choose a package</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button"
            disabled={!canPreview}
            onClick={() => void check()}
          >
            Preview impact
          </button>
          {previewBusy && <p role="status">Estimating profitability…</p>}
          {previewError && (
            <p className="error-message" role="alert">
              {previewError}
            </p>
          )}
          {preview && (
            <div
              className={preview.warning === 'normal' ? 'notice' : 'error-message'}
              role="status"
            >
              <strong>
                {preview.warning === 'critical'
                  ? 'Critical: zero or negative contribution'
                  : preview.warning === 'low'
                    ? 'Low margin: below 20%'
                    : preview.warning === 'reduced'
                      ? 'Reduced profitability: below 25%'
                      : 'Normal profitability'}
              </strong>
              <p>Estimate for {selectedPackage?.name}.</p>
              <dl className="spec-list">
                {[
                  ['Original price', preview.originalMinor],
                  ['Discount', preview.discountMinor],
                  ['Final price', preview.finalMinor],
                  ['Supplier cost (rounded up)', preview.supplierMinor],
                  ['Estimated Stripe fees', preview.estimatedFeeMinor],
                  ['Estimated contribution', preview.contributionMinor],
                ].map(([label, n]) => (
                  <div key={String(label)}>
                    <dt>{label}</dt>
                    <dd>{usd(Number(n))}</dd>
                  </div>
                ))}
              </dl>
              <p>
                Contribution margin {(preview.marginBps / 100).toFixed(2)}% · {preview.feeBasis}
              </p>
            </div>
          )}
        </section>
        <label>
          Product categories / tags to set (comma-separated)
          <input
            className="commerce-input"
            value={productTags}
            onChange={(e) => setProductTags(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="button"
          disabled={busy || !packageId}
          onClick={() => void saveTags()}
        >
          Save product tags
        </button>
        <button
          className="button primary"
          disabled={busy || Boolean(actionBusy)}
          onClick={save}
          aria-describedby={saveError ? 'promotion-save-error' : undefined}
        >
          Save promotion
        </button>
        {saveError && (
          <p id="promotion-save-error" className="error-message" role="alert">
            {saveError}
          </p>
        )}
        {saved && <p role="status">Promotion saved.</p>}
        {editing && (
          <button
            className="button"
            onClick={() => {
              resetEditor();
            }}
          >
            New code
          </button>
        )}
      </div>
    </section>
  );
}

export function PromotionPerformance({
  rows,
}: {
  rows: NonNullable<OperationsReport['promotions']>;
}) {
  const money = (amount: number | null, currency = 'GBP') =>
    amount === null
      ? 'Pending'
      : new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount / 100);
  return (
    <details className="surface operations-transactions">
      <summary>Promotion performance</summary>
      <p className="fine-print">
        Selected order dates, Europe/London. Revenue includes refunds; discounts are amounts
        originally granted. Contribution is before other operating expenses and taxes. Pending
        values are not zero.
      </p>
      {!rows.length ? (
        <p>No paid promoted orders in this date range.</p>
      ) : (
        <div
          className="operations-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Promotion performance"
        >
          <table>
            <thead>
              <tr>
                {[
                  'Code / usage by date',
                  'Paid orders',
                  'Net revenue',
                  'Discounts granted',
                  'Supplier costs (GBP)',
                  'Stripe fees (GBP)',
                  'Contribution (GBP)',
                ].map((label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.code + row.currency}>
                  <td>
                    <strong>{row.code}</strong>
                    <details>
                      <summary>Usage by date</summary>
                      {row.usage.map((day) => (
                        <p key={day.date}>
                          {day.date}: {day.sales} paid order(s)
                        </p>
                      ))}
                    </details>
                  </td>
                  <td>{row.sales}</td>
                  <td>{money(row.revenueMinor, row.currency)}</td>
                  <td>{money(row.discountMinor, row.currency)}</td>
                  <td>{money(row.supplierGbp)}</td>
                  <td>{money(row.feesGbp)}</td>
                  <td>
                    {money(row.profitGbp)}
                    <small>{row.provisional ? 'Provisional / estimated' : 'Final'}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
