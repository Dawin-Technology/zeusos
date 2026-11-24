/**
 * /media/:planId/report — post-campaign report: narrative, metrics table, PDF export stub.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMediaPlan, listMediaBuys, computeVariancePct } from '../services/media-plan.service';
import type { MediaPlan } from '../types/media-plan.types';
import type { MediaBuy } from '../types/media-buy.types';
import type { CampaignMetric } from '../types/post-campaign-report.types';

export default function PostCampaignReportPage() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<MediaPlan | null>(null);
  const [buys, setBuys] = useState<MediaBuy[]>([]);
  const [narrative, setNarrative] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!planId) return;
    Promise.all([getMediaPlan(planId), listMediaBuys(planId)])
      .then(([p, b]) => { setPlan(p); setBuys(b); })
      .finally(() => setLoading(false));
  }, [planId]);

  const metrics: CampaignMetric[] = buys.map((buy) => ({
    name: buy.vehicleName,
    planned: buy.plannedMinor,
    actual: buy.actualMinor,
    unit: plan?.currency ?? 'UGX',
  }));

  const totalPlanned = buys.reduce((s, b) => s + b.plannedMinor, 0);
  const totalActual  = buys.reduce((s, b) => s + b.actualMinor,  0);
  const overallVariancePct = computeVariancePct(totalPlanned, totalActual);

  function handleExportPDF() {
    // Stub: in Phase 5 this will call a Cloud Function to generate
    // a PDF using @react-pdf/renderer and upload to Storage.
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      alert('PDF export is not yet wired — this stub confirms the button works.');
    }, 800);
  }

  if (loading) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading…</p>;
  if (!plan)   return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Plan not found.</p>;

  return (
    <div style={{ padding: 'var(--pad-page)', maxWidth: 960 }} className="space-y-5 mx-auto">
      <div className="zeus-page-head">
        <Link to={`/media/${planId}`} className="zeus-back-link">← {plan.title}</Link>
        <div className="zeus-page-head-row">
          <div className="zeus-page-head-title">
            <h1>Post-Campaign Report</h1>
          </div>
          <div className="zeus-page-head-actions">
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="zeus-outline-btn"
            >
              {exporting ? 'Generating PDF…' : 'Export PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Narrative */}
      <section className="zeus-panel">
        <div className="zeus-panel-head">
          <h3>Executive narrative</h3>
          <span className="zeus-panel-head-meta">Shown on the exported PDF cover</span>
        </div>
        <div className="zeus-panel-pad">
          <textarea
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            rows={6}
            placeholder="Summarise campaign performance, key learnings, and recommendations…"
            className="zeus-textarea"
          />
        </div>
      </section>

      {/* Summary row */}
      <section className="zeus-tile-grid" style={{ ['--tile-cols' as string]: 3 }}>
        <div className="zeus-tile">
          <div className="zeus-tile-label">Total Planned</div>
          <div className="zeus-tile-value">
            {(totalPlanned / 100).toLocaleString()}
            <span className="zeus-tile-unit">{plan.currency}</span>
          </div>
        </div>
        <div className="zeus-tile">
          <div className="zeus-tile-label">Total Actual</div>
          <div className="zeus-tile-value">
            {(totalActual / 100).toLocaleString()}
            <span className="zeus-tile-unit">{plan.currency}</span>
          </div>
        </div>
        <div className={overallVariancePct > 10 ? 'zeus-tile warn' : 'zeus-tile'}>
          <div className="zeus-tile-label">Overall Variance</div>
          <div className="zeus-tile-value">
            {overallVariancePct > 0 ? '+' : ''}{overallVariancePct.toFixed(1)}
            <span className="zeus-tile-unit">%</span>
          </div>
          <div className="zeus-tile-sub">
            {overallVariancePct > 10 ? 'Over plan' : overallVariancePct < -10 ? 'Under plan' : 'On plan'}
          </div>
        </div>
      </section>

      {/* Per-buy metrics table */}
      <section className="zeus-panel">
        <div className="zeus-panel-head">
          <h3>Channel performance</h3>
          <span className="zeus-panel-head-meta">{metrics.length} channel{metrics.length === 1 ? '' : 's'}</span>
        </div>
        {metrics.length === 0 ? (
          <div className="zeus-panel-empty">No channels to report on yet.</div>
        ) : (
          <table className="zeus-ledger">
            <thead>
              <tr>
                <th>Channel</th>
                <th className="num">Planned</th>
                <th className="num">Actual</th>
                <th className="num">Variance %</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const pct = computeVariancePct(m.planned, m.actual);
                return (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td className="num">{plan.currency} {(m.planned / 100).toLocaleString()}</td>
                    <td className="num">{plan.currency} {(m.actual / 100).toLocaleString()}</td>
                    <td
                      className="num"
                      style={{
                        color:
                          pct > 10
                            ? 'var(--rag-red-deep, var(--rag-red))'
                            : pct < -10
                              ? 'var(--rag-green-deep, var(--rag-green))'
                              : undefined,
                      }}
                    >
                      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
