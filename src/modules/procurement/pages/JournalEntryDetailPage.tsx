/**
 * /procurement/journal-entries/:jeId — Detail view for a single journal
 * entry with full debit/credit breakdown and source linkage.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getJournalEntry, isBalanced } from '../services/journal-entry.service';
import type { JournalEntry } from '../types/journal-entry.types';

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

export default function JournalEntryDetailPage() {
  const { jeId } = useParams<{ jeId: string }>();
  const [je, setJe] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jeId) return;
    setLoading(true);
    setError(null);
    getJournalEntry(jeId)
      .then(setJe)
      .catch((err) => setError(String((err as Error).message)))
      .finally(() => setLoading(false));
  }, [jeId]);

  if (loading) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading journal entry…</p>;
  if (error) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--rag-red)' }}>Error: {error}</p>;
  if (!je) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Journal entry not found.</p>;

  const totalDebits = je.debits.reduce((sum, line) => sum + line.amountMinor, 0);
  const totalCredits = je.credits.reduce((sum, line) => sum + line.amountMinor, 0);
  const balanced = isBalanced(je);
  const isFromPO = je.sourceDocKind === 'PurchaseOrderRaised';

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-6">
      <header className="zeus-page-head">
        <Link to="/procurement/journal-entries" className="zeus-back-link">
          ← All journal entries
        </Link>
        <div className="zeus-page-head-row">
          <div className="zeus-page-head-title">
            <h1 className="mono" data-testid="je-id">{je.id}</h1>
            <span className={`zeus-state-pill ${balanced ? 'green' : 'red'}`}>
              {balanced ? 'Balanced' : 'Unbalanced'}
            </span>
          </div>
        </div>
      </header>

      <section className="zeus-panel">
        <div className="zeus-panel-head">
          <h2>Posting metadata</h2>
        </div>
        <div className="zeus-panel-pad">
          <div className="zeus-def-grid">
            <div className="zeus-def">
              <span className="zeus-def-label">Kind</span>
              <span className="zeus-def-value">{je.kind}</span>
            </div>
            <div className="zeus-def">
              <span className="zeus-def-label">Currency</span>
              <span className="zeus-def-value">{je.currency}</span>
            </div>
            <div className="zeus-def">
              <span className="zeus-def-label">Posted at</span>
              <span className="zeus-def-value">{formatDate(je.postedAt)}</span>
            </div>
            <div className="zeus-def">
              <span className="zeus-def-label">Source kind</span>
              <span className="zeus-def-value">{je.sourceDocKind}</span>
            </div>
            <div className="zeus-def">
              <span className="zeus-def-label">Source ID</span>
              <span className="zeus-def-value mono">
                {isFromPO ? (
                  <Link
                    to={`/procurement/purchase-orders/${je.sourceDocId}`}
                    className="hover:underline"
                    data-testid="je-source-po-link"
                  >
                    {je.sourceDocId}
                  </Link>
                ) : (
                  je.sourceDocId
                )}
              </span>
            </div>
            <div className="zeus-def">
              <span className="zeus-def-label">Idempotency key</span>
              <span className="zeus-def-value mono">{je.idempotencyKey || '—'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="zeus-panel" data-testid="je-lines-section">
        <div className="zeus-panel-head">
          <h2>Double-entry breakdown</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="zeus-ledger">
            <thead>
              <tr>
                <th>Account</th>
                <th>Description</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
              </tr>
            </thead>
            <tbody>
              {je.debits.map((line, i) => (
                <tr key={`debit-${i}`}>
                  <td>
                    <span className="acct-code">{line.accountCode}</span>
                    <span>{line.accountName}</span>
                  </td>
                  <td className="dim">{line.description}</td>
                  <td className="num">{formatMoney(line.amountMinor, je.currency)}</td>
                  <td className="num dim">—</td>
                </tr>
              ))}
              {je.credits.map((line, i) => (
                <tr key={`credit-${i}`}>
                  <td>
                    <span className="acct-code">{line.accountCode}</span>
                    <span>{line.accountName}</span>
                  </td>
                  <td className="dim">{line.description}</td>
                  <td className="num dim">—</td>
                  <td className="num">{formatMoney(line.amountMinor, je.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="num" data-testid="debit-total">
                  {formatMoney(totalDebits, je.currency)}
                </td>
                <td className="num" data-testid="credit-total">
                  {formatMoney(totalCredits, je.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
