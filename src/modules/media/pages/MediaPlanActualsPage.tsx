/**
 * /media/:planId/actuals — reconcile actual spend against planned buys.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMediaPlan, listMediaBuys } from '../services/media-plan.service';
import { postActual } from '../services/media-actuals.service';
import type { MediaPlan } from '../types/media-plan.types';
import type { MediaBuy } from '../types/media-buy.types';
import type { MediaActual } from '../types/media-actual.types';
import { ActualReconcileForm } from '../components/ActualReconcileForm';

export default function MediaPlanActualsPage() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<MediaPlan | null>(null);
  const [buys, setBuys] = useState<MediaBuy[]>([]);
  const [activeBuy, setActiveBuy] = useState<MediaBuy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    Promise.all([getMediaPlan(planId), listMediaBuys(planId)])
      .then(([p, b]) => { setPlan(p); setBuys(b); })
      .catch((err) => setError(String((err as Error).message)))
      .finally(() => setLoading(false));
  }, [planId]);

  async function handlePostActual(values: Omit<MediaActual, 'id' | 'planId' | 'createdAt'>) {
    if (!planId) return;
    await postActual(planId, values);
    setSaved(`Actual posted for ${activeBuy?.vehicleName}`);
    setActiveBuy(null);
    // Reload buys to reflect updated actualMinor.
    const freshBuys = await listMediaBuys(planId);
    setBuys(freshBuys);
  }

  if (loading) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading…</p>;
  if (error)   return <div style={{ padding: 'var(--pad-page)' }}><div className="zeus-note danger">Error: {error}</div></div>;
  if (!plan)   return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Plan not found.</p>;

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-5">
      <div className="zeus-page-head">
        <Link to={`/media/${planId}`} className="zeus-back-link">← {plan.title}</Link>
        <div className="zeus-page-head-row">
          <div className="zeus-page-head-title">
            <h1>Post Actuals</h1>
          </div>
        </div>
      </div>

      {saved && (
        <div
          className="zeus-note"
          style={{
            background: 'var(--rag-green-soft)',
            color: 'var(--rag-green-deep, var(--rag-green))',
            borderColor: 'color-mix(in oklab, var(--rag-green) 24%, transparent)',
          }}
        >
          {saved}
        </div>
      )}

      {activeBuy ? (
        <ActualReconcileForm
          buy={activeBuy}
          onSave={handlePostActual}
          onCancel={() => setActiveBuy(null)}
        />
      ) : (
        <div className="space-y-2">
          <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>
            Select a buy to reconcile actual spend:
          </p>
          <div className="zeus-panel">
            {buys.length === 0 ? (
              <div className="zeus-panel-empty">
                No buys to reconcile — add a buy to this plan first.
              </div>
            ) : (
              <ul className="zeus-row-list">
                {buys.map((buy) => (
                  <li
                    key={buy.id}
                    className="zeus-row"
                    style={{ gridTemplateColumns: '1fr auto', cursor: 'pointer' }}
                    onClick={() => setActiveBuy(buy)}
                  >
                    <div>
                      <span style={{ fontWeight: 600 }}>{buy.vehicleName}</span>
                      <div className="zeus-row-sub">{buy.vehicleType}</div>
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)',
                        fontSize: 12,
                        color: 'var(--fg-tertiary)',
                        textAlign: 'right',
                      }}
                    >
                      <div>Planned {plan.currency} {(buy.plannedMinor / 100).toLocaleString()}</div>
                      <div>Actual {plan.currency} {(buy.actualMinor / 100).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
