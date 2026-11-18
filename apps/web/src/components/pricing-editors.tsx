import { useState } from 'react';
import { CONTINENTS, continentOf } from '@alozuri/shared/geography';
import { countryName } from '@alozuri/shared';
import type {
  Assignment,
  Benchmark,
  PackageRule,
  Parameters,
  PricingConfig,
  PricingRow,
} from '@alozuri/shared/pricing-management';
export const usd = (c: number | null) =>
  c === null
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100);
export const pct = (bps: number | null) => (bps === null ? '—' : (bps / 100).toFixed(2) + '%');
type Edit = { config: PricingConfig; change: (next: PricingConfig) => void };
const without = <T,>(map: Record<string, T>, key: string) =>
  Object.fromEntries(Object.entries(map).filter(([k]) => k !== key));
function NumberField({
  label,
  value,
  onChange,
  max = 999999.99,
  min = 0,
  placeholder,
}: {
  label: string;
  value?: number | null;
  onChange: (v: number | null) => void;
  max?: number;
  min?: number;
  placeholder?: string;
}) {
  // Keep the decimal text editable while typing. The enclosing form checks validity on save.
  return (
    <label>
      {label}
      <input
        type="number"
        step="0.01"
        min={min}
        max={max}
        placeholder={placeholder}
        value={value == null ? '' : value / 100}
        onChange={(e) => {
          const n = e.currentTarget.valueAsNumber;
          onChange(Number.isFinite(n) ? Math.round(n * 100) : null);
        }}
      />
    </label>
  );
}
function Settings({
  value,
  set,
  inherited,
}: {
  value: Partial<Parameters>;
  set: (v: Partial<Parameters>) => void;
  inherited?: Parameters;
}) {
  const update = (key: keyof Parameters, n: number | null) => {
    const next = { ...value };
    if (inherited && n === null) delete next[key];
    else Object.assign(next, { [key]: n });
    set(next);
  };
  const targetMode =
    value.targetCents === undefined
      ? 'inherit'
      : value.targetCents === null
        ? 'progressive'
        : 'fixed';
  return (
    <div className="price-fields">
      <label>
        Target contribution
        <select
          value={targetMode}
          onChange={(e) => {
            if (e.target.value === 'inherit') {
              const next = { ...value };
              delete next.targetCents;
              set(next);
            } else set({ ...value, targetCents: e.target.value === 'fixed' ? 75 : null });
          }}
        >
          {inherited && <option value="inherit">Use profile target</option>}
          <option value="progressive">Progressive bands</option>
          <option value="fixed">Fixed USD amount</option>
        </select>
      </label>
      {targetMode === 'fixed' && (
        <NumberField
          label="Target (USD)"
          value={value.targetCents}
          onChange={(v) => set({ ...value, targetCents: v ?? 0 })}
        />
      )}
      <NumberField
        label="Minimum contribution (USD)"
        value={value.minimumContributionCents}
        placeholder={inherited ? usd(inherited.minimumContributionCents) : undefined}
        onChange={(v) => update('minimumContributionCents', v ?? (inherited ? null : 0))}
      />
      <NumberField
        label="Minimum margin (%)"
        max={50}
        value={value.minimumContributionBps}
        placeholder={inherited ? pct(inherited.minimumContributionBps) : undefined}
        onChange={(v) => update('minimumContributionBps', v ?? (inherited ? null : 0))}
      />
      <NumberField
        label="Competitor undercut (%)"
        max={99.99}
        value={value.undercutBps}
        placeholder={inherited ? pct(inherited.undercutBps ?? 0) : 'Optional'}
        onChange={(v) => update('undercutBps', v)}
      />
    </div>
  );
}
export function Profiles({ config, change }: Edit) {
  const [selected, select] = useState(Object.keys(config.profiles)[0]);
  const p = config.profiles[selected] ?? Object.values(config.profiles)[0];
  if (!p) return null;
  function create(duplicate: boolean) {
    const key = crypto.randomUUID();
    change({
      ...config,
      profiles: {
        ...config.profiles,
        [key]: duplicate
          ? { ...p, name: p.name + ' copy' }
          : { name: 'New profile', settings: { ...config.profiles.custom.settings } },
      },
    });
    select(key);
  }
  return (
    <section className="surface">
      <h3>Pricing profiles</h3>
      <div className="price-fields">
        <label>
          Profile
          <select value={selected} onChange={(e) => select(e.target.value)}>
            {Object.entries(config.profiles).map(([k, v]) => (
              <option key={k} value={k}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="button" onClick={() => create(false)}>
          Create profile
        </button>
        <button type="button" className="button" onClick={() => create(true)}>
          Duplicate profile
        </button>
      </div>
      <div key={selected}>
        <label>
          Profile name
          <input
            value={p.name}
            maxLength={200}
            onChange={(e) =>
              change({
                ...config,
                profiles: { ...config.profiles, [selected]: { ...p, name: e.target.value } },
              })
            }
          />
        </label>
        <Settings
          value={p.settings}
          set={(s) =>
            change({
              ...config,
              profiles: {
                ...config.profiles,
                [selected]: { ...p, settings: { ...p.settings, ...s } },
              },
            })
          }
        />
      </div>
    </section>
  );
}
export function ScopeEditor({
  config,
  change,
  rows,
  regional,
  inspect,
}: Edit & { rows: PricingRow[]; regional: boolean; inspect: (ids: string[]) => void }) {
  const [q, search] = useState(''),
    [region, filterRegion] = useState(''),
    [profile, filterProfile] = useState(''),
    [status, filterStatus] = useState(''),
    [sort, setSort] = useState('name');
  const [selected, select] = useState<string[]>([]),
    [editing, edit] = useState(''),
    [assign, setAssign] = useState('standard'),
    [copy, setCopy] = useState('');
  const group = regional ? 'regions' : 'countries',
    rules = config[group];
  const buckets = new Map<string, PricingRow[]>();
  for (const r of rows)
    for (const k of regional ? [r.region, r.bundle] : [r.country])
      if (k) {
        const items = buckets.get(k) ?? [];
        items.push(r);
        buckets.set(k, items);
      }
  if (!regional)
    for (const key of Object.values(CONTINENTS).flat()) if (!buckets.has(key)) buckets.set(key, []);
  for (const key of Object.keys(rules)) if (!buckets.has(key)) buckets.set(key, []);
  const name = (k: string) => {
    if (!regional) return countryName(k);
    const r = buckets.get(k)?.[0];
    return r?.bundle === k ? `${r.region} · ${r.coverageCount} destinations (${k.slice(-6)})` : k;
  };
  const margin = (k: string) => {
    const margins = (buckets.get(k) ?? []).flatMap((r) => (r.margin === null ? [] : [r.margin]));
    return margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
  };
  const normalize = (text: string) =>
    text.normalize('NFKD').replace(/\p{M}/gu, '').replace(/['’]/g, '').toLowerCase();
  const keys = [...buckets.keys()]
    .filter(
      (k) =>
        normalize(name(k) + ' ' + k).includes(normalize(q)) &&
        (!region || continentOf(k) === region) &&
        (!profile || rules[k]?.profile === profile) &&
        (!status || Boolean(rules[k]?.active) === (status === 'active')),
    )
    .sort((a, b) =>
      sort === 'margin'
        ? margin(b) - margin(a) || name(a).localeCompare(name(b))
        : name(a).localeCompare(name(b)),
    );
  const update = (ids: string[], rule: Assignment | null) => {
    let next = { ...rules };
    for (const key of ids) {
      if (rule) next[key] = { ...rule };
      else next = without(next, key);
    }
    change({ ...config, [group]: next });
  };
  const options = Object.entries(config.profiles).map(([id, p]) => (
    <option key={id} value={id}>
      {p.name}
    </option>
  ));
  const rule = rules[editing];
  const focus = (keys: string[]) =>
    inspect([...new Set(keys.flatMap((k) => (buckets.get(k) ?? []).map((p) => p.id)))]);
  return (
    <section className="surface">
      <div className="price-fields">
        <label>
          Search {regional ? 'regions' : 'countries'}
          <input type="search" value={q} onChange={(e) => search(e.target.value)} />
        </label>
        {!regional && (
          <label>
            Region
            <select value={region} onChange={(e) => filterRegion(e.target.value)}>
              <option value="">All regions</option>
              {[...new Set(rows.flatMap((r) => (r.continent ? [r.continent] : [])))]
                .sort()
                .map((n) => (
                  <option key={n}>{n}</option>
                ))}
            </select>
          </label>
        )}
        <label>
          Profile filter
          <select value={profile} onChange={(e) => filterProfile(e.target.value)}>
            <option value="">All profiles</option>
            {options}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => filterStatus(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive or global</option>
          </select>
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Name</option>
            <option value="margin">Highest average margin</option>
          </select>
        </label>
      </div>
      <div
        className="operations-table-scroll scope-table"
        tabIndex={0}
        aria-label="Pricing assignments"
      >
        <table>
          <thead>
            <tr>
              {[
                'Select',
                regional ? 'Region or bundle' : 'Country',
                'Profile',
                'Packages',
                'Minimum margin',
                'Status',
              ].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={'Select ' + name(k)}
                    checked={selected.includes(k)}
                    onChange={(e) =>
                      select(e.target.checked ? [...selected, k] : selected.filter((s) => s !== k))
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      edit(k);
                      focus([k]);
                    }}
                  >
                    {name(k)}
                  </button>
                </td>
                <td>{config.profiles[rules[k]?.profile]?.name ?? 'Global'}</td>
                <td>{buckets.get(k)?.length}</td>
                <td>
                  {rules[k]?.active
                    ? pct(
                        rules[k].settings.minimumContributionBps ??
                          config.profiles[rules[k].profile].settings.minimumContributionBps,
                      )
                    : 'Inherited'}
                </td>
                <td>{rules[k]?.active ? 'Active' : rules[k] ? 'Disabled' : 'Inherited'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!keys.length && <p>No matching destinations.</p>}
      </div>
      <div className="price-fields">
        <label>
          Assign profile
          <select value={assign} onChange={(e) => setAssign(e.target.value)}>
            {options}
          </select>
        </label>
        <button
          className="button"
          type="button"
          disabled={!selected.length}
          onClick={() => {
            update(selected, { profile: assign, active: true, settings: {} });
            focus(selected);
          }}
        >
          Assign to selected ({selected.length})
        </button>
        <button
          className="button"
          type="button"
          disabled={!selected.length}
          onClick={() => focus(selected)}
        >
          View selected packages
        </button>
      </div>
      {editing && (
        <fieldset key={editing}>
          <legend>{name(editing)}</legend>
          <div className="price-fields">
            <label>
              Assigned profile
              <select
                value={rule?.profile ?? ''}
                onChange={(e) =>
                  update(
                    [editing],
                    e.target.value ? { profile: e.target.value, active: true, settings: {} } : null,
                  )
                }
              >
                <option value="">Inherit defaults</option>
                {options}
              </select>
            </label>
            <label>
              Copy settings from
              <select value={copy} onChange={(e) => setCopy(e.target.value)}>
                <option value="">Choose source</option>
                {Object.keys(rules)
                  .filter((k) => k !== editing)
                  .map((k) => (
                    <option key={k} value={k}>
                      {name(k)}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="button"
              type="button"
              disabled={!rules[copy]}
              onClick={() => {
                update([editing], rules[copy]);
                setCopy('');
              }}
            >
              Copy settings
            </button>
          </div>
          {rule && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={rule.active}
                  onChange={(e) => update([editing], { ...rule, active: e.target.checked })}
                />{' '}
                Enable rule
              </label>
              <Settings
                key={rule.profile + JSON.stringify(rules[copy] ?? null)}
                inherited={config.profiles[rule.profile].settings}
                value={rule.settings}
                set={(settings) => update([editing], { ...rule, settings })}
              />
            </>
          )}
        </fieldset>
      )}
    </section>
  );
}
export function PackageEditor({
  config,
  change,
  rows,
  benchmark,
}: Edit & { rows: PricingRow[]; benchmark: boolean }) {
  const [q, search] = useState(''),
    [id, choose] = useState('');
  const matches = rows.filter((r) => (r.name + ' ' + r.id).toLowerCase().includes(q.toLowerCase())),
    r = rows.find((p) => p.id === id);
  const rule = config.packages[id],
    b = config.benchmarks[id];
  const put = (v: PackageRule | null) =>
    change({
      ...config,
      packages: v ? { ...config.packages, [id]: v } : without(config.packages, id),
    });
  const bench = (v: Benchmark | null) =>
    change({
      ...config,
      benchmarks: v ? { ...config.benchmarks, [id]: v } : without(config.benchmarks, id),
    });
  return (
    <section className="surface">
      <div className="price-fields">
        <label>
          Find package
          <input type="search" value={q} onChange={(e) => search(e.target.value)} />
        </label>
        <label>
          Package
          <select value={id} onChange={(e) => choose(e.target.value)}>
            <option value="">Choose package ({matches.length})</option>
            {(r && !matches.includes(r) ? [r, ...matches] : matches).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.id}
              </option>
            ))}
          </select>
        </label>
      </div>
      {r && (
        <fieldset key={id}>
          <legend>{r.name}</legend>
          <p>
            Current {usd(r.current)} · Supplier USD {(r.units / 10000).toFixed(4)}
          </p>
          {benchmark ? (
            b ? (
              <>
                <div className="price-fields">
                  {(
                    [
                      'competitor',
                      'packageName',
                      'allowance',
                      'validity',
                      'url',
                      'checked',
                    ] as const
                  ).map((k, i) => (
                    <label key={k}>
                      {
                        [
                          'Competitor',
                          'Competitor package',
                          'Data allowance',
                          'Validity',
                          'Source URL',
                          'Date checked',
                        ][i]
                      }
                      <input
                        required
                        type={k === 'url' ? 'url' : k === 'checked' ? 'date' : 'text'}
                        value={b[k]}
                        onChange={(e) => bench({ ...b, [k]: e.target.value })}
                      />
                    </label>
                  ))}
                  <label>
                    Benchmark currency
                    <select
                      value={b.currency}
                      onChange={(e) =>
                        bench({
                          ...b,
                          currency:
                            e.target.value === 'GBP'
                              ? 'GBP'
                              : e.target.value === 'EUR'
                                ? 'EUR'
                                : 'USD',
                        })
                      }
                    >
                      {['USD', 'GBP', 'EUR'].map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </label>
                  <NumberField
                    label="Competitor price"
                    min={0.01}
                    value={b.amount}
                    onChange={(v) => bench({ ...b, amount: v ?? 0 })}
                  />
                </div>
                <button type="button" className="button" onClick={() => bench(null)}>
                  Remove benchmark
                </button>
              </>
            ) : (
              <button
                type="button"
                className="button"
                onClick={() =>
                  bench({
                    competitor: '',
                    packageName: '',
                    allowance: '',
                    validity: '',
                    amount: 0,
                    currency: 'USD',
                    url: '',
                    checked: new Date().toISOString().slice(0, 10),
                  })
                }
              >
                Add verified benchmark
              </button>
            )
          ) : (
            <>
              <label>
                Pricing mode
                <select
                  value={rule?.mode ?? ''}
                  onChange={(e) => {
                    const mode = e.target.value;
                    if (
                      mode !== 'fixed' &&
                      mode !== 'custom' &&
                      mode !== 'country' &&
                      mode !== 'region'
                    ) {
                      put(null);
                      return;
                    }
                    put({
                      mode,
                      active: true,
                      settings: {},
                      fixedCents: mode === 'fixed' ? r.current : null,
                      approvedCostUnits: null,
                    });
                  }}
                >
                  <option value="">Use applicable defaults</option>
                  {r.country && <option value="country">Inherit country pricing</option>}
                  {r.region && <option value="region">Inherit regional pricing</option>}
                  <option value="custom">Custom parameters</option>
                  <option value="fixed">Fixed selling price</option>
                </select>
              </label>
              {rule && (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={rule.active}
                      onChange={(e) => put({ ...rule, active: e.target.checked })}
                    />{' '}
                    Enable package override
                  </label>
                  {(rule.mode === 'custom' || rule.mode === 'fixed') && (
                    <Settings
                      value={rule.settings}
                      inherited={r.inheritedSettings}
                      set={(settings) => put({ ...rule, settings, approvedCostUnits: null })}
                    />
                  )}
                  {rule.mode === 'fixed' && (
                    <>
                      <NumberField
                        label="Fixed selling price (USD)"
                        min={0.5}
                        value={rule.fixedCents}
                        onChange={(v) => put({ ...rule, fixedCents: v, approvedCostUnits: null })}
                      />
                      <label>
                        <input
                          type="checkbox"
                          checked={rule.approvedCostUnits === r.units}
                          onChange={(e) =>
                            put({ ...rule, approvedCostUnits: e.target.checked ? r.units : null })
                          }
                        />{' '}
                        Approve a fixed price below the configured minimum at this supplier cost.
                        Loss-making prices require a promotion.
                      </label>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </fieldset>
      )}
    </section>
  );
}
