/**
 * /crm — sales pipeline list view. Filter by stage/source/owner, search
 * by lead name. Defaults to the OPEN funnel (everything except WON/LOST).
 *
 * Shell re-skin PR 2: refreshed `PageHero` + `.zui-kpi-row` + stage chip
 * filter track + the `.card .tbl` soft chrome (same pattern as
 * ClientsPage / MasterJobsPage). Parent-org only via Firestore rules;
 * this page assumes the user is a commercial actor.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '@/core/hooks/useAuth';
import { listLeads } from '../services/lead.service';
import type { Lead, LeadStage, LeadSource } from '../types/lead.types';
import { LeadStageBadge, STAGE_LABEL } from '../components/LeadStageBadge';
import { PageHero } from '@/shared/components/refresh';

const DEFAULT_ORG_ID = 'default';

const STAGE_CHIPS: Array<{ key: LeadStage | 'OPEN' | 'ALL'; label: string }> = [
  { key: 'OPEN',      label: 'Open pipeline' },
  { key: 'PROSPECT',  label: STAGE_LABEL.PROSPECT },
  { key: 'QUALIFIED', label: STAGE_LABEL.QUALIFIED },
  { key: 'PITCH',     label: STAGE_LABEL.PITCH },
  { key: 'WON',       label: STAGE_LABEL.WON },
  { key: 'LOST',      label: STAGE_LABEL.LOST },
  { key: 'ALL',       label: 'All stages' },
];

const SOURCE_OPTIONS: Array<LeadSource | 'ALL'> = [
  'ALL', 'REFERRAL', 'INBOUND', 'OUTBOUND', 'EVENT', 'EXISTING_CLIENT', 'OTHER',
];

function formatMoney(minor: number | undefined, currency: string): string {
  if (typeof minor !== 'number') return '—';
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'string') return value.slice(0, 10);
  const ts = value as { seconds?: number; toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 10);
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
  return '—';
}

export default function LeadsListPage() {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [rows, setRows] = useState<Lead[]>([]);
  const [stageFilter, setStageFilter] = useState<LeadStage | 'OPEN' | 'ALL'>('OPEN');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // The "OPEN" pseudo-filter fetches all stages and filters client-side
      // (we don't want to fire two parallel queries for the common case).
      const result = await listLeads({
        orgId,
        stage: stageFilter === 'OPEN' || stageFilter === 'ALL' ? undefined : stageFilter,
        source: sourceFilter === 'ALL' ? undefined : sourceFilter,
      });
      const filtered = stageFilter === 'OPEN'
        ? result.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST')
        : result;
      setRows(filtered);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [user, orgId, stageFilter, sourceFilter]);

  const visible = search.trim()
    ? rows.filter((l) => l.name.toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  const kpis = useMemo(() => {
    const open = rows.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST');
    const weightedByCurrency = new Map<string, number>();
    for (const lead of open) {
      const v = lead.estimatedValueMinor ?? 0;
      const p = lead.probability ?? 0;
      weightedByCurrency.set(
        lead.currency,
        (weightedByCurrency.get(lead.currency) ?? 0) + v * p,
      );
    }
    const totalValueByCurrency = new Map<string, number>();
    for (const lead of open) {
      if (typeof lead.estimatedValueMinor !== 'number') continue;
      totalValueByCurrency.set(
        lead.currency,
        (totalValueByCurrency.get(lead.currency) ?? 0) + lead.estimatedValueMinor,
      );
    }
    return {
      openCount: open.length,
      weightedByCurrency,
      totalValueByCurrency,
    };
  }, [rows]);

  return (
    <div style={{ padding: 'var(--pad-page)' }}>
      <PageHero
        eyebrow="Operations · CRM"
        title="Sales pipeline"
        body="Leads, prospects and live pitches. Convert won deals into Clients in Account Management."
        actions={
          <>
            <Link
              to="/crm/pipeline"
              className="btn btn-secondary"
              data-testid="crm-pipeline-link"
            >
              Pipeline view
            </Link>
            <Link
              to="/crm/new"
              className="btn btn-primary"
              data-testid="lead-new"
            >
              <Plus size={13} /> New lead
            </Link>
          </>
        }
      />

      {!loading && !error && rows.length > 0 && (
        <div className="zui-kpi-row" style={{ marginBottom: 20 }} data-testid="leads-kpis">
          <div className="zui-kpi">
            <span className="zui-kpi-label">Open leads</span>
            <span className="zui-kpi-value">{kpis.openCount}</span>
            <span className="zui-kpi-delta">excludes WON / LOST</span>
          </div>
          <div className="zui-kpi">
            <span className="zui-kpi-label">Open value</span>
            {kpis.totalValueByCurrency.size === 0 ? (
              <span className="zui-kpi-value">—</span>
            ) : (
              <ul
                className="zui-kpi-value"
                style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 20, lineHeight: 1.2 }}
              >
                {Array.from(kpis.totalValueByCurrency.entries()).map(([ccy, total]) => (
                  <li key={ccy}>{formatMoney(total, ccy)}</li>
                ))}
              </ul>
            )}
            <span className="zui-kpi-delta">sum of estimated values</span>
          </div>
          <div className="zui-kpi">
            <span className="zui-kpi-label">Weighted pipeline</span>
            {kpis.weightedByCurrency.size === 0 ? (
              <span className="zui-kpi-value">—</span>
            ) : (
              <ul
                className="zui-kpi-value"
                style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 20, lineHeight: 1.2 }}
              >
                {Array.from(kpis.weightedByCurrency.entries()).map(([ccy, total]) => (
                  <li key={ccy}>{formatMoney(total, ccy)}</li>
                ))}
              </ul>
            )}
            <span className="zui-kpi-delta">value × probability</span>
          </div>
          <div className="zui-kpi">
            <span className="zui-kpi-label">Showing</span>
            <span className="zui-kpi-value">{visible.length}</span>
            <span className="zui-kpi-delta">after current filters</span>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STAGE_CHIPS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`btn ${stageFilter === s.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStageFilter(s.key)}
              data-testid={`lead-stage-chip-${s.key}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              fontSize: 12.5,
              color: 'var(--fg-secondary)',
            }}
          >
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
              data-testid="lead-search"
              style={{
                background: 'transparent',
                border: 0,
                outline: 'none',
                fontSize: 12.5,
                width: 180,
                color: 'inherit',
              }}
            />
          </label>
          {/* Keep the stage dropdown as a hidden accessibility fallback / test anchor */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as LeadStage | 'OPEN' | 'ALL')}
            className="btn btn-secondary"
            data-testid="lead-stage-filter"
            style={{ padding: '4px 8px' }}
          >
            {STAGE_CHIPS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as LeadSource | 'ALL')}
            className="btn btn-secondary"
            data-testid="lead-source-filter"
            style={{ padding: '4px 8px' }}
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All sources' : s}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading leads…</p>}
      {error && <p style={{ fontSize: 13, color: 'var(--rag-red)' }}>Error: {error}</p>}

      {!loading && !error && visible.length === 0 && (
        <div
          className="card card-pad"
          style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 13 }}
        >
          No leads in this view. Click <strong>+ New lead</strong> to add one.
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl" data-testid="lead-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Contact</th>
                <th>Source</th>
                <th>Stage</th>
                <th style={{ textAlign: 'right' }}>Value</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id} data-lead-id={l.id} data-testid="lead-row">
                  <td>
                    <Link to={`/crm/${l.id}`} style={{ fontWeight: 600 }}>
                      {l.name}
                    </Link>
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {l.contactName || (
                      <span style={{ color: 'var(--fg-tertiary)' }}>—</span>
                    )}
                    {l.contactEmail && (
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--fg-tertiary)' }}>
                        {l.contactEmail}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 11.5, color: 'var(--fg-tertiary)' }}>{l.source}</td>
                  <td><LeadStageBadge stage={l.stage} /></td>
                  <td className="tabular" style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatMoney(l.estimatedValueMinor, l.currency)}
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {l.nextActionLabel ? (
                      <>
                        {l.nextActionLabel}
                        {l.nextActionDate && (
                          <span style={{ marginLeft: 6, color: 'var(--fg-tertiary)' }}>
                            · {formatDate(l.nextActionDate)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--fg-tertiary)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
