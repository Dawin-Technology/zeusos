/**
 * /procurement/purchase-orders/new — manual VENDOR_OTHER PO entry.
 *
 * TALENT_FREELANCER and MEDIA_SUPPLIER POs are auto-raised by Cloud
 * Functions when their upstream invoices land. This form covers the
 * remaining bucket: print runs, props, catering, ad-hoc vendor spend
 * that doesn't flow through the talent/media invoice path.
 *
 * Rules enforce: only admin can write, only kind=VENDOR_OTHER.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import { createManualPurchaseOrder } from '../services/purchase-order.service';
import type { CurrencyCode } from '../types/purchase-order.types';

const DEFAULT_ORG_ID = 'default';
const CURRENCIES: CurrencyCode[] = ['UGX', 'USD', 'KES', 'EUR', 'GBP'];

export default function PurchaseOrderCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [supplierOrgId, setSupplierOrgId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('UGX');
  const [masterJobId, setMasterJobId] = useState('');
  const [sourceInvoiceId, setSourceInvoiceId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!masterJobId.trim()) return setError('Master Job ID is required');
    const amountNum = parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) return setError('Amount must be a positive number');

    setBusy(true);
    try {
      const po = await createManualPurchaseOrder({
        orgId,
        supplierOrgId: supplierOrgId.trim() || undefined,
        amountMinor: Math.round(amountNum * 100),
        currency,
        masterJobId: masterJobId.trim(),
        sourceInvoiceId: sourceInvoiceId.trim() || undefined,
        notes: notes.trim() || undefined,
        raisedBy: user?.uid || 'unknown',
      });
      navigate(`/procurement/purchase-orders/${po.id}`);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 'var(--pad-page)', maxWidth: 720, margin: '0 auto' }} className="space-y-6">
      <header className="zeus-page-head">
        <Link to="/procurement/purchase-orders" className="zeus-back-link">
          ← Purchase orders
        </Link>
        <div className="zeus-page-head-row">
          <div className="zeus-page-head-title">
            <h1>New manual purchase order</h1>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-tertiary)' }}>
          VENDOR_OTHER only — for one-off vendor spend that doesn't come through
          the talent or media supplier invoice flow. Admin only.
        </p>
      </header>

      {error && <div className="zeus-note danger">{error}</div>}

      <section className="zeus-panel">
        <div className="zeus-panel-pad">
          <div className="zeus-form-grid">
            <label>
              <span className="zeus-field-label">Supplier org id</span>
              <input
                value={supplierOrgId}
                onChange={e => setSupplierOrgId(e.target.value)}
                className="zeus-input"
                placeholder="(optional)"
              />
            </label>

            <label>
              <span className="zeus-field-label">Master Job ID *</span>
              <input
                value={masterJobId}
                onChange={e => setMasterJobId(e.target.value)}
                className="zeus-input"
                placeholder="mj_..."
                data-testid="po-master-job"
              />
            </label>

            <label>
              <span className="zeus-field-label">Amount * (major units)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="zeus-input"
                placeholder="e.g. 2500000"
                data-testid="po-amount"
                autoFocus
              />
            </label>

            <label>
              <span className="zeus-field-label">Currency *</span>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as CurrencyCode)}
                className="zeus-select"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label className="full">
              <span className="zeus-field-label">Source invoice / ref</span>
              <input
                value={sourceInvoiceId}
                onChange={e => setSourceInvoiceId(e.target.value)}
                className="zeus-input"
                placeholder="Supplier invoice number or external reference (optional)"
              />
            </label>

            <label className="full">
              <span className="zeus-field-label">Notes</span>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="zeus-textarea"
                placeholder="What is this for? (e.g. Diageo Q3 TVC — props supplier)"
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              onClick={handleCreate}
              disabled={busy}
              className="btn btn-primary"
              data-testid="po-create-btn"
            >
              {busy ? 'Creating…' : 'Create PO'}
            </button>
            <Link to="/procurement/purchase-orders" className="zeus-outline-btn">Cancel</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
