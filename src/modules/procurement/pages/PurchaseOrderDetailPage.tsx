/**
 * /procurement/purchase-orders/:poId — Detail view for a single PO with
 * its linked journal entry (if posted to GL).
 *
 * Shows the source invoice link, GL posting status, and breakdown of the
 * double-entry that posted on this PO's behalf.
 */

import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from '../services/purchase-order.service';
import { getJournalEntryForPO } from '../services/journal-entry.service';
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  CurrencyCode,
} from '../types/purchase-order.types';
import type { JournalEntry } from '../types/journal-entry.types';
import { PurchaseOrderStatusBadge } from '../components/PurchaseOrderStatusBadge';
import { PurchaseOrderKindBadge } from '../components/PurchaseOrderKindBadge';
import { getSupplier } from '@/modules/suppliers/services/supplier.service';
import type { Supplier } from '@/modules/suppliers/types/supplier.types';

const STATUSES: PurchaseOrderStatus[] = ['OPEN', 'POSTED', 'CLOSED', 'VOID'];
const CURRENCIES: CurrencyCode[] = ['UGX', 'USD', 'KES', 'EUR', 'GBP'];

function formatMoney(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'string') return value.slice(0, 10);
  const ts = value as { seconds?: number; toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 10);
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
  return '—';
}

