/**
 * /master-jobs — every master job grouped by client. Columns: code,
 * client, SOW, allocated vs ceiling, status, IWO count. Phase 3.D.
 *
 * Shell re-skin PR 2: swapped the raw tailwind tables for the refreshed
 * `PageHero` + `.zui-kpi-row` + `.card .tbl` chrome (same pattern the
 * ClientsPage uses). Status chips are tokenized via `Pill`.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMasterJobs, listIwosForMasterJob } from '@/modules/assignment/services/firestore';
import type { MasterJob } from '@/modules/assignment/types/master-job.types';
import { subscribeClients } from '@/modules/contracts/services/firestore';
import type { Client } from '@/modules/contracts/types/client.types';
import { PageHero, Pill, type RagTone } from '@/shared/components/refresh';
import { formatMinor } from '../utils/money';

interface Row extends MasterJob {
  iwoCount: number;
}

const STATUS_TONE_FOR: Record<string, RagTone> = {
  OPEN: 'blue',
  DELIVERING: 'amber',
  CLOSED: 'green',
  CANCELLED: 'red',
};

function pctTone(pct: number): 'ok' | 'warn' | 'over' | '' {
  if (pct > 100) return 'over';
  if (pct > 85) return 'warn';
  if (pct >= 0) return 'ok';
  return '';
}

export default function MasterJobsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mjs = await listMasterJobs();
      const enriched: Row[] = [];
      for (const mj of mjs) {
        const iwos = await listIwosForMasterJob(mj.id).catch(() => []);
        enriched.push({ ...mj, iwoCount: iwos.length });
      }
      if (!cancelled) {
        setRows(enriched);
        setLoading(false);
      }
    })();
    const unsub = subscribeClients((list) => {
      if (cancelled) return;
      const byId: Record<string, Client> = {};
      for (const c of list) byId[c.id] = c;
      setClients(byId);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const groups = useMemo(() => {
    const by: Record<string, Row[]> = {};
    for (const r of rows) {
      const key = r.clientId || '—';
      (by[key] ??= []).push(r);
    }
    return Object.entries(by).sort((a, b) => {
      const an = clients[a[0]]?.name ?? a[0];
      const bn = clients[b[0]]?.name ?? b[0];
      return an.localeCompare(bn);
    });
  }, [rows, clients]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    const iwoTotal = rows.reduce((s, r) => s + r.iwoCount, 0);
    const allocatedByCurrency: Record<string, number> = {};
    for (const r of rows) {
      allocatedByCurrency[r.currency] = (allocatedByCurrency[r.currency] || 0) + r.allocatedMinor;
    }
    return { total, byStatus, iwoTotal, allocatedByCurrency };
  }, [rows]);

  return (
    <div style={{ padding: 'var(--pad-page)' }}>
      <PageHero
        eyebrow="Account Management"
        title="Master jobs"
        body="One row per active client engagement increment. Allocated is the sum of issued IWO budgets; ceiling is the SOW cap (raised only by approved Change Orders)."
      />

      {!loading && rows.length > 0 && (
        <div className="zui-kpi-row" style={{ marginBottom: 20 }} data-testid="master-jobs-kpis">
          <div className="zui-kpi">
            <span className="zui-kpi-label">Master jobs</span>
            <span className="zui-kpi-value">{kpis.total}</span>
            <span className="zui-kpi-delta">in flight</span>
          </div>
          <div className="zui-kpi">
            <span className="zui-kpi-label">Open</span>
            <span className="zui-kpi-value">{kpis.byStatus['OPEN'] ?? 0}</span>
            <span className="zui-kpi-delta">accepting IWOs</span>
          </div>
          <div className="zui-kpi">
            <span className="zui-kpi-label">IWOs issued</span>
            <span className="zui-kpi-value">{kpis.iwoTotal}</span>
            <span className="zui-kpi-delta">cross-brand</span>
          </div>
          <div className="zui-kpi">
            <span className="zui-kpi-label">Allocated</span>
            {Object.keys(kpis.allocatedByCurrency).length === 0 ? (
              <span className="zui-kpi-value">—</span>
            ) : (
              <ul
                className="zui-kpi-value"
                style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 20, lineHeight: 1.2 }}
              >
                {Object.entries(kpis.allocatedByCurrency).map(([ccy, amt]) => (
                  <li key={ccy}>{formatMinor(amt, ccy)}</li>
                ))}
              </ul>
            )}
            <span className="zui-kpi-delta">against SOW ceilings</span>
          </div>
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading master jobs…</p>}

      {!loading && rows.length === 0 && (
        <div
          className="card card-pad"
          style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 13 }}
        >
          No master jobs yet. Accept a Quote in the Pricing module and one will open automatically.
        </div>
      )}

      {!loading &&
        groups.map(([clientId, jobs]) => {
          const client = clients[clientId];
          return (
            <section key={clientId} style={{ marginTop: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  marginBottom: 10,
                  padding: '0 4px',
                }}
              >
                <h2 className="eyebrow" style={{ margin: 0 }}>
                  {client ? client.name : `Client ${clientId}`}
                </h2>
                <span style={{ fontSize: 11.5, color: 'var(--fg-tertiary)' }}>
                  {jobs.length} job{jobs.length === 1 ? '' : 's'}
                </span>
                {client?.code && (
                  <span
                    className="tabular"
                    style={{ fontSize: 11, color: 'var(--fg-quaternary)' }}
                  >
                    {client.code}
                  </span>
                )}
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>SOW</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Allocated</th>
                      <th style={{ textAlign: 'right' }}>Ceiling</th>
                      <th>% used</th>
                      <th style={{ textAlign: 'right' }}>IWOs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => {
                      const pct =
                        j.ceilingMinor > 0
                          ? Math.round((j.allocatedMinor / j.ceilingMinor) * 100)
                          : 0;
                      const tone = pctTone(pct);
                      return (
                        <tr key={j.id} data-master-job-id={j.id} data-testid="master-job-row">
                          <td>
                            <Link
                              to={`/master-jobs/${j.id}`}
                              className="tabular"
                              style={{ fontWeight: 600 }}
                            >
                              {j.code}
                            </Link>
                          </td>
                          <td className="tabular" style={{ color: 'var(--fg-secondary)' }}>
                            {j.sowId}
                          </td>
                          <td>
                            <Pill tone={STATUS_TONE_FOR[j.status] ?? 'neutral'}>
                              {j.status.toLowerCase().replace(/_/g, ' ')}
                            </Pill>
                          </td>
                          <td className="tabular" style={{ textAlign: 'right' }}>
                            {formatMinor(j.allocatedMinor, j.currency)}
                          </td>
                          <td
                            className="tabular"
                            style={{ textAlign: 'right', color: 'var(--fg-secondary)' }}
                          >
                            {formatMinor(j.ceilingMinor, j.currency)}
                          </td>
                          <td style={{ minWidth: 140 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <span
                                className={`zui-mini-bar ${tone === 'warn' ? 'warn' : tone === 'over' ? 'over' : ''}`}
                              >
                                <span style={{ width: `${Math.min(100, pct)}%` }} />
                              </span>
                              <span className="tabular" style={{ fontSize: 11.5, fontWeight: 600 }}>
                                {pct}%
                              </span>
                            </div>
                          </td>
                          <td
                            className="tabular"
                            style={{ textAlign: 'right', fontWeight: 600 }}
                          >
                            {j.iwoCount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
    </div>
  );
}
