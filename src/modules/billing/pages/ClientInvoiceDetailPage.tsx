/**
 * /billing/client-invoices/:invoiceId — detail view with the
 * Issue / Record Payment CTAs called for in the task spec.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getClientInvoice,
  issueClientInvoice,
  recordClientPayment,
} from '../services/client-invoice.service';
import type { ClientInvoice } from '../types/client-invoice.types';
import { CLIENT_INVOICE_STATUS_LABEL } from '../constants/statuses';
import { toClientFacingInvoice } from '../services/client-friendly';
import { InvoicePDFPreview } from '../components/InvoicePDFPreview';

export function ClientInvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<ClientInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  function refresh() {
    if (!invoiceId) return;
    setLoading(true);
    getClientInvoice(invoiceId)
      .then(setInvoice)
      .catch((err) => setError(String(err?.message ?? err)))
      .finally(() => setLoading(false));
  }

  if (!invoiceId) return <div style={{ padding: 'var(--pad-page)', fontSize: 13 }}>Missing invoice ID.</div>;
  if (loading) return <div style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading…</div>;
  if (error) return <div style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--rag-red)' }}>{error}</div>;
  if (!invoice) return <div style={{ padding: 'var(--pad-page)', fontSize: 13 }}>Invoice not found.</div>;

  const clientFacing = toClientFacingInvoice(invoice);

  async function onIssue() {
    if (!invoiceId) return;
    setActionInFlight('issue');
    try {
      await issueClientInvoice(invoiceId);
      refresh();
    } catch (err) {
      alert(`Failed to issue: ${String(err)}`);
    } finally {
      setActionInFlight(null);
    }
  }

  async function onRecordPayment() {
    if (!invoiceId || !invoice) return;
    const amountStr = window.prompt('Payment amount (in minor units):');
    if (!amountStr) return;
    const paymentRef = window.prompt('Payment reference:');
    if (!paymentRef) return;
    setActionInFlight('payment');
    try {
      await recordClientPayment(invoiceId, {
        amountMinor: Number(amountStr),
        paymentRef,
      });
      refresh();
    } catch (err) {
      alert(`Failed to record payment: ${String(err)}`);
    } finally {
      setActionInFlight(null);
    }
  }

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-6">
      <header className="zeus-page-head">
        <Link to="/billing/client-invoices" className="zeus-back-link">
          ← All client invoices
        </Link>
        <div className="zeus-page-head-row">
          <div className="zeus-page-head-title">
            <h1 className="mono">{invoice.id}</h1>
            <span className="zeus-state-pill">{CLIENT_INVOICE_STATUS_LABEL[invoice.status]}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ font: '600 10.5px var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-tertiary)' }}>
              Invoice total
            </div>
            <div className="mono tabular" style={{ font: '600 18px var(--font-sans)', color: 'var(--fg-primary)' }}>
              {invoice.total.currency} {(invoice.total.amountMinor / 100).toLocaleString()}
            </div>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-tertiary)' }}>
          Master job <span className="mono">{invoice.masterJobId}</span> · Client{' '}
          <span className="mono">{invoice.clientId}</span>
        </p>
      </header>

      {(invoice.status === 'DRAFT' ||
        invoice.status === 'ISSUED' ||
        invoice.status === 'PART_PAID') && (
        <div style={{ display: 'flex', gap: 8 }}>
          {invoice.status === 'DRAFT' && (
            <button
              onClick={onIssue}
              disabled={actionInFlight === 'issue'}
              className="btn btn-primary"
            >
              {actionInFlight === 'issue' ? 'Issuing…' : 'Issue invoice'}
            </button>
          )}
          {(invoice.status === 'ISSUED' || invoice.status === 'PART_PAID') && (
            <button
              onClick={onRecordPayment}
              disabled={actionInFlight === 'payment'}
              className="btn btn-primary"
            >
              {actionInFlight === 'payment' ? 'Recording…' : 'Record payment'}
            </button>
          )}
        </div>
      )}

      <section className="zeus-panel">
        <div className="zeus-panel-head">
          <h2>Internal view (AM / Finance)</h2>
          <span className="zeus-panel-head-meta">{invoice.lines.length} line{invoice.lines.length === 1 ? '' : 's'}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="zeus-ledger">
            <thead>
              <tr>
                <th>Description</th>
                <th>Source subsidiary</th>
                <th className="num">Cost (minor)</th>
                <th className="num">Charge (minor)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.description}</td>
                  <td className="dim" style={{ fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)', fontSize: 12 }}>
                    {line.sourceSubsidiaryId}
                  </td>
                  <td className="num" style={{ fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)' }}>
                    {line.costMinor}
                  </td>
                  <td className="num" style={{ fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)' }}>
                    {line.amountMinor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="zeus-panel">
        <div className="zeus-panel-head">
          <h2>Client-facing preview</h2>
        </div>
        <div className="zeus-panel-pad">
          <InvoicePDFPreview invoice={clientFacing} />
        </div>
      </section>
    </div>
  );
}

export default ClientInvoiceDetailPage;
