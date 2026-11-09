/**
 * DashboardPage — the Zeus Group landing surface (route `/`).
 *
 * Replaces the prior `/ → /strategy` redirect (which dropped users onto the
 * DawinOS Executive/OKR layout). Rebuilt on the Zeus-UI (DawinOS "soft skin")
 * primitives from the design handoff — ModuleHeader + KPIRow + SectionCard +
 * DataTable + Hbars + Banner.
 *
 *   • PARENT (zeus-group): group-wide KPI strip + 5-brand portfolio roll-up
 *     + live IWO activity + conflict-firewall watch + weekly-pulse stub.
 *   • SUBSIDIARY: the brand's "today's work" — awaiting-acceptance + in-flight
 *     KPIs + inbox table scoped to the user's home brand.
 *
 * Data: unchanged. Parent still reads the cross-brand active-IWO collection-
 * group via `subscribeActiveIwos` (parent-org-gated) + open master jobs +
 * conflict risks. Subsidiary still reads its own brand via the delivery
 * inbox/active subscriptions (home-brand-scoped, rules-safe). Burn comes from
 * the pure `computeBurnMeter`. The weekly pulse has no aggregator yet and
 * renders a labelled placeholder rather than fabricated numbers.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Inbox, Plus, Shield } from 'lucide-react';
import { useCurrentDawinUser } from '@/core/settings';
import { useResilientSubscription } from '@/shared/hooks/useResilientSubscription';
import { useAuth } from '@/shared/hooks';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import type { SubsidiaryId } from '@/core/settings/types';
import { isConflictIsolated } from '@/core/settings/brand-capabilities';
import { isParentOrgPrincipal } from '@/core/settings/org-kind';
import type { Timestamp } from 'firebase/firestore';
import type { InternalWorkOrder } from '@/modules/assignment/types/iwo.types';
import type { IWOState } from '@/modules/assignment/constants/iwo-states';
import { computeBurnMeter } from '@/modules/delivery/services/burnMeter';
import { subscribeIWOInbox, subscribeIWOActive } from '@/modules/delivery/services/firestore';
import { subscribeActiveIwos, subscribeOpenMasterJobs } from '@/modules/traffic/services/traffic.service';
import {
  subscribeConflictRisks,
  type ConflictExclusivityRiskEvent,
} from '@/modules/conflict-firewall/services/conflict-firewall.service';
import { formatMinor } from '@/modules/account-management/utils/money';
import { Button } from '@/core/components/ui/button';
import {
  Banner,
  DataTable,
  Hbars,
  KPIRow,
  ModuleHeader,
  RagBadge,
  SectionCard,
  type Column,
  type KPI as KpiSpec,
  type RagTone,
  type SubBrandId,
} from '@/shared/components/zeus-ui';
import { MyTasksCard } from '../components/MyTasksCard';

// Brand metadata — mirrors the [data-brand] palette (UI Refresh v3: light
// sub-brand accents + per-brand `ink` for text/icons rendered ON the accent).
const BRAND_META: Record<string, { name: string; short: string; accent: string; ink: string }> = {
  'zeus-group':      { name: 'Zeus Group',      short: 'ZG', accent: '#0a1f4a', ink: '#ffffff' },
  'zeus-the-agency': { name: 'Zeus The Agency', short: 'ZA', accent: '#f5d900', ink: '#0a1f4a' },
  'zeus-digital':    { name: 'Zeus Digital',    short: 'ZD', accent: '#00c5e5', ink: '#0a1f4a' },
  labyrinth:         { name: 'Labyrinth',       short: 'LB', accent: '#c8f0d6', ink: '#0a1f4a' },
  'odd-gorilla':     { name: 'Odd Gorilla',     short: 'OG', accent: '#ffb0b8', ink: '#0a1f4a' },
  'house-of-zeus':   { name: 'House of Zeus',   short: 'HZ', accent: '#c8ff3c', ink: '#0a1f4a' },
};
const DELIVERY_BRANDS: SubBrandId[] = [
  'zeus-the-agency',
  'zeus-digital',
  'labyrinth',
  'odd-gorilla',
  'house-of-zeus',
];

function brandMeta(id: string) {
  return BRAND_META[id] ?? { name: id, short: id.slice(0, 2).toUpperCase(), accent: '#0a1f4a', ink: '#ffffff' };
}

type Sla = 'breach' | 'warn' | 'ok' | 'na';
function toMs(v: Timestamp | string | undefined): number | null {
  if (!v) return null;
  if (typeof v === 'string') {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const maybe = v as unknown as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === 'function') return maybe.toDate().getTime();
  if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  return null;
}
function slaRisk(iwo: InternalWorkOrder, nowMs: number): Sla {
  const due = toMs(iwo.slaDueAt);
  if (due == null) return 'na';
  if (due < nowMs) return 'breach';
  if (due - nowMs < 24 * 60 * 60 * 1000) return 'warn';
  return 'ok';
}
function stateTone(state: IWOState): RagTone {
  if (state === 'DELIVERED' || state === 'ACCEPTED_INTERNALLY' || state === 'CLOSED') return 'green';
  if (state === 'REJECTED' || state === 'CANCELLED') return 'red';
  return 'blue';
}

export default function DashboardPage() {
  const { dawinUser } = useCurrentDawinUser();
  const { user } = useAuth();
  const { currentSubsidiary } = useSubsidiary();

  const brandId = (currentSubsidiary?.id ?? 'zeus-group') as SubsidiaryId;
  // Use the shared resolver (super-user email / homeOrgId / zeus-group
  // access) so the dashboard variant matches the sidebar + route guards.
  const isParent = useMemo(
    () => brandId === 'zeus-group' && isParentOrgPrincipal(user?.email, dawinUser),
    [user?.email, dawinUser, brandId],
  );

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const firstName = user?.displayName?.split(' ')[0] || 'there';

  if (isParent) return <ParentDashboard today={today} firstName={firstName} />;
  return <SubsidiaryDashboard today={today} brandId={brandId} firstName={firstName} />;
}

// ---------------------------------------------------------------------------
// PARENT — Commercial Gravity
// ---------------------------------------------------------------------------

/** Row shape for the parent "Recent IWO activity" DataTable. */
interface IwoActivityRow {
  id: string;
  code: string;
  brand: SubBrandId | string;
  burnPct: number;
  state: IWOState;
}

