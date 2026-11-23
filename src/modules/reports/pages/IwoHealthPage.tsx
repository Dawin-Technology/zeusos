/* eslint-disable design-system/no-inline-style-literals -- soft-skin re-skin PR 3 keeps many inline CSS vars while the shell primitives are still growing; full migration lands with the U.4 sweep. */
/**
 * IwoHealthPage — `/reports` (parent-org).
 *
 * The cross-brand counterpart to `/delivery/burn` (which is scoped to
 * the user's home subsidiary). This page lists every active IWO across
 * all sibling brands, groups by brand, and within each brand sorts
 * overheating first. Parent-org AM uses it to spot portfolio-wide
 * risk before any one brand head escalates.
 *
 * Data flow:
 *   • Subscribes to `subscribeActiveIwos()` from
 *     `src/modules/traffic/services/traffic.service.ts` — same query
 *     the Traffic "Active IWOs" tab already uses. Reads pass through
 *     `firestore.rules` parent-org check on `internal_work_orders`.
 *   • Each IWO carries `cumulativeCostMinor` + `budgetMinor`; burn
 *     comes from `computeBurnMeter` (Phase 3.E delivery service).
 *
 * Layout:
 *   1. Portfolio summary tiles — total active, overheating count,
 *      average burn % — same `.zeus-tile` grid as BurnAndSla so the
 *      two surfaces read as siblings.
 *   2. Filter chips (All / Overheating / On-track) — `.zui-chip`
 *      pattern shared with BurnAndSla.
 *   3. One `.zeus-panel` per brand with a header carrying counts +
 *      brand label, then `.zeus-row` list rows sorted BLOCKED →
 *      WARN → OK then by burn % desc. Empty brands collapse under
 *      non-"all" filters.
 *
 * Out of scope for v1 (separate report tabs in future):
 *   • Routing override frequency (RoutingBrandProposed event log)
 *   • Conflict exclusivity risks (already on `/conflict-firewall/
 *     breach-risks` for parent-org)
 *   • IWO velocity / cycle time (needs `acceptedAt` → `closedAt`
 *     timestamps on IWO doc, currently inconsistent)
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { InternalWorkOrder } from '@/modules/assignment/types/iwo.types';
import type { SubsidiaryId } from '@/core/settings/types';
import { ALL_DELIVERY_SUBSIDIARIES } from '@/core/settings/brand-capabilities';
import { subscribeActiveIwos } from '@/modules/traffic/services/traffic.service';
import { computeBurnMeter, type BurnMeter } from '@/modules/delivery/services/burnMeter';
import { BurnMeterBar } from '@/modules/delivery/components/BurnMeterBar';
import { PageHero } from '@/shared/components/refresh';

type Filter = 'all' | 'overheating' | 'on-track';

interface IwoRow {
  iwo: InternalWorkOrder;
  meter: BurnMeter;
}

interface BrandGroup {
  brandId: SubsidiaryId;
  label: string;
  rows: IwoRow[];
  total: number;
  overheating: number;
  avgBurnPct: number;
}

const STATUS_RANK: Record<BurnMeter['status'], number> = {
  BLOCKED: 0,
  WARN: 1,
  OK: 2,
};

const BRAND_LABELS: Record<string, string> = {
  'zeus-the-agency': 'Zeus The Agency',
  'zeus-digital': 'Zeus Digital',
  'labyrinth': 'Labyrinth',
  'odd-gorilla': 'Odd Gorilla',
  'house-of-zeus': 'House of Zeus',
};

function buildRow(iwo: InternalWorkOrder): IwoRow {
  return {
    iwo,
    meter: computeBurnMeter({
      cumulativeMinor: iwo.cumulativeCostMinor ?? 0,
      budgetMinor: iwo.budgetMinor ?? 0,
    }),
  };
}

function sortRows(a: IwoRow, b: IwoRow): number {
  const rank = STATUS_RANK[a.meter.status] - STATUS_RANK[b.meter.status];
  if (rank !== 0) return rank;
  return b.meter.percentage - a.meter.percentage;
}

function applyFilter(rows: IwoRow[], filter: Filter): IwoRow[] {
  if (filter === 'all') return rows;
  if (filter === 'overheating') return rows.filter(r => r.meter.status !== 'OK');
  return rows.filter(r => r.meter.status === 'OK');
}

function buildBrandGroups(iwos: InternalWorkOrder[]): BrandGroup[] {
  const byBrand = new Map<SubsidiaryId, IwoRow[]>();
  for (const b of ALL_DELIVERY_SUBSIDIARIES) {
    byBrand.set(b as SubsidiaryId, []);
  }
  for (const i of iwos) {
    const list = byBrand.get(i.subsidiaryOrgId as SubsidiaryId);
    if (list) list.push(buildRow(i));
  }
  const groups: BrandGroup[] = [];
  for (const [brandId, rows] of byBrand.entries()) {
    rows.sort(sortRows);
    const overheating = rows.filter(r => r.meter.status !== 'OK').length;
    const sumBurn = rows.reduce((s, r) => s + r.meter.percentage, 0);
    groups.push({
      brandId,
      label: BRAND_LABELS[brandId] ?? brandId,
      rows,
      total: rows.length,
      overheating,
      avgBurnPct: rows.length > 0 ? Math.round(sumBurn / rows.length) : 0,
    });
  }
  // Sort brand groups by overheating count desc, then by total desc.
  groups.sort((a, b) => {
    if (a.overheating !== b.overheating) return b.overheating - a.overheating;
    return b.total - a.total;
  });
  return groups;
}

export default function IwoHealthPage() {
  const [iwos, setIwos] = useState<InternalWorkOrder[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const u = subscribeActiveIwos(setIwos, (e) =>
      setErr(`IWO health roll-up load failed: ${e.message}`),
    );
    return () => u();
  }, []);

  const groups = useMemo(() => buildBrandGroups(iwos), [iwos]);

  const portfolio = useMemo(() => {
    const total = iwos.length;
    if (total === 0) {
      return { total: 0, overheating: 0, avgBurnPct: 0 };
    }
    let overheating = 0;
    let sumBurn = 0;
    for (const row of iwos.map(buildRow)) {
      if (row.meter.status !== 'OK') overheating++;
      sumBurn += row.meter.percentage;
    }
    return {
      total,
      overheating,
      avgBurnPct: Math.round(sumBurn / total),
    };
  }, [iwos]);

  return (
    <div style={{ padding: 'var(--pad-page)' }} data-testid="reports-iwo-health-page">
      <PageHero
        eyebrow="Reports"
        title="IWO Health"
        body="Active work orders across every sibling brand. Sorted with the most overheating brand first; within each brand, BLOCKED → WARN → OK."
      />

      {err && (
        <div
          role="alert"
          data-testid="reports-error"
          className="zeus-panel"
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderColor: 'color-mix(in oklab, var(--rag-red) 30%, transparent)',
            background: 'var(--rag-red-soft)',
            color: 'var(--rag-red-deep, var(--rag-red))',
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}

      {/* Portfolio summary tiles */}
      <section
        data-testid="reports-portfolio-summary"
        style={{ marginBottom: 16 }}
      >
        <ul
          className="zeus-tile-grid"
          style={{ listStyle: 'none', padding: 0, margin: 0 }}
        >
          <li className="zeus-tile">
            <span className="zeus-tile-label">Active IWOs</span>
            <span
              className="zeus-tile-value"
              data-testid="reports-portfolio-total"
            >
              {portfolio.total}
            </span>
          </li>
          <li className={`zeus-tile${portfolio.overheating > 0 ? ' warn' : ''}`}>
            <span className="zeus-tile-label">Overheating</span>
            <span
              className="zeus-tile-value"
              data-testid="reports-portfolio-overheating"
            >
              {portfolio.overheating}
            </span>
          </li>
          <li className="zeus-tile">
            <span className="zeus-tile-label">Avg burn</span>
            <span
              className="zeus-tile-value"
              data-testid="reports-portfolio-avg-burn"
            >
              {portfolio.avgBurnPct}
              <span className="zeus-tile-unit">%</span>
            </span>
          </li>
        </ul>
      </section>

      <div
        role="tablist"
        aria-label="Filter active IWOs"
        style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}
      >
        {(['all', 'overheating', 'on-track'] as Filter[]).map(key => {
          const active = filter === key;
          const label = key === 'on-track' ? 'On-track' : key.charAt(0).toUpperCase() + key.slice(1);
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              type="button"
              data-testid={`reports-filter-${key}`}
              onClick={() => setFilter(key)}
              className={`zui-chip${active ? ' active' : ''}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {portfolio.total === 0 ? (
        <div
          data-testid="reports-empty"
          className="zeus-panel"
          style={{
            padding: '24px 20px',
            textAlign: 'center',
            color: 'var(--fg-tertiary)',
            fontSize: 13,
            borderStyle: 'dashed',
          }}
        >
          No active work orders across any brand.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groups.map((g) => {
            const visible = applyFilter(g.rows, filter);
            // Hide empty brand sections under non-"all" filters to keep the page scannable.
            if (visible.length === 0 && filter !== 'all') return null;
            return (
              <section
                key={g.brandId}
                data-testid={`reports-brand-${g.brandId}`}
                className="zeus-panel"
              >
                <header className="zeus-panel-head">
                  <div>
                    <h2>{g.label}</h2>
                    <div
                      className="zeus-row-sub"
                      style={{ marginTop: 3 }}
                      data-testid={`reports-brand-${g.brandId}-stats`}
                    >
                      {g.total} active · {g.overheating} overheating · {g.avgBurnPct}% avg burn
                    </div>
                  </div>
                </header>
                {visible.length === 0 ? (
                  <p
                    className="zeus-panel-empty"
                    data-testid={`reports-brand-${g.brandId}-empty`}
                  >
                    {g.total === 0
                      ? 'No active work orders.'
                      : 'No work orders match this filter.'}
                  </p>
                ) : (
                  <ul className="zeus-row-list">
                    {visible.map(({ iwo, meter }) => (
                      <li
                        key={iwo.id}
                        data-testid={`reports-row-${iwo.id}`}
                        className="zeus-row"
                        style={{ gridTemplateColumns: 'minmax(180px, 220px) 3fr' }}
                      >
                        <div>
                          <Link
                            to={`/delivery/iwo/${iwo.id}`}
                            className="zeus-row-link"
                            data-testid={`reports-row-${iwo.id}-link`}
                          >
                            {iwo.code}
                          </Link>
                          <div className="zeus-row-sub">
                            {iwo.state}
                            {iwo.tier ? ` · ${iwo.tier}` : ''}
                          </div>
                        </div>
                        <BurnMeterBar meter={meter} currency={iwo.currency} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Exported for unit testing.
export const __testing = {
  buildRow,
  sortRows,
  applyFilter,
  buildBrandGroups,
};
