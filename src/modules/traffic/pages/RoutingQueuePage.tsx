/**
 * Phase 6.UI.B — Routing Queue page.
 *
 * Lists master_jobs awaiting brand routing (`status === 'OPEN'`,
 * `allocatedMinor === 0`). For each row Traffic picks a capability
 * and clicks "Propose" → the `routeBrand` callable runs, the result
 * lands in `RoutingProposal` state, and `RouteBrandProposalCard`
 * renders the proposal with Confirm / Override CTAs.
 *
 * Confirm → routes the user to the master_job detail page so the
 * Account Manager can complete IWO issuance with the proposed brand
 * (the existing `IssueIWODialog` from Phase 3.D owns the budget /
 * handoff inputs). Override does the same with a different brand
 * and emits a console marker so the override flow is visible during
 * QA (Phase 6.E's unified inbox will persist override decisions).
 *
 * Shell re-skin PR 3: the propose form is a soft panel with the
 * `.zeus-select` capability picker and the refresh-shared `btn`
 * primary; the error / empty states read as soft tones. The proposal
 * itself keeps its existing card (RouteBrandProposalCard — already
 * token-driven).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import { RefreshCw } from 'lucide-react';
import { BRAND_CAPABILITIES, type Capability, type DeliverySubsidiaryId } from '@/core/settings/brand-capabilities';
import type { MasterJob } from '@/modules/assignment/types/master-job.types';
import { RouteBrandProposalCard } from '../components/RouteBrandProposalCard';
import {
  routeBrandFn,
  subscribeOpenMasterJobs,
} from '../services/traffic.service';
import type { RoutingProposal } from '../types/traffic.types';

// Capability options Traffic can dispatch against. Union of every
// capability declared by any sub-brand in `BRAND_CAPABILITIES`.
const ALL_CAPABILITIES: Capability[] = Array.from(
  new Set(
    Object.values(BRAND_CAPABILITIES).flatMap((set) => Array.from(set)),
  ),
).sort() as Capability[];

interface QueueRowState {
  capability: Capability;
  proposal: RoutingProposal | null;
  loading: boolean;
  error: string | null;
}

export default function RoutingQueuePage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<MasterJob[]>([]);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, QueueRowState>>({});

  useEffect(() => {
    const unsubscribe = subscribeOpenMasterJobs(
      (next) => {
        setJobs(next);
        // Seed row state for any new ids.
        setRows((prev) => {
          const out = { ...prev };
          for (const j of next) {
            if (!out[j.id]) {
              out[j.id] = { capability: 'creative', proposal: null, loading: false, error: null };
            }
          }
          return out;
        });
      },
      (e) => setSubscribeError(`Queue subscription failed: ${e.message}`),
    );
    return () => unsubscribe();
  }, []);

  const updateRow = (id: string, patch: Partial<QueueRowState>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const requestProposal = async (job: MasterJob) => {
    const row = rows[job.id];
    if (!row) return;
    updateRow(job.id, { loading: true, error: null });
    try {
      const res = await routeBrandFn({
        masterJobId: job.id,
        requiredCapability: row.capability,
        tier: job.tier,
        accountId: job.clientId,
      });
      updateRow(job.id, { proposal: res.data, loading: false });
    } catch (err) {
      const msg = err instanceof FirebaseError
        ? `${err.code}: ${err.message}`
        : err instanceof Error ? err.message : 'Unknown error';
      updateRow(job.id, { error: msg, loading: false });
    }
  };

  const confirmAndIssue = (job: MasterJob, brandId: DeliverySubsidiaryId) => {
    // Hand off to the existing AM-side issuance dialog on the
    // master_job detail page. The hash carries the proposed brand
    // so MasterJobDetailPage can pre-select it on `IssueIWODialog`.
    navigate(`/master-jobs/${job.id}#issue-iwo:${brandId}`);
  };

  const overrideAndIssue = (job: MasterJob, brandId: DeliverySubsidiaryId, reason?: string) => {
    // Override decisions are observable today via the
    // `RoutingBrandProposed` event (already emitted by the
    // callable) cross-referenced with the eventual IWO's
    // subsidiaryOrgId. The cross-reference UI lands in 6.E; for now
    // we just log so QA can see the override fire.
    if (import.meta.env.DEV) {
      console.info('[traffic] override', { masterJobId: job.id, brandId, reason });
    }
    navigate(`/master-jobs/${job.id}#issue-iwo:${brandId}`);
  };

  const visibleJobs = useMemo(() => jobs, [jobs]);

  if (subscribeError) {
    return (
      <div
        role="alert"
        data-testid="routing-queue-error"
        className="zeus-panel"
        style={{
          padding: '14px 18px',
          borderColor: 'color-mix(in oklab, var(--rag-red) 30%, transparent)',
          background: 'var(--rag-red-soft)',
          color: 'var(--rag-red-deep, var(--rag-red))',
          fontSize: 13,
        }}
      >
        {subscribeError}
      </div>
    );
  }

  return (
    <section
      data-testid="routing-queue-page"
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      {visibleJobs.length === 0 ? (
        <div
          data-testid="routing-queue-empty"
          className="zeus-panel"
          style={{
            padding: '28px 24px',
            textAlign: 'center',
            color: 'var(--fg-tertiary)',
            fontSize: 13,
            borderStyle: 'dashed',
          }}
        >
          No master jobs awaiting routing. Newly opened, unallocated jobs land here.
        </div>
      ) : (
        visibleJobs.map((job) => {
          const row = rows[job.id];
          if (!row) return null;
          return (
            <div key={job.id} data-testid={`queue-row-${job.id}`}>
              {!row.proposal ? (
                <article className="zeus-panel">
                  <div className="zeus-panel-pad">
                    <header
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        marginBottom: 14,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--fg-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {job.code || job.id}
                        </p>
                        {job.campaign?.clientName && (
                          <p
                            style={{
                              margin: '2px 0 0',
                              fontSize: 12,
                              color: 'var(--fg-tertiary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {job.campaign.clientName}
                            {job.campaign.name ? ` · ${job.campaign.name}` : ''}
                          </p>
                        )}
                      </div>
                    </header>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                      <label style={{ flex: 1, maxWidth: 220 }}>
                        <span className="zeus-field-label">Required capability</span>
                        <select
                          data-testid={`capability-select-${job.id}`}
                          value={row.capability}
                          onChange={(e) =>
                            updateRow(job.id, { capability: e.target.value as Capability })
                          }
                          className="zeus-select"
                        >
                          {ALL_CAPABILITIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="btn btn-primary"
                        data-testid={`propose-btn-${job.id}`}
                        disabled={row.loading}
                        onClick={() => requestProposal(job)}
                      >
                        {row.loading ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
                            Routing…
                          </>
                        ) : (
                          'Propose'
                        )}
                      </button>
                    </div>
                    {row.error && (
                      <p
                        role="alert"
                        data-testid={`propose-error-${job.id}`}
                        style={{
                          marginTop: 10,
                          marginBottom: 0,
                          fontSize: 12,
                          color: 'var(--rag-red-deep, var(--rag-red))',
                        }}
                      >
                        {row.error}
                      </p>
                    )}
                  </div>
                </article>
              ) : (
                <RouteBrandProposalCard
                  masterJob={job}
                  proposal={row.proposal}
                  onConfirm={(brandId) => confirmAndIssue(job, brandId)}
                  onOverride={(brandId, reason) => overrideAndIssue(job, brandId, reason)}
                />
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
