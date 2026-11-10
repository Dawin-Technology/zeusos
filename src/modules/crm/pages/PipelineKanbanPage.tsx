/**
 * /crm/pipeline — column-per-stage view of open leads with a soft-skin
 * Kanban board.
 *
 * Shell re-skin PR 2: the stages live on the shared `KanbanLayout`
 * primitive (`src/shared/components/zeus-ui/kanban`) so the card/column
 * chrome matches the DawinOS soft handoff. Data flow is unchanged —
 * drag/drop is wired through the primitive's `onItemMove` hook but no
 * stage write is persisted yet (Phase 5 still). Existing test ids
 * (`kanban-board`, `kpi-*`, `funnel-kpis`, `data-stage`) are preserved.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import { listLeads } from '../services/lead.service';
import type { Lead, LeadStage } from '../types/lead.types';
import { STAGE_LABEL } from '../components/LeadStageBadge';
import { PageHero } from '@/shared/components/refresh';
import {
  KanbanLayout,
  type KanbanColumn,
  type KanbanItem,
} from '@/shared/components/zeus-ui';

const DEFAULT_ORG_ID = 'default';

const PIPELINE_STAGES: LeadStage[] = ['PROSPECT', 'QUALIFIED', 'PITCH', 'WON'];

const STAGE_TONE: Record<LeadStage, string> = {
  PROSPECT:  'var(--border-strong)',
  QUALIFIED: 'var(--rag-amber)',
  PITCH:     'var(--rag-blue)',
  WON:       'var(--rag-green)',
  LOST:      'var(--rag-red)',
};

function formatMoney(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function formatDate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value.slice(0, 10);
  const ts = value as { seconds?: number; toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 10);
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
  return undefined;
}

export default function PipelineKanbanPage() {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    listLeads({ orgId })
      .then(setRows)
      .catch((err) => setError(String((err as Error).message)))
      .finally(() => setLoading(false));
  }, [user, orgId]);

  // ── Funnel KPIs ────────────────────────────────────────────────────
  // Same inputs as the pre-soft version: weighted pipeline value of
  // OPEN leads, 90-day win rate, 90-day closed sample size.
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

    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const closedRecently = rows.filter((l) => {
      if (l.stage !== 'WON' && l.stage !== 'LOST') return false;
      const c = l.closedAt as unknown;
      if (!c) return false;
      const ts = c as { seconds?: number; toDate?: () => Date };
      let ms: number | undefined;
      if (typeof c === 'string') ms = Date.parse(c);
      else if (typeof ts.toDate === 'function') ms = ts.toDate().getTime();
      else if (typeof ts.seconds === 'number') ms = ts.seconds * 1000;
      return typeof ms === 'number' && ms >= ninetyDaysAgo;
    });
    const wonRecently = closedRecently.filter((l) => l.stage === 'WON').length;
    const lostRecently = closedRecently.filter((l) => l.stage === 'LOST').length;
    const winRate = closedRecently.length
      ? wonRecently / closedRecently.length
      : null;

    return {
      openCount: open.length,
      weightedByCurrency,
      wonRecently,
      lostRecently,
      winRate,
      closedSampleSize: closedRecently.length,
    };
  }, [rows]);

  // Currency assumption: the Kanban shows totals only when all leads in
  // a column share the same currency. Otherwise we show "mixed" + count.
  function columnTotal(leads: Lead[]): { label: string; subtitle: string } {
    if (leads.length === 0) return { label: '—', subtitle: 'no leads' };
    const currencies = new Set(leads.map((l) => l.currency));
    if (currencies.size > 1) {
      return { label: 'mixed', subtitle: `${leads.length} leads, multiple currencies` };
    }
    const currency = leads[0].currency;
    const total = leads.reduce((sum, l) => sum + (l.estimatedValueMinor ?? 0), 0);
    const weighted = leads.reduce(
      (sum, l) => sum + ((l.estimatedValueMinor ?? 0) * (l.probability ?? 0)),
      0,
    );
    return {
      label: formatMoney(total, currency),
      subtitle: `weighted ${formatMoney(weighted, currency)} · ${leads.length} leads`,
    };
  }

  // Shape columns + cards once from the current `rows` snapshot.
  const columns: KanbanColumn[] = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => {
      const leads = rows.filter((l) => l.stage === stage);
      const totals = columnTotal(leads);
      return {
        id: stage,
        title: STAGE_LABEL[stage],
        count: leads.length,
        tone: STAGE_TONE[stage],
        summary: (
          <>
            <span className="zui-kanban-col-summary-value">{totals.label}</span>
            <span>{totals.subtitle}</span>
          </>
        ),
      };
    });
  }, [rows]);

  const items: KanbanItem[] = useMemo(
    () =>
      rows
        .filter((l) => l.stage !== 'LOST')
        .map((lead) => {
          const nextDate = formatDate(lead.nextActionDate);
          return {
            id: lead.id,
            columnId: lead.stage,
            title: lead.name,
            subtitle: lead.contactName,
            value:
              typeof lead.estimatedValueMinor === 'number'
                ? formatMoney(lead.estimatedValueMinor, lead.currency)
                : undefined,
            meta: lead.nextActionLabel
              ? `${lead.nextActionLabel}${nextDate ? ` · ${nextDate}` : ''}`
              : lead.source,
            href: `/crm/${lead.id}`,
          } satisfies KanbanItem;
        }),
    [rows],
  );

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-6">
      <PageHero
        eyebrow="Operations · CRM"
        title="Pipeline"
        body="Open leads grouped by funnel stage. Move leads between stages from the detail page."
        actions={
          <Link to="/crm" className="btn btn-secondary" data-testid="crm-list-link">
            List view
          </Link>
        }
      />

      {loading && <p className="text-sm text-muted-foreground">Loading pipeline…</p>}
      {error && <p className="text-sm text-destructive">Error: {error}</p>}

      {!loading && !error && (
        <div className="zui-kpi-row" data-testid="funnel-kpis">
          <div className="zui-kpi">
            <span className="zui-kpi-label">Open leads</span>
            <span className="zui-kpi-value" data-testid="kpi-open-count">
              {kpis.openCount}
            </span>
            <span className="zui-kpi-delta">across {PIPELINE_STAGES.length - 1} open stages</span>
          </div>

          <div className="zui-kpi">
            <span className="zui-kpi-label">Weighted pipeline</span>
            {kpis.weightedByCurrency.size === 0 ? (
              <span className="zui-kpi-value">—</span>
            ) : (
              <ul
                className="zui-kpi-value"
                style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 20, lineHeight: 1.2 }}
                data-testid="kpi-weighted"
              >
                {Array.from(kpis.weightedByCurrency.entries()).map(([ccy, total]) => (
                  <li key={ccy}>{formatMoney(total, ccy)}</li>
                ))}
              </ul>
            )}
            <span className="zui-kpi-delta">value × probability, by currency</span>
          </div>

          <div className="zui-kpi">
            <span className="zui-kpi-label">Win rate · 90d</span>
            <span className="zui-kpi-value" data-testid="kpi-win-rate">
              {kpis.winRate === null ? '—' : `${Math.round(kpis.winRate * 100)}%`}
            </span>
            <span className="zui-kpi-delta">
              {kpis.closedSampleSize === 0
                ? 'no leads closed yet'
                : `${kpis.wonRecently} won / ${kpis.lostRecently} lost`}
            </span>
          </div>

          <div className="zui-kpi">
            <span className="zui-kpi-label">Closed · 90d</span>
            <span className="zui-kpi-value">{kpis.closedSampleSize}</span>
            <span className="zui-kpi-delta">leads moved to WON or LOST</span>
          </div>
        </div>
      )}

      {!loading && !error && (
        <KanbanLayout columns={columns} items={items} testId="kanban-board" />
      )}
    </div>
  );
}
