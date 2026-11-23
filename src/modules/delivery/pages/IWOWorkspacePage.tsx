/* eslint-disable design-system/no-inline-style-literals -- soft-skin re-skin PR 3 keeps many inline tokens (CSS vars) while the shell primitives are still growing; full migration lands with the U.4 sweep. */
/**
 * IWOWorkspacePage — the per-IWO subsidiary workspace.
 *
 * Visible only to users of the receiving subsidiary (rules + the
 * `SubsidiaryDeliveryGuard` filter the route).
 *
 * Renders:
 *   • Read-only handoff header (budget, due dates, comms owner).
 *   • Burn meter — live cumulative vs budget. ≥90 % shows red warn,
 *     ≥100 % surfaces BLOCKED banner. Server enforces hard cap; this is
 *     the UI mirror.
 *   • Time entry form — `postTimeEntry` callable.
 *   • Cost entry form — `postCostEntry` callable.
 *   • Deliverable submission — `submitDeliverable` callable, gated by
 *     acceptance criteria from the handoff packet (spec §7.3).
 *
 * All commercial affordances (price, quote, client comms) are absent by
 * construction — there is no path from this page to any pricing or
 * billing UI. Spec §7.4 boundary, Layer 1 (auth) keeps subsidiary users
 * out of those routes if they URL-hop; this page is the "what they
 * actually see" half.
 *
 * Shell re-skin PR 3: every raw-hex panel moves to `.zeus-panel`;
 * every form field uses `.zeus-field-label` + `.zeus-select` /
 * `.zeus-input`; every button maps onto the refresh `btn` classes.
 * Burn meter sits prominently at the top. Behaviour, data wiring,
 * and `data-testid`s are unchanged.
 */

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import { useResilientSubscription } from '@/shared/hooks/useResilientSubscription';
import type { InternalWorkOrder, HandoffPacket } from '@/modules/assignment';
import type { TimeEntry, CostEntry, Deliverable } from '@/modules/delivery';
import {
  subscribeIWO,
  subscribeHandoffPacket,
  subscribeTimeEntries,
  subscribeCostEntries,
  subscribeDeliverables,
} from '../services/firestore';
import {
  startWorkOrderFn,
  postTimeEntryFn,
  postCostEntryFn,
  submitDeliverableFn,
  type CostEntryKindForApi,
} from '../services/firebase';
import { computeBurnMeter } from '../services/burnMeter';
import { BurnMeterBar } from '../components/BurnMeterBar';
import { RouteToAMButton } from '../components/RouteToAMButton';
import { ApprovalLadderPanel } from '../components/ApprovalLadderPanel';
import { BackBar, Pill } from '@/shared/components/refresh';