export default function PurchaseOrderDetailPage() {
  const navigate = useNavigate();
  const { poId } = useParams<{ poId: string }>();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [je, setJe] = useState<JournalEntry | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<PurchaseOrder>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    if (!poId) return;
    const [poDoc, jeDoc] = await Promise.all([getPurchaseOrder(poId), getJournalEntryForPO(poId)]);
    setPo(poDoc);
    setJe(jeDoc);
    // Resolve supplierOrgId → Supplier (only relevant for media POs)
    if (poDoc?.supplierOrgId) {
      const s = await getSupplier(poDoc.supplierOrgId).catch(() => null);
      setSupplier(s);
    } else {
      setSupplier(null);
    }
  }

  useEffect(() => {
    if (!poId) return;
    setLoading(true);
    setError(null);
    reload()
      .catch((err) => setError(String((err as Error).message)))
      .finally(() => setLoading(false));
  }, [poId]);

  const isManualVendor = po?.kind === 'VENDOR_OTHER';

  async function handleSave() {
    if (!poId || !po) return;
    setSaving(true);
    setError(null);
    try {
      await updatePurchaseOrder(poId, {
        amountMinor: draft.amountMinor ?? po.amountMinor,
        currency: (draft.currency ?? po.currency) as CurrencyCode,
        status: (draft.status ?? po.status) as PurchaseOrderStatus,
        masterJobId: draft.masterJobId ?? po.masterJobId,
        supplierOrgId: draft.supplierOrgId ?? po.supplierOrgId,
        sourceInvoiceId: draft.sourceInvoiceId ?? po.sourceInvoiceId,
        notes: draft.notes ?? po.notes,
      });
      await reload();
      setEditing(false);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!poId || !po) return;
    const ok = window.confirm(
      `Delete purchase order ${po.id}? This is permanent. ` +
      `Only manual VENDOR_OTHER POs can be deleted — auto-raised TALENT/MEDIA POs are protected by Firestore rules.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deletePurchaseOrder(poId);
      navigate('/procurement/purchase-orders');
    } catch (err) {
      setError(String((err as Error).message));
      setDeleting(false);
    }
  }

  if (loading) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading purchase order…</p>;
  if (error && !po) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--rag-red)' }}>Error: {error}</p>;
  if (!po) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Purchase order not found.</p>;

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-6">
      <header className="zeus-page-head">
        <Link to="/procurement/purchase-orders" className="zeus-back-link">
          ← All purchase orders
        </Link>
        <div className="zeus-page-head-row">
          <div className="zeus-page-head-title">
            <h1 className="mono" data-testid="po-id">{po.id}</h1>
            <PurchaseOrderKindBadge kind={po.kind} />
            <PurchaseOrderStatusBadge status={po.status} />
          </div>
          {isManualVendor && (
            <div className="zeus-page-head-actions">
              {!editing && (
                <button
                  type="button"
                  onClick={() => { setDraft(po); setEditing(true); }}
                  className="zeus-outline-btn"
                  data-testid="po-edit-btn"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="zeus-outline-btn danger"
                data-testid="po-delete-btn"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </header>

      {error && <div className="zeus-note danger">{error}</div>}

      {editing && isManualVendor && (
        <section className="zeus-panel">
          <div className="zeus-panel-head">
            <h2>Edit PO</h2>
          </div>
          <div className="zeus-panel-pad">
            <div className="zeus-form-grid">
              <label>
                <span className="zeus-field-label">Amount (major units)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={((draft.amountMinor ?? po.amountMinor) / 100).toString()}
                  onChange={e => setDraft(d => ({ ...d, amountMinor: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                  className="zeus-input"
                />
              </label>
              <label>
                <span className="zeus-field-label">Currency</span>
                <select
                  value={(draft.currency ?? po.currency) as string}
                  onChange={e => setDraft(d => ({ ...d, currency: e.target.value as CurrencyCode }))}
                  className="zeus-select"
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>
                <span className="zeus-field-label">Status</span>
                <select
                  value={(draft.status ?? po.status) as string}
                  onChange={e => setDraft(d => ({ ...d, status: e.target.value as PurchaseOrderStatus }))}
                  className="zeus-select"
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>
                <span className="zeus-field-label">Master Job ID</span>
                <input
                  value={draft.masterJobId ?? ''}
                  onChange={e => setDraft(d => ({ ...d, masterJobId: e.target.value }))}
                  className="zeus-input"
                />
              </label>
              <label>
                <span className="zeus-field-label">Supplier org id</span>
                <input
                  value={draft.supplierOrgId ?? ''}
                  onChange={e => setDraft(d => ({ ...d, supplierOrgId: e.target.value }))}
                  className="zeus-input"
                />
              </label>
              <label>
                <span className="zeus-field-label">Source invoice / ref</span>
                <input
                  value={draft.sourceInvoiceId ?? ''}
                  onChange={e => setDraft(d => ({ ...d, sourceInvoiceId: e.target.value }))}
                  className="zeus-input"
                />
              </label>
              <label className="full">
                <span className="zeus-field-label">Notes</span>
                <textarea
                  value={draft.notes ?? ''}
                  onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                  rows={3}
                  className="zeus-textarea"
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="zeus-outline-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="zeus-panel">
        <div className="zeus-panel-head">
          <h2>Procurement details</h2>
        </div>
        <div className="zeus-panel-pad">
          <div className="zeus-def-grid">
            <div className="zeus-def">
              <span className="zeus-def-label">Amount</span>
              <span className="zeus-def-value strong" data-testid="po-amount">
                {formatMoney(po.amountMinor, po.currency)}
              </span>
            </div>
            <div className="zeus-def">
              <span className="zeus-def-label">Master Job</span>
              <span className="zeus-def-value mono">{po.masterJobId}</span>
            </div>
            <div className="zeus-def">
              <span className="zeus-def-label">Source invoice</span>
              <span className="zeus-def-value mono">{po.sourceInvoiceId}</span>
            </div>
            {po.supplierProfileId && (
              <div className="zeus-def">
                <span className="zeus-def-label">Talent profile</span>
                <span className="zeus-def-value mono">{po.supplierProfileId}</span>
              </div>
            )}
            {po.supplierOrgId && (
              <div className="zeus-def">
                <span className="zeus-def-label">Supplier</span>
                <span className="zeus-def-value">
                  {supplier ? (
                    <Link
                      to={`/suppliers/${supplier.id}`}
                      className="hover:underline"
                      data-testid="po-supplier-link"
                      style={{ color: 'var(--fg-primary)' }}
                    >
                      {supplier.name}
                    </Link>
                  ) : (
                    <span className="mono" style={{ color: 'var(--fg-tertiary)' }}>{po.supplierOrgId}</span>
                  )}
                </span>
              </div>
            )}
            {po.mediaPlanId && (
              <div className="zeus-def">
                <span className="zeus-def-label">Media plan</span>
                <span className="zeus-def-value mono">{po.mediaPlanId}</span>
              </div>
            )}
            {po.vehicleType && (
              <div className="zeus-def">
                <span className="zeus-def-label">Vehicle type</span>
                <span className="zeus-def-value">{po.vehicleType}</span>
              </div>
            )}
            <div className="zeus-def">
              <span className="zeus-def-label">Raised at</span>
              <span className="zeus-def-value">{formatDate(po.raisedAt)}</span>
            </div>
            <div className="zeus-def">
              <span className="zeus-def-label">GL posted</span>
              <span className="zeus-def-value">{po.postedToGL ? 'Yes' : 'No'}</span>
            </div>
          </div>
          {po.notes && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              <span className="zeus-def-label">Notes</span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-primary)', whiteSpace: 'pre-wrap' }}>{po.notes}</p>
            </div>
          )}
        </div>
      </section>

      <section className="zeus-panel" data-testid="po-je-section">
        <div className="zeus-panel-head">
          <h2>Linked journal entry</h2>
          {je && (
            <span className="zeus-panel-head-meta">
              Posted {formatDate(je.postedAt)}
            </span>
          )}
        </div>
        {!je && (
          <div className="zeus-panel-empty">
            No journal entry posted yet. The finance consumer posts a JE within seconds
            of the PO being raised.
          </div>
        )}
        {je && (
          <>
            <div className="zeus-panel-pad" style={{ paddingBottom: 6 }}>
              <Link
                to={`/procurement/journal-entries/${je.id}`}
                className="mono hover:underline"
                data-testid="je-link"
                style={{ fontSize: 12, color: 'var(--fg-primary)' }}
              >
                {je.id}
              </Link>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="zeus-ledger">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th className="num">Debit</th>
                    <th className="num">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {je.debits.map((line, i) => (
                    <tr key={`debit-${i}`}>
                      <td>
                        <span className="acct-code">{line.accountCode}</span>
                        <span className="dim">{line.accountName}</span>
                      </td>
                      <td className="num">{formatMoney(line.amountMinor, je.currency)}</td>
                      <td className="num dim">—</td>
                    </tr>
                  ))}
                  {je.credits.map((line, i) => (
                    <tr key={`credit-${i}`}>
                      <td>
                        <span className="acct-code">{line.accountCode}</span>
                        <span className="dim">{line.accountName}</span>
                      </td>
                      <td className="num dim">—</td>
                      <td className="num">{formatMoney(line.amountMinor, je.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
