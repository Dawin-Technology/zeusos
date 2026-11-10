/**
 * /clients — list every commercial-core Client with their open MSAs and
 * active SOWs at a glance. Phase 3.D.
 *
 * Shell re-skin PR 2: a KPI row (soft-skin `.zui-kpi`), the existing
 * MSA-status chip filters, and the refreshed `.tbl` card with soft
 * `BrandChip` from zeus-ui. Data wiring (subscribeClients + MSA/SOW
 * enrichment) and navigation are unchanged.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import {
  subscribeClients,
  listMsasForClient,
  listSowsForClient,
} from '@/modules/contracts/services/firestore';
import type { Client, ClientStatus } from '@/modules/contracts/types/client.types';
import type { MSA } from '@/modules/contracts/types/msa.types';
import type { SOW } from '@/modules/contracts/types/sow.types';
import type { SubsidiaryId } from '@/core/settings/types';
import { PageHero, Pill, type RagTone } from '@/shared/components/refresh';
import { BrandChip, type SubBrandId } from '@/shared/components/zeus-ui';
import { formatMinor } from '../utils/money';

interface Row {
  client: Client;
  openMsas: number;
  activeSows: number;
  ceilingByCurrency: Record<string, number>;
}

const BRAND_ACCENT: Record<SubsidiaryId, string> = {
  'zeus-group': '#0a1f4a',
  'zeus-the-agency': '#f5d900',
  'zeus-digital': '#00c5e5',
  labyrinth: '#2f9d5c',
  'odd-gorilla': '#e65b66',
  'house-of-zeus': '#6fa823',
};

const STATUS_TONE: Record<ClientStatus, RagTone> = {
  ACTIVE: 'green',
  PROSPECT: 'blue',
  CHURNED: 'neutral',
  BLOCKED: 'red',
};

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | ClientStatus>('all');

  useEffect(() => {
    let cancelled = false;
    const unsub = subscribeClients(async (clients) => {
      const enriched: Row[] = [];
      for (const c of clients) {
        const [msas, sows] = await Promise.all([
          listMsasForClient(c.id).catch(() => [] as MSA[]),
          listSowsForClient(c.id).catch(() => [] as SOW[]),
        ]);
        const ceilingByCurrency: Record<string, number> = {};
        for (const s of sows) {
          if (s.status === 'ACTIVE') {
            ceilingByCurrency[s.currency] = (ceilingByCurrency[s.currency] || 0) + s.ceilingMinor;
          }
        }
        enriched.push({
          client: c,
          openMsas: msas.filter((m) => m.status === 'DRAFT' || m.status === 'ACTIVE').length,
          activeSows: sows.filter((s) => s.status === 'ACTIVE').length,
          ceilingByCurrency,
        });
      }
      if (!cancelled) {
        setRows(enriched.sort((a, b) => a.client.name.localeCompare(b.client.name)));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const visibleRows = useMemo(
    () =>
      rows
        .filter(({ client }) => showArchived || client.status !== 'BLOCKED')
        .filter(({ client }) => statusFilter === 'all' || client.status === statusFilter),
    [rows, showArchived, statusFilter],
  );

  const countFor = (status: 'all' | ClientStatus) =>
    status === 'all'
      ? rows.filter((r) => showArchived || r.client.status !== 'BLOCKED').length
      : rows.filter((r) => r.client.status === status).length;

  const filterChips: Array<{ key: 'all' | ClientStatus; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'PROSPECT', label: 'Prospect' },
    { key: 'CHURNED', label: 'Churned' },
  ];

  const kpis = useMemo(() => {
    const active = rows.filter((r) => r.client.status === 'ACTIVE').length;
    const prospects = rows.filter((r) => r.client.status === 'PROSPECT').length;
    const openMsaTotal = rows.reduce((s, r) => s + r.openMsas, 0);
    const activeSowTotal = rows.reduce((s, r) => s + r.activeSows, 0);
    return { active, prospects, openMsaTotal, activeSowTotal };
  }, [rows]);

  return (
    <div style={{ padding: 'var(--pad-page)' }}>
      <PageHero
        eyebrow="Account Management"
        title="Client portfolio"
        body={
          loading
            ? "Zeus Group's commercial counterparties. Subsidiary identity is never shown on these documents."
            : `${rows.length} client relationship${rows.length === 1 ? '' : 's'}. Routing follows each client's primary brand. Subsidiary identity is never shown on these documents.`
        }
        actions={
          <>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                style={{ marginRight: 2 }}
              />
              Archived
            </label>
            <Link to="/clients/new" className="btn btn-primary">
              <Plus size={13} /> New client
            </Link>
          </>
        }
      />

      {!loading && rows.length > 0 && (
        <div className="zui-kpi-row" style={{ marginBottom: 20 }} data-testid="clients-kpis">
          <div className="zui-kpi">
            <span className="zui-kpi-label">Active clients</span>
            <span className="zui-kpi-value">{kpis.active}</span>
            <span className="zui-kpi-delta">live engagements</span>
          </div>
          <div className="zui-kpi">
            <span className="zui-kpi-label">Prospects</span>
            <span className="zui-kpi-value">{kpis.prospects}</span>
            <span className="zui-kpi-delta">pre-contract</span>
          </div>
          <div className="zui-kpi">
            <span className="zui-kpi-label">Open MSAs</span>
            <span className="zui-kpi-value">{kpis.openMsaTotal}</span>
            <span className="zui-kpi-delta">draft or active</span>
          </div>
          <div className="zui-kpi">
            <span className="zui-kpi-label">Active SOWs</span>
            <span className="zui-kpi-value">{kpis.activeSowTotal}</span>
            <span className="zui-kpi-delta">cross-brand</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {filterChips.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`btn ${statusFilter === f.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
            <span className="tabular" style={{ marginLeft: 6, opacity: 0.7, fontWeight: 500, fontSize: 11 }}>
              {countFor(f.key)}
            </span>
          </button>
        ))}
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading clients…</p>}

      {!loading && rows.length === 0 && (
        <div
          className="card card-pad"
          style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 13 }}
        >
          No clients yet. Start by creating one — that unlocks MSAs and SOWs.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Client</th>
                <th>Industry</th>
                <th>Primary brand</th>
                <th>Status</th>
                <th>Billing</th>
                <th style={{ textAlign: 'right' }}>Open MSAs</th>
                <th style={{ textAlign: 'right' }}>Active SOWs</th>
                <th style={{ textAlign: 'right' }}>Active ceiling</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ client, openMsas, activeSows, ceilingByCurrency }) => {
                const accent = BRAND_ACCENT[client.primaryBrandId] ?? BRAND_ACCENT['zeus-group'];
                return (
                  <tr
                    key={client.id}
                    data-client-id={client.id}
                    data-testid="client-row"
                    style={{
                      cursor: 'pointer',
                      opacity: client.status === 'BLOCKED' ? 0.5 : 1,
                      boxShadow: `inset 3px 0 0 ${accent}`,
                    }}
                    onClick={() => navigate(`/clients/${client.id}`)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            background: 'var(--bg-sunken)',
                            color: 'var(--fg-primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            flex: 'none',
                          }}
                        >
                          {initials(client.name)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <Link
                            to={`/clients/${client.id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontWeight: 600 }}
                          >
                            {client.name}
                          </Link>
                          {client.code && (
                            <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{client.code}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--fg-secondary)' }}>{client.sector || '—'}</td>
                    <td>
                      <BrandChip id={client.primaryBrandId as SubBrandId} full />
                    </td>
                    <td>
                      <Pill tone={STATUS_TONE[client.status]}>{client.status.toLowerCase()}</Pill>
                    </td>
                    <td className="tabular" style={{ color: 'var(--fg-secondary)' }}>{client.billingCurrency}</td>
                    <td className="tabular" style={{ textAlign: 'right' }}>{openMsas}</td>
                    <td className="tabular" style={{ textAlign: 'right', fontWeight: 600 }}>{activeSows}</td>
                    <td className="tabular" style={{ textAlign: 'right', color: 'var(--fg-secondary)' }}>
                      {Object.entries(ceilingByCurrency).length === 0
                        ? '—'
                        : Object.entries(ceilingByCurrency).map(([ccy, amt]) => (
                            <div key={ccy}>{formatMinor(amt, ccy)}</div>
                          ))}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="btn btn-ghost" style={{ padding: '4px 8px' }}>
                        <ChevronRight size={14} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