function formatMinor(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTimestamp(ts: HandoffPacket['createdAt'] | undefined | null): string {
  if (!ts) return '—';
  if (typeof ts === 'string') return new Date(ts).toLocaleString();
  const maybe = ts as unknown as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toLocaleString();
  if (typeof maybe.seconds === 'number') return new Date(maybe.seconds * 1000).toLocaleString();
  return '—';
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const SECTION_TITLE: React.CSSProperties = {
  margin: 0,
  font: '600 14px var(--font-sans)',
  letterSpacing: '-0.01em',
  color: 'var(--fg-primary)',
};

export default function IWOWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dawinUser } = useCurrentDawinUser();

  const [iwo, setIwo] = useState<InternalWorkOrder | null>(null);
  const [packet, setPacket] = useState<HandoffPacket | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [costEntries, setCostEntries] = useState<CostEntry[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Time-entry form state
  const [teMinutes, setTeMinutes] = useState<string>('');
  const [teDate, setTeDate] = useState<string>(todayIso());
  const [teNote, setTeNote] = useState<string>('');

  // Cost-entry form state
  const [ceKind, setCeKind] = useState<CostEntryKindForApi>('VENDOR');
  const [ceAmount, setCeAmount] = useState<string>('');
  const [ceDesc, setCeDesc] = useState<string>('');
  const [cePassThrough, setCePassThrough] = useState(false);

  // Deliverable submission state — collect ≥1 asset id (free-text for
  // Phase 3.E; the Asset Library UI lands in Phase 4 and will replace
  // this with a real picker).
  const [delAssetIds, setDelAssetIds] = useState<string>('');
  const [delDesc, setDelDesc] = useState<string>('');

  useResilientSubscription((health) => {
    if (!id) return;
    const u1 = subscribeIWO(
      id,
      (next) => { setIwo(next); health.ok(); },
      (e) => { setErr(`IWO load failed: ${e.message}`); health.fail(); },
    );
    const u2 = subscribeHandoffPacket(id, setPacket, () => { /* packet may not exist yet */ });
    const u3 = subscribeTimeEntries(id, setTimeEntries, () => {});
    const u4 = subscribeCostEntries(id, setCostEntries, () => {});
    const u5 = subscribeDeliverables(id, setDeliverables, () => {});
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [id]);

  // Burn meter computes against stored cumulative; cross-checked locally
  // by summing entries so a stale snapshot doesn't lie about headroom.
  const meter = useMemo(() => {
    if (!iwo) return null;
    const localSum =
      timeEntries.reduce((a, e) => a + (e.costMinor || 0), 0) +
      costEntries.reduce((a, e) => a + (e.amountMinor || 0), 0);
    const cumulative = Math.max(iwo.cumulativeCostMinor || 0, localSum);
    return computeBurnMeter({ cumulativeMinor: cumulative, budgetMinor: iwo.budgetMinor });
  }, [iwo, timeEntries, costEntries]);

  if (!id) {
    return <div style={{ padding: 24 }}>Missing IWO id.</div>;
  }
  if (!iwo) {
    return <div style={{ padding: 24, color: 'var(--fg-tertiary)' }}>Loading work order…</div>;
  }

  const handleStart = async () => {
    setBusy(true);
    setErr(null);
    try {
      await startWorkOrderFn({ iwoId: iwo.id });
    } catch (e) {
      setErr(`Start failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handlePostTime = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user) { setErr('Not signed in.'); return; }
    const minutes = Number.parseInt(teMinutes, 10);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      setErr('Minutes must be a positive integer.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await postTimeEntryFn({
        iwoId: iwo.id,
        userId: user.uid,
        minutes,
        entryDate: teDate,
        note: teNote || undefined,
      });
      setTeMinutes('');
      setTeNote('');
    } catch (e) {
      setErr(`Post time failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handlePostCost = async (ev: React.FormEvent) => {
    ev.preventDefault();
    // Amount enters as a major-unit decimal for friendliness; convert
    // to integer minor units before sending.
    const amountMajor = Number.parseFloat(ceAmount);
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      setErr('Amount must be > 0.');
      return;
    }
    const amount = Math.round(amountMajor * 100);
    setBusy(true);
    setErr(null);
    try {
      await postCostEntryFn({
        iwoId: iwo.id,
        kind: ceKind,
        amount,
        isPassThrough: cePassThrough,
        description: ceDesc || undefined,
      });
      setCeAmount('');
      setCeDesc('');
    } catch (e) {
      setErr(`Post cost failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitDeliverable = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const assetIds = delAssetIds
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (assetIds.length === 0) {
      setErr('Provide at least one asset id (comma or whitespace separated).');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await submitDeliverableFn({
        iwoId: iwo.id,
        assetIds,
        description: delDesc || undefined,
      });
      setDelAssetIds('');
      setDelDesc('');
    } catch (e) {
      setErr(`Submit deliverable failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const canPostEntries = iwo.state === 'IN_PROGRESS' && meter?.status !== 'BLOCKED';
  const canSubmitDeliverable = iwo.state === 'IN_PROGRESS';
  const canStart = iwo.state === 'ACCEPTED';

  return (
    <div
      style={{ padding: 'var(--pad-page)', maxWidth: 960, margin: '0 auto' }}
      data-testid="iwo-workspace-page"
    >
      <span data-testid="iwo-back-to-inbox">
        <BackBar label="Inbox" onBack={() => navigate('/delivery/inbox')} />
      </span>

      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Delivery · IWO</div>
        <h1 className="display mono" data-testid="iwo-code">{iwo.code}</h1>
        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Pill tone="blue"><span data-testid="iwo-state">{iwo.state}</span></Pill>
          <span
            data-testid="iwo-budget"
            className="tabular"
            style={{ fontSize: 12.5, color: 'var(--fg-tertiary)' }}
          >
            Budget: {formatMinor(iwo.budgetMinor, iwo.currency)}
          </span>
        </div>
      </div>

      {err && (
        <div
          role="alert"
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

      {/* Burn meter — hero slot: drives every "can I post?" decision below. */}
      {meter && (
        <section className="zeus-panel" style={{ marginBottom: 20 }}>
          <header className="zeus-panel-head">
            <h2>Burn</h2>
          </header>
          <div className="zeus-panel-pad">
            <BurnMeterBar meter={meter} currency={iwo.currency} />
          </div>
        </section>
      )}

      {/* Phase 6.UI.D.2 — ECD approval ladder. Opens once the IWO
          transitions IN_PROGRESS → DELIVERED. Until then the chain
          isn't initialised and we hide the panel. */}
      {iwo.approvalChain && (
        <section
          style={{ marginBottom: 20 }}
          data-testid="iwo-approval-ladder-section"
        >
          <ApprovalLadderPanel iwoId={iwo.id} chain={iwo.approvalChain} />
        </section>
      )}

      <section className="zeus-panel" style={{ marginBottom: 20 }}>
        <header className="zeus-panel-head">
          <h2>Handoff packet</h2>
        </header>
        <div className="zeus-panel-pad">
          {packet ? (
            <>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--fg-secondary)',
                  marginBottom: 10,
                }}
              >
                Comms owner (Account Management):{' '}
                <strong style={{ color: 'var(--fg-primary)' }}>{packet.commsOwnerUserId}</strong>
                {' '}— the subsidiary does not contact the client directly.
              </div>
              <details>
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'var(--fg-primary)',
                  }}
                >
                  Brief
                </summary>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    marginTop: 8,
                    fontSize: 13,
                    color: 'var(--fg-primary)',
                    background: 'var(--bg-sunken)',
                    padding: 12,
                    borderRadius: 10,
                  }}
                >
                  {packet.briefMd}
                </pre>
              </details>
              <h3
                style={{
                  ...SECTION_TITLE,
                  fontSize: 12.5,
                  marginTop: 16,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--fg-tertiary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Milestones
              </h3>
              <ul
                style={{
                  listStyle: 'disc',
                  paddingLeft: 20,
                  fontSize: 13,
                  color: 'var(--fg-primary)',
                  margin: 0,
                }}
              >
                {packet.milestones.map((m) => (
                  <li key={m.id} style={{ marginBottom: 2 }}>
                    {m.name} — due {formatTimestamp(m.dueDate)}
                    {m.completedAt ? ' (complete)' : ''}
                  </li>
                ))}
              </ul>
              <h3
                style={{
                  ...SECTION_TITLE,
                  fontSize: 12.5,
                  marginTop: 14,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--fg-tertiary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Acceptance criteria
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: 13, color: 'var(--fg-primary)', margin: 0 }}>
                {packet.acceptanceCriteria.map((c) => (
                  <li key={c.id} style={{ padding: '4px 0', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ color: c.signedByUserId ? 'var(--rag-green)' : 'var(--fg-tertiary)' }}>
                      {c.signedByUserId ? '✓' : '○'}
                    </span>
                    {c.description}
                    {c.required ? (
                      <em
                        style={{
                          marginLeft: 6,
                          color: 'var(--rag-red-deep, var(--rag-red))',
                          fontStyle: 'normal',
                          fontSize: 11,
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        required
                      </em>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--fg-tertiary)', margin: 0 }}>
              No handoff packet attached yet.
            </p>
          )}
        </div>
      </section>

      {canStart && (
        <section style={{ marginBottom: 20 }}>
          <button
            type="button"
            data-testid="iwo-start"
            onClick={handleStart}
            disabled={busy}
            className="btn btn-primary"
          >
            Start work (move to IN_PROGRESS)
          </button>
        </section>
      )}

      {iwo.state === 'IN_PROGRESS' && (
        <>
          <section
            className="zeus-panel"
            style={{ marginBottom: 20 }}
            data-testid="iwo-post-time-section"
          >
            <header className="zeus-panel-head">
              <h2>Post time</h2>
            </header>
            <div className="zeus-panel-pad">
              <form
                onSubmit={handlePostTime}
                style={{ display: 'grid', gap: 12, maxWidth: 480 }}
                data-testid="iwo-post-time-form"
              >
                <label>
                  <span className="zeus-field-label">Date</span>
                  <input
                    data-testid="te-date"
                    type="date"
                    value={teDate}
                    onChange={(e) => setTeDate(e.target.value)}
                    required
                    className="zeus-input"
                  />
                </label>
                <label>
                  <span className="zeus-field-label">Minutes</span>
                  <input
                    data-testid="te-minutes"
                    type="number"
                    min={1}
                    step={1}
                    value={teMinutes}
                    onChange={(e) => setTeMinutes(e.target.value)}
                    required
                    className="zeus-input"
                  />
                </label>
                <label>
                  <span className="zeus-field-label">Note (optional)</span>
                  <input
                    data-testid="te-note"
                    type="text"
                    value={teNote}
                    onChange={(e) => setTeNote(e.target.value)}
                    className="zeus-input"
                  />
                </label>
                <button
                  type="submit"
                  data-testid="te-submit"
                  disabled={!canPostEntries || busy}
                  className="btn btn-primary"
                  style={{ justifySelf: 'start' }}
                >
                  Post time
                </button>
              </form>
            </div>
          </section>

          <section className="zeus-panel" style={{ marginBottom: 20 }}>
            <header className="zeus-panel-head">
              <h2>Post cost</h2>
            </header>
            <div className="zeus-panel-pad">
              <form
                onSubmit={handlePostCost}
                style={{ display: 'grid', gap: 12, maxWidth: 480 }}
              >
                <label>
                  <span className="zeus-field-label">Kind</span>
                  <select
                    value={ceKind}
                    onChange={(e) => setCeKind(e.target.value as CostEntryKindForApi)}
                    className="zeus-select"
                  >
                    <option value="VENDOR">Vendor</option>
                    <option value="MEDIA_SPEND">Media spend</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </label>
                <label>
                  <span className="zeus-field-label">Amount ({iwo.currency}, decimal)</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={ceAmount}
                    onChange={(e) => setCeAmount(e.target.value)}
                    required
                    className="zeus-input"
                  />
                </label>
                <label>
                  <span className="zeus-field-label">Description (optional)</span>
                  <input
                    type="text"
                    value={ceDesc}
                    onChange={(e) => setCeDesc(e.target.value)}
                    className="zeus-input"
                  />
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12.5,
                    color: 'var(--fg-secondary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={cePassThrough}
                    onChange={(e) => setCePassThrough(e.target.checked)}
                  />
                  Pass-through (rebilled at cost to client)
                </label>
                <button
                  type="submit"
                  disabled={!canPostEntries || busy}
                  className="btn btn-primary"
                  style={{ justifySelf: 'start' }}
                >
                  Post cost
                </button>
              </form>
            </div>
          </section>

          <section
            className="zeus-panel"
            style={{ marginBottom: 20 }}
            data-testid="iwo-submit-deliverable-section"
          >
            <header className="zeus-panel-head">
              <h2>Submit deliverable</h2>
            </header>
            <div className="zeus-panel-pad">
              <form
                onSubmit={handleSubmitDeliverable}
                style={{ display: 'grid', gap: 12, maxWidth: 480 }}
                data-testid="iwo-submit-deliverable-form"
              >
                <label>
                  <span className="zeus-field-label">
                    Asset ids (comma or whitespace separated; ≥1 required)
                  </span>
                  <input
                    data-testid="del-asset-ids"
                    type="text"
                    value={delAssetIds}
                    onChange={(e) => setDelAssetIds(e.target.value)}
                    required
                    className="zeus-input"
                  />
                </label>
                <label>
                  <span className="zeus-field-label">Description (optional)</span>
                  <input
                    data-testid="del-desc"
                    type="text"
                    value={delDesc}
                    onChange={(e) => setDelDesc(e.target.value)}
                    className="zeus-input"
                  />
                </label>
                <button
                  type="submit"
                  data-testid="iwo-deliver"
                  disabled={!canSubmitDeliverable || busy}
                  className="btn btn-accept"
                  style={{ justifySelf: 'start', padding: '7px 12px', fontSize: 13, fontWeight: 500 }}
                >
                  Submit deliverable
                </button>
              </form>
            </div>
          </section>
        </>
      )}

      <section className="zeus-panel" style={{ marginBottom: 20 }}>
        <header className="zeus-panel-head">
          <h2>Recent entries</h2>
        </header>
        <div
          className="zeus-panel-pad"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}
        >
          <div>
            <h3
              style={{
                margin: '0 0 6px',
                font: '600 10.5px var(--font-mono)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--fg-tertiary)',
              }}
            >
              Time ({timeEntries.length})
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12.5 }}>
              {timeEntries.slice(0, 6).map((te) => (
                <li
                  key={te.id}
                  style={{
                    padding: '6px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--fg-primary)',
                  }}
                >
                  {te.minutes} min · {formatMinor(te.costMinor, te.currency)}
                  {te.note ? (
                    <em
                      style={{
                        marginLeft: 6,
                        color: 'var(--fg-tertiary)',
                        fontStyle: 'normal',
                      }}
                    >
                      {te.note}
                    </em>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3
              style={{
                margin: '0 0 6px',
                font: '600 10.5px var(--font-mono)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--fg-tertiary)',
              }}
            >
              Cost ({costEntries.length})
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12.5 }}>
              {costEntries.slice(0, 6).map((ce) => (
                <li
                  key={ce.id}
                  style={{
                    padding: '6px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--fg-primary)',
                  }}
                >
                  {ce.kind} · {formatMinor(ce.amountMinor, ce.currency)}
                  {ce.isPassThrough ? ' (pass-through)' : ''}
                  {ce.description ? (
                    <em
                      style={{
                        marginLeft: 6,
                        color: 'var(--fg-tertiary)',
                        fontStyle: 'normal',
                      }}
                    >
                      {ce.description}
                    </em>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="zeus-panel" style={{ marginBottom: 20 }}>
        <header className="zeus-panel-head">
          <h2>Deliverables ({deliverables.length})</h2>
        </header>
        <div className="zeus-panel-pad">
          {deliverables.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--fg-tertiary)', margin: 0 }}>
              None submitted yet.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13 }}>
              {deliverables.map((d) => (
                <li
                  key={d.id}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--fg-primary)',
                  }}
                >
                  <strong>{d.name || d.id}</strong> ·{' '}
                  <span style={{ color: 'var(--fg-secondary)' }}>{d.state}</span>
                  {d.description ? (
                    <span style={{ marginLeft: 6, color: 'var(--fg-tertiary)' }}>
                      {d.description}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Spec §7.4 Layer 3 — the ONLY available action for a subsidiary
          user faced with a direct client request. No path to a quote,
          contract, or invoice exists from this page. */}
      <section
        className="zeus-panel"
        style={{
          marginTop: 24,
          background: 'var(--accent-soft)',
          borderColor: 'color-mix(in oklab, var(--accent) 22%, transparent)',
        }}
      >
        <div className="zeus-panel-pad">
          <h2
            style={{
              margin: 0,
              font: '600 14px var(--font-sans)',
              color: 'var(--fg-primary)',
            }}
          >
            Client got in touch directly?
          </h2>
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--fg-secondary)',
              margin: '4px 0 12px',
              lineHeight: 1.5,
            }}
          >
            The subsidiary does not answer the client on price, scope, or contract. Route
            the request to Account Management — they'll handle it.
          </p>
          {dawinUser && (
            <RouteToAMButton
              receivingSubsidiaryOrgId={iwo.subsidiaryOrgId}
              masterJobId={iwo.masterJobId}
              clientId={iwo.masterJobId}
              routedToUserId={packet?.commsOwnerUserId ?? ''}
              defaultNote={`Re: ${iwo.code} — `}
            />
          )}
        </div>
      </section>
    </div>
  );
}