function ParentDashboard({ today, firstName }: { today: string; firstName: string }) {
  const navigate = useNavigate();
  const [iwos, setIwos] = useState<InternalWorkOrder[]>([]);
  const [openMjCount, setOpenMjCount] = useState<number | null>(null);
  const [risks, setRisks] = useState<ConflictExclusivityRiskEvent[]>([]);
  const nowMs = useMemo(() => Date.now(), [iwos]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    unsubs.push(subscribeActiveIwos(setIwos, () => setIwos([])));
    unsubs.push(subscribeOpenMasterJobs((jobs) => setOpenMjCount(jobs.length), () => setOpenMjCount(null)));
    unsubs.push(subscribeConflictRisks(setRisks, () => setRisks([])));
    return () => unsubs.forEach((u) => u());
  }, []);

  const breaches = iwos.filter((i) => slaRisk(i, nowMs) === 'breach').length;
  const warns = iwos.filter((i) => slaRisk(i, nowMs) === 'warn').length;

  const portfolio = useMemo(
    () =>
      DELIVERY_BRANDS.map((id) => {
        const rows = iwos.filter((r) => r.subsidiaryOrgId === id);
        const budget = rows.reduce((s, r) => s + (r.budgetMinor || 0), 0);
        const cost = rows.reduce((s, r) => s + (r.cumulativeCostMinor || 0), 0);
        const burn = budget > 0 ? cost / budget : 0;
        const sla = rows.filter((r) => {
          const x = slaRisk(r, nowMs);
          return x === 'breach' || x === 'warn';
        }).length;
        const ccy = rows[0]?.currency ?? 'UGX';
        return {
          id,
          activeIWOs: rows.length,
          burnPct: burn * 100,
          billable: budget ? formatMinor(budget, ccy) : '—',
          sla,
        };
      }),
    [iwos, nowMs],
  );

  const brandsEngaged = portfolio.filter((p) => p.activeIWOs > 0).length;

  // 4-up KPI strip. We don't have time-series yet, so sparklines stay off here
  // (the handoff treats them as optional). Trend is derived from the live state:
  // breaches/warns drive "down", everything else "flat".
  const kpis: KpiSpec[] = [
    {
      label: 'Open master jobs',
      value: openMjCount ?? '—',
      delta: openMjCount == null ? 'live…' : `across ${brandsEngaged} brand${brandsEngaged === 1 ? '' : 's'}`,
      trend: 'flat',
    },
    {
      label: 'In-flight IWOs',
      value: iwos.length,
      delta: `${warns} at SLA risk`,
      trend: warns > 0 ? 'down' : 'flat',
    },
    {
      label: 'Brands engaged',
      value: brandsEngaged,
      unit: ' / 5',
      delta: brandsEngaged === 5 ? 'all brands active' : 'portfolio mix',
      trend: 'flat',
    },
    {
      label: 'SLA breaches',
      value: breaches,
      delta: breaches > 0 ? 'needs attention' : 'none today',
      trend: breaches > 0 ? 'down' : 'flat',
    },
  ];

  const activityRows: IwoActivityRow[] = iwos.slice(0, 7).map((i) => {
    const burn = computeBurnMeter({ cumulativeMinor: i.cumulativeCostMinor, budgetMinor: i.budgetMinor });
    return {
      id: i.id,
      code: i.code,
      brand: i.subsidiaryOrgId,
      burnPct: Math.round(burn.percentage),
      state: i.state,
    };
  });

  const activityColumns: Column<IwoActivityRow>[] = [
    { key: 'code',    label: 'Code',  type: 'mono',  width: 160,
      render: (v, r) => <Link to={`/delivery/iwo/${r.id}`} style={{ color: 'var(--fg-primary)' }} className="hover:underline">{String(v)}</Link>,
    },
    { key: 'brand',   label: 'Brand', type: 'brand', width: 140 },
    { key: 'burnPct', label: 'Burn',  width: 90, align: 'right',
      render: (v) => {
        const n = Number(v);
        const color = n >= 100 ? 'var(--rag-red)' : n >= 80 ? 'var(--rag-amber)' : 'var(--fg-primary)';
        return <span style={{ color, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{n}%</span>;
      },
    },
    { key: 'state',   label: 'State', width: 180,
      render: (v) => <RagBadge tone={stateTone(v as IWOState)} label={String(v).replace(/_/g, ' ').toLowerCase()} />,
    },
  ];

  return (
    <>
      <ModuleHeader
        title={
          <>
            Good to see you, {firstName}. <span style={{ color: 'var(--fg-tertiary)', fontWeight: 400 }}>· {today}</span>
          </>
        }
        subtitle={
          <>
            Commercial gravity across the five brands — live from{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>master_jobs</code> +{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>internal_work_orders</code>.
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/reports"><ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Reports</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/traffic"><ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Open Traffic</Link>
            </Button>
          </>
        }
      />

      <div className="zui-page zui-stack">
        {/* 1. KPIs */}
        <KPIRow kpis={kpis} />

        {/* 2. Breach banner (only when something is actually overdue) */}
        {breaches > 0 && (
          <Banner
            tone="red"
            title={`${breaches} IWO${breaches === 1 ? '' : 's'} past SLA`}
            message={warns > 0 ? `Another ${warns} will breach within 24h unless you intervene.` : 'Open the burn board to see which ones.'}
            actions={
              <Button size="sm" variant="secondary" onClick={() => navigate('/delivery/burn')}>
                Burn &amp; SLA
              </Button>
            }
          />
        )}

        {/* 3. Sub-brand portfolio roll-up */}
        <SectionCard
          title="Brand portfolio"
          subtitle="Active IWO count, billable value and brand-burn per sub-brand."
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/traffic">
                Open Traffic <ArrowUpRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          }
        >
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            }}
          >
            {portfolio.map((p) => {
              const b = brandMeta(p.id);
              const burnTone: '' | 'ok' | 'warn' | 'over' =
                p.burnPct >= 100 ? 'over' : p.burnPct >= 80 ? 'warn' : p.burnPct > 0 ? 'ok' : '';
              return (
                <div
                  key={p.id}
                  className="zui-card is-hoverable"
                  style={{ padding: 16, borderTop: `3px solid ${b.accent}`, cursor: 'pointer' }}
                  onClick={() => navigate('/traffic')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: b.accent,
                        color: b.ink,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 10,
                      }}
                    >
                      {b.short}
                    </span>
                    <div style={{ fontSize: 13, fontWeight: 600, minWidth: 0, flex: 1 }}>{b.name}</div>
                    {isConflictIsolated(p.id as SubsidiaryId) && (
                      <span className="zui-rag amber" style={{ fontSize: 9.5, padding: '1px 6px' }}>
                        Isolated
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {p.activeIWOs}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--fg-tertiary)' }}>active IWOs</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginBottom: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {p.billable} billable · {p.sla} SLA risk
                  </div>
                  <div className={`zui-hbar ${burnTone}`} aria-label={`Burn ${Math.round(p.burnPct)}%`}>
                    <span style={{ width: `${Math.min(100, p.burnPct)}%` }} />
                    <span className="zui-hbar-tick" style={{ left: '80%' }} aria-hidden="true" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--fg-tertiary)' }}>Brand burn</span>
                    <span style={{ fontSize: 11, color: 'var(--fg-secondary)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                      {Math.round(p.burnPct)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* 4. Main / side — Recent IWO activity · right column */}
        <div className="zui-grid-main-side">
          <SectionCard
            title="Recent IWO activity"
            subtitle="Live · in-flight"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/delivery/active">
                  All IWOs <ArrowUpRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            }
            flush
          >
            <DataTable<IwoActivityRow>
              bare
              rows={activityRows}
              columns={activityColumns}
              rowBrandEdge={(r) => r.brand}
              onRowClick={(r) => navigate(`/delivery/iwo/${r.id}`)}
            />
          </SectionCard>

          <div className="zui-stack">
            <MyTasksCard />

            <SectionCard title="Conflict firewall" subtitle="Named-competitor watch">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {risks.slice(0, 4).map((r) => (
                  <Link
                    key={r.id}
                    to="/conflict-firewall/breach-risks"
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: 'var(--rag-amber-soft)',
                      display: 'flex',
                      gap: 10,
                      color: 'inherit',
                    }}
                  >
                    <Shield size={16} style={{ color: 'var(--rag-amber)', flex: 'none', marginTop: 1 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {r.payload.requestedClientId}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--rag-amber)', marginTop: 2 }}>
                        excluded {r.payload.walledBrandIds.length} brand
                        {r.payload.walledBrandIds.length === 1 ? '' : 's'}
                      </div>
                    </div>
                  </Link>
                ))}
                {risks.length === 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--fg-tertiary)', padding: '4px 0' }}>
                    No exclusivity-risk events. Routing walls are holding.
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="This week's pulse" subtitle="Coming soon">
              <div style={{ fontSize: 12.5, color: 'var(--fg-tertiary)', lineHeight: 1.5 }}>
                Weekly briefs / ECD approvals / inter-co roll-up will surface here once
                the pulse aggregator (domain-event digest) lands.
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SUBSIDIARY — Today's work (home-brand scoped, rules-safe)
// ---------------------------------------------------------------------------

interface InboxRow {
  id: string;
  code: string;
  masterJobId: string;
  budgetDisplay: string;
}

function SubsidiaryDashboard({
  today,
  brandId,
  firstName,
}: {
  today: string;
  brandId: SubsidiaryId;
  firstName: string;
}) {
  const navigate = useNavigate();
  const b = brandMeta(brandId);
  const [issued, setIssued] = useState<InternalWorkOrder[]>([]);
  const [active, setActive] = useState<InternalWorkOrder[]>([]);
  const nowMs = useMemo(() => Date.now(), [issued, active]);

  useResilientSubscription((health) => {
    if (brandId === 'zeus-group') return;
    const unsubs: Array<() => void> = [];
    unsubs.push(subscribeIWOInbox(
      brandId,
      (rows) => { setIssued(rows); health.ok(); },
      () => { setIssued([]); health.fail(); },
    ));
    unsubs.push(subscribeIWOActive(
      brandId,
      (rows) => { setActive(rows); health.ok(); },
      () => { setActive([]); health.fail(); },
    ));
    return () => unsubs.forEach((u) => u());
  }, [brandId]);

  const budget = active.reduce((s, r) => s + (r.budgetMinor || 0), 0);
  const cost = active.reduce((s, r) => s + (r.cumulativeCostMinor || 0), 0);
  const burnPct = budget > 0 ? (cost / budget) * 100 : 0;
  const slaAtRisk = active.filter((i) => {
    const x = slaRisk(i, nowMs);
    return x === 'breach' || x === 'warn';
  }).length;
  const breaches = active.filter((i) => slaRisk(i, nowMs) === 'breach').length;
  const isolated = isConflictIsolated(brandId);

  const kpis: KpiSpec[] = [
    {
      label: 'Awaiting acceptance',
      value: issued.length,
      delta: issued.length > 0 ? 'open these first' : 'all clear',
      trend: issued.length > 0 ? 'down' : 'flat',
    },
    {
      label: 'In-flight IWOs',
      value: active.length,
      delta: active.length > 0 ? `${budget ? formatMinor(budget, active[0]?.currency ?? 'UGX') : '—'} billable` : 'nothing active',
      trend: 'flat',
    },
    {
      label: 'Brand burn',
      value: `${Math.round(burnPct)}`,
      unit: '%',
      delta: burnPct >= 100 ? 'over budget' : burnPct >= 80 ? 'near ceiling' : 'on track',
      trend: burnPct >= 80 ? 'down' : 'flat',
      color: burnPct >= 100 ? 'var(--rag-red)' : burnPct >= 80 ? 'var(--rag-amber)' : 'var(--rag-green)',
    },
    {
      label: 'SLA at risk',
      value: slaAtRisk,
      delta: breaches > 0 ? `${breaches} past due` : slaAtRisk > 0 ? 'within 24h' : 'none today',
      trend: slaAtRisk > 0 ? 'down' : 'flat',
    },
  ];

  const inboxRows: InboxRow[] = issued.map((i) => ({
    id: i.id,
    code: i.code,
    masterJobId: i.masterJobId,
    budgetDisplay: formatMinor(i.budgetMinor, i.currency),
  }));

  const inboxColumns: Column<InboxRow>[] = [
    { key: 'code',         label: 'IWO',         type: 'mono', width: 150 },
    { key: 'masterJobId',  label: 'Master job',  type: 'mono' },
    { key: 'budgetDisplay', label: 'Budget',     width: 140, align: 'right',
      render: (v) => <span className="zui-money">{String(v)}</span>,
    },
    { key: 'id',           label: '',            width: 100, sortable: false, align: 'right',
      render: (_v, r) => (
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/delivery/iwo/${r.id}`}>Open</Link>
        </Button>
      ),
    },
  ];

  const greeting = brandId === 'odd-gorilla'
    ? 'Hold the line.'
    : `Today's work, ${firstName}.`;

  return (
    <>
      <ModuleHeader
        title={
          <>
            {greeting}{' '}
            <span style={{ color: 'var(--fg-tertiary)', fontWeight: 400 }}>· {today}</span>
          </>
        }
        subtitle={
          isolated
            ? 'Conflict-isolated — your clients are not visible to other brands.'
            : "Work routed to your brand. Accept what's waiting, then track what's in flight."
        }
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/delivery/inbox"><Inbox className="h-3.5 w-3.5 mr-1" /> Inbox</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/time"><Plus className="h-3.5 w-3.5 mr-1" /> Post time</Link>
            </Button>
          </>
        }
      />

      <div className="zui-page zui-stack">
        {/* Subsidiary brand chip + name on the page itself (the shell shows
            the global brand chip, this gives the sub-brand its own identity). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 7,
              background: b.accent,
              color: b.ink,
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            {b.short}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--fg-primary)' }}>{b.name}</span>
          {isolated && (
            <span className="zui-rag amber" style={{ fontSize: 10, padding: '1px 8px' }}>
              Conflict-isolated
            </span>
          )}
        </div>

        {/* KPIs */}
        <KPIRow kpis={kpis} />

        {/* Overheating banner */}
        {breaches > 0 && (
          <Banner
            tone="red"
            title={`${breaches} IWO${breaches === 1 ? '' : 's'} past SLA`}
            message="These are on your plate. Close them first so the burn board clears."
            actions={
              <Button size="sm" variant="secondary" onClick={() => navigate('/delivery/burn')}>
                Open burn board
              </Button>
            }
          />
        )}

        {/* Inbox — awaiting acceptance */}
        <SectionCard
          title="Awaiting your acceptance"
          subtitle={
            issued.length === 0
              ? 'Nothing waiting on you.'
              : `${issued.length} IWO${issued.length === 1 ? '' : 's'} issued to your brand — accept to start the clock.`
          }
          flush
        >
          {issued.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 13 }}>
              Nice. Nothing waiting on you.
            </div>
          ) : (
            <DataTable<InboxRow>
              bare
              rows={inboxRows}
              columns={inboxColumns}
              rowBrandEdge={() => brandId}
              onRowClick={(r) => navigate(`/delivery/iwo/${r.id}`)}
            />
          )}
        </SectionCard>

        {/* In-flight summary + My tasks */}
        <div className="zui-grid-main-side">
          <SectionCard
            title="In-flight burn"
            subtitle={`${active.length} IWO${active.length === 1 ? '' : 's'} active · ceiling at 80%`}
          >
            {active.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--fg-tertiary)', fontSize: 13 }}>
                Nothing in flight yet.
              </div>
            ) : (
              <Hbars
                rows={active.slice(0, 6).map((i) => {
                  const bm = computeBurnMeter({ cumulativeMinor: i.cumulativeCostMinor, budgetMinor: i.budgetMinor });
                  return { label: i.code, value: Math.round(bm.percentage), display: `${Math.round(bm.percentage)}%` };
                })}
                max={100}
                threshold={80}
                warnAt={70}
                asPercent
              />
            )}
          </SectionCard>

          <MyTasksCard />
        </div>
      </div>
    </>
  );
}
