'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type {
  PricingRow,
  PricingWorkspace,
  PricingConfig,
} from '@alozuri/shared/pricing-management';
import { Profiles, ScopeEditor, PackageEditor, usd, pct } from './pricing-editors';
import { PricingHistory } from './pricing-history';
const tabs = [
  'Overview',
  'Country Pricing',
  'Regional Pricing',
  'Package Overrides',
  'Competitor Benchmarks',
  'Pricing History',
] as const;
const base = '/v1/operations/pricing-management/';
type Preview = { rows: PricingRow[]; token: string; revision: string };
const post = <T,>(uid: string, path: string, data: object) =>
  api<T>(base + path, { method: 'POST', body: JSON.stringify(data) }, uid);
function outcome(r: PricingRow) {
  if (r.minimum === null || !r.proposed) return 'Price outside supported range';
  if (!r.safe) return r.exception ? 'Approved exception' : 'Below minimum';
  if (r.competitorTarget !== null && r.proposed > r.competitorTarget)
    return r.minimum > r.competitorTarget
      ? 'Not competitive · safety floor'
      : 'Cannot meet target at this price point';
  if (r.competitor !== null)
    return r.current < r.competitor ? 'More competitive already' : 'Competitive';
  return 'Meets minimum';
}
function Simulator({
  rows,
  preview,
  ids,
  clear,
  profiles,
}: {
  rows: PricingRow[];
  preview: boolean;
  ids: string[] | null;
  clear: () => void;
  profiles: PricingConfig['profiles'];
}) {
  const [search, find] = useState(''),
    [profile, setProfile] = useState(''),
    [affected, only] = useState(true),
    [limit, more] = useState(25);
  const group = ids ? new Set(ids) : null;
  const filtered = rows.filter(
    (r) =>
      (!profile || r.profile === profile) &&
      (!preview || !affected || r.affected) &&
      (!group || group.has(r.id)) &&
      (r.name + ' ' + r.id).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="surface">
      <h3>{preview ? 'Price change preview' : 'Package prices'}</h3>
      <div className="price-fields">
        <label>
          Search packages
          <input
            type="search"
            value={search}
            onChange={(e) => {
              find(e.target.value);
              more(25);
            }}
          />
        </label>
        <label>
          Simulator profile
          <select value={profile} onChange={(e) => setProfile(e.target.value)}>
            <option value="">All profiles</option>
            {Object.entries(profiles).map(([key, p]) => (
              <option key={key} value={key}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {preview && (
          <label>
            <input type="checkbox" checked={affected} onChange={(e) => only(e.target.checked)} />{' '}
            Affected packages only
          </label>
        )}
        {ids && (
          <button type="button" className="button" onClick={clear}>
            Show all destinations
          </button>
        )}
      </div>
      <p>
        {filtered.length} {filtered.length === 1 ? 'package' : 'packages'} · USD
      </p>
      {filtered.length > 0 && (
        <div className="operations-table-scroll" tabIndex={0} aria-label="Pricing simulation">
          <table>
            <thead>
              <tr>
                {[
                  'Package',
                  'Current → proposed',
                  'Supplier cost',
                  'Change',
                  'Est. fee',
                  'Contribution',
                  'Margin',
                  'Target contribution',
                  'Minimum safe',
                  'Benchmark',
                  'Status',
                ].map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, limit).map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.name}
                    <small>
                      {r.scope}
                      {!r.available ? ' · Hidden by catalogue review' : ''}
                    </small>
                  </td>
                  <td>
                    {usd(r.current)} → <strong>{usd(r.proposed || null)}</strong>
                  </td>
                  <td>${(r.units / 10000).toFixed(4)}</td>
                  <td>
                    {usd(r.proposed ? r.proposed - r.current : null)}
                    <small>
                      {r.current && r.proposed
                        ? ((r.proposed / r.current - 1) * 100).toFixed(1) + '%'
                        : '—'}
                    </small>
                  </td>
                  <td>{usd(r.fee)}</td>
                  <td>{usd(r.contribution)}</td>
                  <td>{pct(r.margin)}</td>
                  <td>{usd(r.target)}</td>
                  <td>{usd(r.minimum)}</td>
                  <td>
                    {r.competitor === null ? (
                      '—'
                    ) : (
                      <>
                        {usd(r.competitor)}
                        <small>
                          Current difference {usd(r.current - r.competitor)} (
                          {((r.current / r.competitor - 1) * 100).toFixed(1)}%)
                        </small>
                      </>
                    )}
                  </td>
                  <td>
                    {outcome(r)}
                    {r.competitorTarget !== null && (
                      <small>
                        Target {usd(r.competitorTarget)}
                        {r.proposed > r.competitorTarget
                          ? ' · Over by ' + usd(r.proposed - r.competitorTarget)
                          : ''}
                      </small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > limit && (
        <button className="button" type="button" onClick={() => more(limit + 25)}>
          Show more packages
        </button>
      )}
    </section>
  );
}
export function PricingManagementPanel({ uid }: { uid: string }) {
  const [tab, choose] = useState<(typeof tabs)[number]>('Overview'),
    [workspace, setWorkspace] = useState<PricingWorkspace | null>(null);
  const [config, setConfig] = useState<PricingConfig | null>(null),
    [rows, setRows] = useState<PricingRow[]>([]),
    [token, setToken] = useState(''),
    [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [ids, inspect] = useState<string[] | null>(null),
    [historyVersion, setHistoryVersion] = useState(''),
    [restore, setRestore] = useState('global');
  const form = useRef<HTMLFormElement>(null);
  const reload = useCallback(
    async (signal?: AbortSignal) => {
      const w = await api<PricingWorkspace>(base + 'workspace', { signal }, uid);
      const p = await api<Preview>(
        base + 'preview',
        { method: 'POST', body: JSON.stringify({ revision: w.revision }), signal },
        uid,
      );
      if (signal?.aborted) return;
      setWorkspace(w);
      setConfig(w.config);
      setRows(p.rows);
      setDirty(false);
      setToken('');
    },
    [uid],
  );
  useEffect(() => {
    const c = new AbortController();
    setBusy(true);
    reload(c.signal)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [reload]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pricing request failed.');
    } finally {
      setBusy(false);
    }
  };
  const edit = (next: PricingConfig) => {
    setConfig(next);
    setDirty(true);
    setToken('');
    setNotice('');
  };
  async function action(mode: 'draft' | 'preview' | 'publish' | 'cancel' | 'rollback' | 'retry') {
    if (!workspace || !config) return;
    if ((mode === 'draft' || mode === 'preview') && !form.current?.reportValidity()) return;
    await run(async () => {
      let revision = workspace.revision;
      let savedPreview: Preview | undefined;
      if ((mode === 'draft' || mode === 'preview') && dirty) {
        const saved = await post<Preview>(uid, 'draft', { revision, config });
        savedPreview = saved;
        revision = saved.revision;
        setWorkspace({ ...workspace, config, revision, hasDraft: true });
        setDirty(false);
        setToken('');
      }
      if (mode === 'draft') {
        const p = savedPreview ?? (await post<Preview>(uid, 'preview', { revision }));
        setRows(p.rows);
        setNotice('Draft saved. Preview the affected prices before publishing.');
        return;
      }
      if (mode === 'preview') {
        const p = savedPreview ?? (await post<Preview>(uid, 'preview', { revision }));
        setRows(p.rows);
        setToken(p.token);
        inspect(null);
        setNotice('Preview refreshed. Review all affected packages below.');
        return;
      }
      if (mode === 'cancel' && !workspace.hasDraft) {
        await reload();
        setNotice('Local changes discarded.');
        return;
      }
      await post(uid, mode, {
        revision: mode === 'retry' ? workspace.activeVersion : revision,
        ...(mode === 'publish' ? { token } : mode === 'rollback' ? { version: restore } : {}),
      });
      await reload();
      inspect(null);
      setNotice(
        mode === 'rollback'
          ? 'Previous rules loaded into a draft. Preview them against current supplier costs.'
          : mode === 'publish'
            ? 'Rules published. Catalogue repricing queued.'
            : mode === 'retry'
              ? 'Repricing queued.'
              : 'Draft discarded.',
      );
    });
  }
  if (!workspace || !config)
    return (
      <section>
        <h2>Pricing Management</h2>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="button" onClick={() => void run(reload)}>
              Retry loading pricing
            </button>
          </>
        ) : (
          <p role="status">Loading catalogue pricing…</p>
        )}
      </section>
    );
  const margins = rows.flatMap((r) => (r.available && r.margin !== null ? [r.margin] : []));
  const metrics = [
    [
      'Countries with active rules',
      Object.values(workspace.config.countries).filter((r) => r.active).length,
    ],
    ['Regional rules', Object.values(workspace.config.regions).filter((r) => r.active).length],
    ['Package overrides', Object.values(workspace.config.packages).filter((r) => r.active).length],
    [
      'Average contribution margin',
      margins.length ? pct(margins.reduce((s, n) => s + n, 0) / margins.length) : '—',
    ],
    ['Below minimum', rows.filter((r) => !r.safe).length],
    [
      'Above competitor target',
      rows.filter((r) => r.competitorTarget !== null && r.proposed > r.competitorTarget).length,
    ],
    ['Supplier cost increases flagged', rows.filter((r) => r.increased).length],
  ];
  return (
    <div className="price-management operations-transactions">
      <h2>Pricing Management</h2>
      <nav className="price-nav" aria-label="Pricing management sections">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={t === tab}
            onClick={() => {
              choose(t);
              inspect(null);
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      {error && (
        <p className="error-message" role="alert">
          {error}{' '}
          <button type="button" className="text-link" onClick={() => void run(reload)}>
            Reload saved pricing
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <form ref={form} onSubmit={(e) => e.preventDefault()}>
        <fieldset className="price-workspace" disabled={busy}>
          {workspace.job !== 'complete' && (
            <div className="surface">
              <p>Catalogue repricing · {workspace.job}</p>
              <button className="button" type="button" onClick={() => void run(reload)}>
                Refresh status
              </button>{' '}
              <button className="button" type="button" onClick={() => void action('retry')}>
                Retry repricing
              </button>
            </div>
          )}
          {tab === 'Overview' && (
            <>
              <h3>{workspace.hasDraft ? 'Saved draft overview' : 'Published pricing overview'}</h3>
              <div className="operations-metrics">
                {metrics.map(([label, value]) => (
                  <article className="surface" key={label}>
                    <h2>{label}</h2>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
              <Profiles config={config} change={edit} />
              <details className="surface">
                <summary>Recent selling price changes</summary>
                {workspace.recent.map((r) => (
                  <p key={r.id}>
                    {r.name} · {usd(r.before)} → {usd(r.after)} · {r.date.slice(0, 10)}
                  </p>
                ))}
                {!workspace.recent.length && (
                  <p>No selling price changes in the latest 50 catalogue decisions.</p>
                )}
              </details>
            </>
          )}
          {(tab === 'Country Pricing' || tab === 'Regional Pricing') && (
            <ScopeEditor
              key={tab}
              regional={tab === 'Regional Pricing'}
              rows={rows}
              config={config}
              change={edit}
              inspect={inspect}
            />
          )}
          {(tab === 'Package Overrides' || tab === 'Competitor Benchmarks') && (
            <PackageEditor
              key={tab}
              benchmark={tab === 'Competitor Benchmarks'}
              rows={rows}
              config={config}
              change={edit}
            />
          )}
          {tab === 'Pricing History' && (
            <section className="surface">
              <label>
                Restore pricing configuration
                <select value={restore} onChange={(e) => setRestore(e.target.value)}>
                  <option value="global">Original global defaults</option>
                  {workspace.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.date} · {v.actor}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button"
                disabled={dirty || restore === workspace.activeVersion}
                onClick={() => void action('rollback')}
              >
                Load as rollback draft
              </button>
            </section>
          )}
          <section className="surface">
            <p>
              {dirty
                ? 'Unsaved edits'
                : workspace.hasDraft
                  ? 'Saved draft'
                  : 'Published configuration'}
              {busy ? ' · Working…' : ''}
            </p>
            {token && rows.some((r) => r.affected && !r.eligible) && (
              <p role="alert">
                A package is below its required minimum. Review the status in the preview, then
                adjust the price or explicitly approve an eligible fixed-price exception.
              </p>
            )}
            <div className="price-nav">
              <button
                className="button"
                type="button"
                disabled={!dirty}
                onClick={() => void action('draft')}
              >
                Save as draft
              </button>
              <button className="button" type="button" onClick={() => void action('preview')}>
                Preview changes
              </button>
              <button
                className="button primary"
                type="button"
                disabled={
                  dirty ||
                  !workspace.hasDraft ||
                  !token ||
                  rows.some((r) => r.affected && !r.eligible)
                }
                onClick={() => void action('publish')}
              >
                Publish changes
              </button>
              <button
                className="button"
                type="button"
                disabled={!dirty && !workspace.hasDraft}
                onClick={() => void action('cancel')}
              >
                Cancel changes
              </button>
            </div>
          </section>
        </fieldset>
      </form>
      {tab === 'Pricing History' && (
        <>
          <label>
            Filter history by published configuration
            <select value={historyVersion} onChange={(e) => setHistoryVersion(e.target.value)}>
              <option value="">All configurations</option>
              {workspace.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.date} · {v.actor}
                </option>
              ))}
            </select>
          </label>
          <PricingHistory
            key={historyVersion}
            version={historyVersion || undefined}
            at={workspace.versions.find((v) => v.id === historyVersion)?.date}
            uid={uid}
          />
        </>
      )}
      {(tab !== 'Pricing History' || token) && (
        <Simulator
          profiles={config.profiles}
          rows={rows}
          ids={ids}
          clear={() => inspect(null)}
          preview={Boolean(token)}
        />
      )}
    </div>
  );
}
