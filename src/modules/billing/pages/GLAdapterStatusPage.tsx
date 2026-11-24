/**
 * /billing/gl-status — per-subsidiary GL adapter health.
 *
 * Probes each ZeusOS subsidiary's configured adapter (defaults to the
 * Firestore audit adapter) and surfaces queue depth + last sync. The
 * QBO/Xero adapters return NOT_CONFIGURED until Phase 5 wires them.
 */

import { useEffect, useState } from 'react';
import { SUBSIDIARY_IDS } from '@/core/settings/types';
import type { SubsidiaryId } from '@/core/settings/types';
import { resolveAdapter } from '../services/gl-adapter.service';
import type { GLConnectionHealth } from '../types/gl.types';
import { PageHero } from '@/shared/components/refresh';

interface Row {
  orgId: SubsidiaryId;
  health: GLConnectionHealth | null;
  error?: string;
}

export function GLAdapterStatusPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: Row[] = [];
      for (const orgId of SUBSIDIARY_IDS) {
        try {
          const adapter = await resolveAdapter(orgId);
          const health = await adapter.status(orgId);
          results.push({ orgId, health });
        } catch (err) {
          results.push({
            orgId,
            health: null,
            error: String((err as Error)?.message ?? err),
          });
        }
      }
      if (!cancelled) {
        setRows(results);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-6">
      <PageHero
        eyebrow="Billing · Finance"
        title="GL adapter status"
        body="Per-subsidiary connection health, queue depth, and last sync. The default adapter writes to the gl_postings audit collection; QBO/Xero connections land in Phase 5."
      />

      {loading && <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Probing…</p>}

      {!loading && (
        <div className="zeus-panel">
          <table className="zeus-ledger">
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Adapter</th>
                <th>Status</th>
                <th className="num">Queue depth</th>
                <th>Last sync</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.orgId}>
                  <td style={{ fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)', fontSize: 12 }}>
                    {row.orgId}
                  </td>
                  <td className="dim" style={{ fontSize: 12.5 }}>{row.health?.adapter ?? '—'}</td>
                  <td>
                    {row.health ? (
                      <span className={statusPillClass(row.health.status)}>
                        {row.health.status}
                      </span>
                    ) : (
                      <span className="zeus-state-pill red">ERROR</span>
                    )}
                  </td>
                  <td className="num" style={{ fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)' }}>
                    {row.health?.queueDepth ?? '—'}
                  </td>
                  <td className="dim" style={{ fontSize: 12.5 }}>
                    {row.health?.lastSyncAt ? String(row.health.lastSyncAt) : '—'}
                  </td>
                  <td className="dim" style={{ fontSize: 12.5 }}>
                    {row.error ?? row.health?.message ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function statusPillClass(status: GLConnectionHealth['status']): string {
  switch (status) {
    case 'CONNECTED':
      return 'zeus-state-pill green';
    case 'NOT_CONFIGURED':
      return 'zeus-state-pill';
    case 'DISCONNECTED':
      return 'zeus-state-pill amber';
    case 'ERROR':
    default:
      return 'zeus-state-pill red';
  }
}

export default GLAdapterStatusPage;
