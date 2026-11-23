/**
 * Phase 6.UI.B — Active IWOs page. Lists every in-flight IWO
 * grouped by brand, with SLA status (state colour) + burn % derived
 * from `cumulativeCostMinor / budgetMinor`.
 *
 * SLA badge: derived from state + tier turnaround windows in 6.E.
 * For now we surface state directly.
 *
 * Shell re-skin PR 3: the brand sections become `.zeus-panel` cards
 * with `.zeus-row` list rows; the burn meter uses the soft
 * `.zeus-burn` primitive with RAG-tuned fill; IWO state becomes a
 * `.zeus-state-pill`. `data-testid`s on every row + section are
 * preserved verbatim.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ALL_DELIVERY_SUBSIDIARIES } from '@/core/settings/brand-capabilities';
import type { InternalWorkOrder } from '@/modules/assignment/types/iwo.types';
import { subscribeActiveIwos } from '../services/traffic.service';

function burnPct(iwo: InternalWorkOrder): number {
  if (!iwo.budgetMinor) return 0;
  return Math.min(100, Math.round((iwo.cumulativeCostMinor / iwo.budgetMinor) * 100));
}

const STATE_TONE: Record<string, string> = {
  ISSUED: 'amber',
  ACCEPTED: 'green',
  IN_PROGRESS: 'accent',
  REVISION_REQUESTED: 'red',
  DELIVERED: '',
};

const BRAND_LABELS: Record<string, string> = {
  'zeus-the-agency': 'Zeus The Agency',
  'zeus-digital': 'Zeus Digital',
  labyrinth: 'Labyrinth',
  'odd-gorilla': 'Odd Gorilla',
  'house-of-zeus': 'House of Zeus',
};

export default function ActiveIwosPage() {
  const [iwos, setIwos] = useState<InternalWorkOrder[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeActiveIwos(setIwos, (e) =>
      setErr(`Active IWO subscription failed: ${e.message}`),
    );
    return () => unsubscribe();
  }, []);

  const grouped = useMemo(() => {
    const out: Record<string, InternalWorkOrder[]> = {};
    for (const b of ALL_DELIVERY_SUBSIDIARIES) out[b] = [];
    for (const i of iwos) {
      if (out[i.subsidiaryOrgId]) out[i.subsidiaryOrgId].push(i);
    }
    return out;
  }, [iwos]);

  if (err) {
    return (
      <div
        role="alert"
        data-testid="active-iwos-error"
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
      data-testid="active-iwos-page"
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {ALL_DELIVERY_SUBSIDIARIES.map((brandId) => {
        const items = grouped[brandId];
        const label = BRAND_LABELS[brandId] ?? brandId;
        return (
          <section
            key={brandId}
            data-testid={`brand-section-${brandId}`}
            className="zeus-panel"
          >
            <header className="zeus-panel-head">
              <h2>{label}</h2>
              <span className="zeus-panel-head-meta">
                {items.length} active
              </span>
            </header>
            {items.length === 0 ? (
              <p className="zeus-panel-empty">No active IWOs.</p>
            ) : (
              <ul className="zeus-row-list">
                {items.map((iwo) => {
                  const pct = burnPct(iwo);
                  const fillTone = pct >= 90 ? 'over' : pct >= 70 ? 'warn' : '';
                  const stateTone = STATE_TONE[iwo.state] ?? '';
                  return (
                    <li
                      key={iwo.id}
                      data-testid={`iwo-row-${iwo.id}`}
                      className="zeus-row"
                      style={{ gridTemplateColumns: 'minmax(180px, 220px) auto 1fr' }}
                    >
                      <Link
                        to={`/delivery/iwo/${iwo.id}`}
                        className="zeus-row-link"
                        style={{ fontSize: 12.5 }}
                      >
                        {iwo.code || iwo.id}
                      </Link>
                      <span
                        className={`zeus-state-pill${stateTone ? ' ' + stateTone : ''}`}
                      >
                        {iwo.state}
                      </span>
                      <div className="zeus-burn">
                        <div className="zeus-burn-track">
                          <span
                            className={`zeus-burn-fill${fillTone ? ' ' + fillTone : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="zeus-burn-label">{pct}% burned</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </section>
  );
}
