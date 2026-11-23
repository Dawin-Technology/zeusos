/**
 * Phase 6.UI.B — Override Log page.
 *
 * Lists every `RoutingBrandProposed` event in the domain_events
 * stream. Override detection (proposed vs actual brand) crosses
 * against issued IWOs — that join lands in 6.E with the unified
 * inbox. For now we show the raw proposal stream so Traffic can
 * audit decisions chronologically.
 *
 * Shell re-skin PR 3: the raw table becomes a `.zeus-panel` with
 * a sticky soft header and `.zeus-row` list rows that mirror the
 * Active IWOs surface, so Traffic reads as one cluster.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  subscribeRoutingProposals,
  type RoutingBrandProposedEvent,
} from '../services/traffic.service';

function formatOccurredAt(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

const HEAD_GRID = 'minmax(140px, 180px) minmax(140px, 1fr) 110px 150px 110px 80px';

export default function OverrideLogPage() {
  const [events, setEvents] = useState<RoutingBrandProposedEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeRoutingProposals(
      setEvents,
      (e) => setErr(`Override log subscription failed: ${e.message}`),
    );
    return () => unsubscribe();
  }, []);

  if (err) {
    return (
      <div
        role="alert"
        data-testid="override-log-error"
        className="zeus-panel"
        style={{
          padding: '14px 18px',
          borderColor: 'color-mix(in oklab, var(--rag-red) 30%, transparent)',
          background: 'var(--rag-red-soft)',
          color: 'var(--rag-red-deep, var(--rag-red))',
          fontSize: 13,
        }}
      >
        {err}
      </div>
    );
  }

  return (
    <section
      data-testid="override-log-page"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <p
        style={{
          fontSize: 12.5,
          color: 'var(--fg-secondary)',
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        Routing proposals emitted by the engine. Override detection (proposed vs actual
        brand) joins against issued IWOs — surfaced fully in 6.E.
      </p>

      {events.length === 0 ? (
        <div
          data-testid="override-log-empty"
          className="zeus-panel"
          style={{
            padding: '28px 24px',
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--fg-tertiary)',
            borderStyle: 'dashed',
          }}
        >
          No routing proposals recorded yet.
        </div>
      ) : (
        <div className="zeus-panel">
          <div
            role="row"
            style={{
              display: 'grid',
              gridTemplateColumns: HEAD_GRID,
              gap: 14,
              padding: '10px 18px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)',
              font: '600 10.5px var(--font-mono)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--fg-tertiary)',
            }}
          >
            <span>When</span>
            <span>Master Job</span>
            <span>Capability</span>
            <span>Proposed</span>
            <span>Geography</span>
            <span style={{ textAlign: 'right' }}>Rejected</span>
          </div>
          <ul className="zeus-row-list">
            {events.map((ev) => {
              const rejectedCount = ev.payload.candidates.filter(
                (c) => c.rejectionReason !== null,
              ).length;
              return (
                <li
                  key={ev.id}
                  data-testid={`override-log-row-${ev.id}`}
                  className="zeus-row"
                  style={{ gridTemplateColumns: HEAD_GRID, fontSize: 12.5 }}
                >
                  <span style={{ color: 'var(--fg-tertiary)', whiteSpace: 'nowrap' }}>
                    {formatOccurredAt(ev.occurredAt)}
                  </span>
                  <Link
                    to={`/master-jobs/${ev.aggregateId}`}
                    className="zeus-row-link"
                    style={{ fontSize: 12.5 }}
                  >
                    {ev.aggregateId}
                  </Link>
                  <span>{ev.payload.requiredCapability}</span>
                  <span style={{ fontWeight: 600 }}>
                    {ev.payload.proposedBrandId ?? (
                      <span style={{ color: 'var(--rag-red-deep, var(--rag-red))', fontWeight: 500 }}>
                        none eligible
                      </span>
                    )}
                  </span>
                  <span style={{ color: 'var(--fg-tertiary)' }}>
                    {ev.payload.geographyPreferenceApplied ?? '—'}
                  </span>
                  <span
                    style={{
                      textAlign: 'right',
                      color: 'var(--fg-tertiary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {rejectedCount}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
