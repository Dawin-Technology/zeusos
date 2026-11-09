/**
 * IWOInboxPage — the subsidiary delivery workspace inbox.
 *
 * Shows every IWO issued to the current user's home subsidiary that is in
 * state `ISSUED`. Each row exposes Accept / Reject buttons that invoke the
 * Phase 3.B Cloud Functions. Rejecting prompts for a reason (required by
 * the Cloud Function — empty strings throw 400).
 *
 * Spec §6.1.1: only the delivery lead of the receiving subsidiary can
 * accept or reject. Firestore rules + the callable both check this; the
 * UI surfaces the resulting error as a banner.
 *
 * Re-skin: Zeus-UI primitives (ModuleHeader, Banner, SectionCard,
 * DataTable, RagBadge). All data wiring, callable invocations and
 * data-testids are preserved verbatim — Playwright specs keep passing.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentDawinUser } from '@/core/settings';
import type { InternalWorkOrder } from '@/modules/assignment';
import type { SubsidiaryId } from '@/core/settings/types';
import { subscribeIWOInbox, subscribeIWOActive } from '../services/firestore';
import { acceptWorkOrderFn, rejectWorkOrderFn } from '../services/firebase';
import { resolveHomeSubsidiaryId } from '../components/deliveryAccess';
import { isConflictIsolated } from '@/core/navigation/manifest';
import {
  Banner,
  DataTable,
  ModuleHeader,
  RagBadge,
  SectionCard,
  type Column,
  type SubBrandId,
} from '@/shared/components/zeus-ui';

function formatMinor(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTimestamp(ts: InternalWorkOrder['issuedAt']): string {
  if (!ts) return '—';
  if (typeof ts === 'string') return new Date(ts).toLocaleString();
  const maybe = ts as unknown as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toLocaleString();
  if (typeof maybe.seconds === 'number') return new Date(maybe.seconds * 1000).toLocaleString();
  return '—';
}

export default function IWOInboxPage() {
  const navigate = useNavigate();
  const { dawinUser } = useCurrentDawinUser();
  const homeSub = useMemo<SubsidiaryId | null>(
    () => (dawinUser ? (resolveHomeSubsidiaryId(dawinUser) as SubsidiaryId | null) : null),
    [dawinUser],
  );

  const [inbox, setInbox] = useState<InternalWorkOrder[]>([]);
  const [active, setActive] = useState<InternalWorkOrder[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!homeSub) return;
    const u1 = subscribeIWOInbox(homeSub, setInbox, (e) => setErr(`Inbox load failed: ${e.message}`));
    const u2 = subscribeIWOActive(homeSub, setActive, () => { /* swallow — active list is a convenience */ });
    return () => { u1(); u2(); };
  }, [homeSub]);

  const handleAccept = async (iwo: InternalWorkOrder) => {
    setBusyId(iwo.id);
    setErr(null);
    try {
      await acceptWorkOrderFn({ iwoId: iwo.id });
    } catch (e) {
      setErr(`Accept failed for ${iwo.code}: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (iwo: InternalWorkOrder) => {
    // eslint-disable-next-line no-alert -- prompt is the simplest reason-capture; will move to a dialog when toast/dialog system is unified
    const reason = window.prompt(`Reject ${iwo.code}?\nReason (required):`);
    if (!reason || !reason.trim()) return;
    setBusyId(iwo.id);
    setErr(null);
    try {
      await rejectWorkOrderFn({ iwoId: iwo.id, reason: reason.trim() });
    } catch (e) {
      setErr(`Reject failed for ${iwo.code}: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  if (!dawinUser) {
    return (
      <div style={{ padding: 'var(--pad-page)', color: 'var(--fg-tertiary)' }}>
        Loading user…
      </div>
    );
  }
  if (!homeSub) {
    return (
      <>
        <ModuleHeader
          title="IWO inbox"
          subtitle="Delivery — brand access"
        />
        <div className="zui-page">
          <Banner
            tone="amber"
            title="No operating brand"
            message="You don't appear to have access to any operating subsidiary. Speak to your administrator."
          />
        </div>
      </>
    );
  }

  const brand = homeSub as SubBrandId;
  const showIsolationBanner = isConflictIsolated(homeSub);

  // ─── Awaiting-acceptance table ───────────────────────────────────────
  interface InboxRow {
    id: string;
    code: string;
    budgetDisplay: string;
    issuedDisplay: string;
    iwo: InternalWorkOrder; // kept for the action buttons
  }
  const inboxRows: InboxRow[] = inbox.map((iwo) => ({
    id: iwo.id,
    code: iwo.code,
    budgetDisplay: formatMinor(iwo.budgetMinor, iwo.currency),
    issuedDisplay: formatTimestamp(iwo.issuedAt),
    iwo,
  }));
  const inboxColumns: Column<InboxRow>[] = [
    {
      key: 'code',
      label: 'IWO',
      type: 'mono',
      width: 160,
      render: (v, r) => (
        <Link
          to={`/delivery/iwo/${r.id}`}
          className="zui-mono hover:underline"
          style={{ fontWeight: 600, color: 'var(--fg-primary)' }}
          data-testid={`iwo-row-${r.id}-code`}
        >
          {String(v)}
        </Link>
      ),
    },
    {
      key: 'budgetDisplay',
      label: 'Budget',
      width: 180,
      align: 'right',
      render: (v, r) => (
        <span className="zui-money" data-testid={`iwo-row-${r.id}-budget`}>
          {String(v)}
        </span>
      ),
    },
    {
      key: 'issuedDisplay',
      label: 'Issued',
      type: 'date',
    },
    {
      key: 'id',
      label: '',
      width: 180,
      align: 'right',
      sortable: false,
      render: (_v, r) => {
        const busy = busyId === r.id;
        return (
          <span style={{ display: 'inline-flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              data-testid={`iwo-row-${r.id}-accept`}
              onClick={(e) => { e.stopPropagation(); handleAccept(r.iwo); }}
              disabled={busy}
              className="btn btn-accept"
            >
              {busy ? '…' : 'Accept'}
            </button>
            <button
              type="button"
              data-testid={`iwo-row-${r.id}-reject`}
              onClick={(e) => { e.stopPropagation(); handleReject(r.iwo); }}
              disabled={busy}
              className="btn btn-reject"
            >
              Reject
            </button>
          </span>
        );
      },
    },
  ];

  // ─── In-flight table ─────────────────────────────────────────────────
  interface ActiveRow {
    id: string;
    code: string;
    spendDisplay: string;
    state: string;
  }
  const activeRows: ActiveRow[] = active.map((iwo) => ({
    id: iwo.id,
    code: iwo.code,
    spendDisplay: `${formatMinor(iwo.cumulativeCostMinor, iwo.currency)} of ${formatMinor(
      iwo.budgetMinor,
      iwo.currency,
    )}`,
    state: iwo.state,
  }));
  const activeColumns: Column<ActiveRow>[] = [
    {
      key: 'code',
      label: 'IWO',
      type: 'mono',
      width: 160,
      render: (v, r) => (
        <Link
          to={`/delivery/iwo/${r.id}`}
          className="zui-mono hover:underline"
          style={{ fontWeight: 600, color: 'var(--fg-primary)' }}
        >
          {String(v)}
        </Link>
      ),
    },
    {
      key: 'spendDisplay',
      label: 'Spend vs budget',
      align: 'right',
      render: (v) => <span className="zui-money">{String(v)}</span>,
    },
    {
      key: 'state',
      label: 'State',
      width: 180,
      render: (v) => <RagBadge tone="blue" label={String(v).replace(/_/g, ' ').toLowerCase()} />,
    },
  ];

  return (
    <div data-testid="iwo-inbox-page">
      <ModuleHeader
        title="IWO inbox"
        subtitle={
          <>
            Internal work orders issued to your brand. Accept to lock the budget hold;
            reject (with reason) to release it.
          </>
        }
      />

      <div className="zui-page zui-stack">
        {showIsolationBanner && (
          <div role="note" data-testid="iwo-inbox-isolation-banner">
            <Banner
              tone="amber"
              title="Conflict-isolated workspace"
              message="Your clients are not visible to other brands."
            />
          </div>
        )}

        {err && (
          <div role="alert" data-testid="iwo-inbox-error">
            <Banner tone="red" title="Action failed" message={err} />
          </div>
        )}

        {/* Awaiting acceptance */}
        <section data-testid="iwo-inbox-awaiting">
          <SectionCard
            title={
              <>
                Awaiting acceptance (
                <span data-testid="iwo-inbox-awaiting-count">{inbox.length}</span>
                )
              </>
            }
            subtitle={
              inbox.length === 0
                ? 'Nothing issued to your brand right now.'
                : 'Accept locks the budget hold · Reject (with reason) releases it.'
            }
            flush
          >
            {inbox.length === 0 ? (
              <p
                data-testid="iwo-inbox-empty"
                style={{
                  padding: 24,
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--fg-tertiary)',
                  margin: 0,
                }}
              >
                No new work orders issued to you.
              </p>
            ) : (
              <DataTable<InboxRow>
                bare
                rows={inboxRows}
                columns={inboxColumns}
                rowBrandEdge={() => brand}
                rowTestId={(r) => `iwo-row-${r.id}`}
              />
            )}
          </SectionCard>
        </section>

        {/* In-flight */}
        <SectionCard
          title={`In-flight (${active.length})`}
          subtitle={
            active.length === 0
              ? 'Nothing in flight.'
              : 'Accepted IWOs currently burning. Click a row to open the workspace.'
          }
          flush
        >
          {active.length === 0 ? (
            <p
              style={{
                padding: 24,
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--fg-tertiary)',
                margin: 0,
              }}
            >
              Nothing in flight.
            </p>
          ) : (
            <DataTable<ActiveRow>
              bare
              rows={activeRows}
              columns={activeColumns}
              rowBrandEdge={() => brand}
              onRowClick={(r) => navigate(`/delivery/iwo/${r.id}`)}
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
