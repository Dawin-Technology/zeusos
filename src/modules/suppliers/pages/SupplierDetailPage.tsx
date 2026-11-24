/**
 * /suppliers/:supplierId — detail view with status actions
 * (activate / deactivate / blacklist).
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import {
  getSupplier,
  activateSupplier,
  deactivateSupplier,
  blacklistSupplier,
} from '../services/supplier.service';
import type { Supplier } from '../types/supplier.types';
import { SupplierKindBadge } from '../components/SupplierKindBadge';
import { SupplierStatusBadge } from '../components/SupplierStatusBadge';

function formatDate(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'string') return value.slice(0, 10);
  const ts = value as { seconds?: number; toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 10);
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
  return '—';
}

export default function SupplierDetailPage() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const { user } = useAuth();
  const userId = user?.uid ?? 'unknown-user';

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  async function reload() {
    if (!supplierId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getSupplier(supplierId);
      setSupplier(result);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [supplierId]);

  async function handleDeactivate() {
    if (!supplierId) return;
    if (!confirm('Deactivate this supplier? They will be hidden from default lists.')) return;
    setActionPending(true);
    try {
      await deactivateSupplier(supplierId);
      await reload();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setActionPending(false);
    }
  }

  async function handleActivate() {
    if (!supplierId) return;
    setActionPending(true);
    try {
      await activateSupplier(supplierId);
      await reload();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setActionPending(false);
    }
  }

  async function handleBlacklist() {
    if (!supplierId) return;
    const reason = prompt('Reason for blacklisting? (required for audit log)');
    if (!reason || !reason.trim()) return;
    setActionPending(true);
    try {
      await blacklistSupplier(supplierId, userId, reason);
      await reload();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setActionPending(false);
    }
  }

  if (loading) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading supplier…</p>;
  if (error) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--rag-red)' }}>Error: {error}</p>;
  if (!supplier) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Supplier not found.</p>;

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-6">
      <header className="zeus-page-head">
        <Link to="/suppliers" className="zeus-back-link">
          ← All suppliers
        </Link>
        <div className="zeus-page-head-row">
          <div className="zeus-page-head-title">
            <h1 data-testid="supplier-name">{supplier.name}</h1>
            <SupplierKindBadge kind={supplier.kind} />
            <SupplierStatusBadge status={supplier.status} />
          </div>
          <div className="zeus-page-head-actions">
            <Link
              to={`/suppliers/${supplier.id}/edit`}
              className="zeus-outline-btn"
              data-testid="supplier-edit"
            >
              Edit
            </Link>
            {supplier.status === 'ACTIVE' && (
              <button
                onClick={handleDeactivate}
                disabled={actionPending}
                className="zeus-outline-btn"
              >
                Deactivate
              </button>
            )}
            {supplier.status === 'INACTIVE' && (
              <button
                onClick={handleActivate}
                disabled={actionPending}
                className="zeus-outline-btn"
              >
                Reactivate
              </button>
            )}
            {supplier.status !== 'BLACKLISTED' && (
              <button
                onClick={handleBlacklist}
                disabled={actionPending}
                className="zeus-outline-btn danger"
              >
                Blacklist…
              </button>
            )}
            {supplier.status === 'BLACKLISTED' && (
              <button
                onClick={handleActivate}
                disabled={actionPending}
                className="zeus-outline-btn danger"
              >
                Lift blacklist
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="zeus-panel">
        <div className="zeus-panel-head">
          <h2>Profile</h2>
        </div>
        <div className="zeus-panel-pad">
          <div className="zeus-def-grid">
            <div className="zeus-def">
              <span className="zeus-def-label">Country</span>
              <span className="zeus-def-value">{supplier.countryCode ?? '—'}</span>
            </div>
            <div className="zeus-def">
              <span className="zeus-def-label">Currency</span>
              <span className="zeus-def-value">{supplier.currency}</span>
            </div>
            <div className="zeus-def">
              <span className="zeus-def-label">Payment terms</span>
              <span className="zeus-def-value">{supplier.paymentTerms}</span>
            </div>
            <div className="zeus-def">
              <span className="zeus-def-label">Tax ID</span>
              <span className="zeus-def-value mono">{supplier.taxId ?? '—'}</span>
            </div>
            <div className="zeus-def">
              <span className="zeus-def-label">Created</span>
              <span className="zeus-def-value">{formatDate(supplier.createdAt)}</span>
            </div>
          </div>
        </div>
      </section>

      {supplier.primaryContact && (
        <section className="zeus-panel">
          <div className="zeus-panel-head">
            <h2>Primary contact</h2>
          </div>
          <div className="zeus-panel-pad">
            <div className="zeus-def-grid">
              <div className="zeus-def">
                <span className="zeus-def-label">Name</span>
                <span className="zeus-def-value">{supplier.primaryContact.name}</span>
              </div>
              {supplier.primaryContact.role && (
                <div className="zeus-def">
                  <span className="zeus-def-label">Role</span>
                  <span className="zeus-def-value">{supplier.primaryContact.role}</span>
                </div>
              )}
              {supplier.primaryContact.email && (
                <div className="zeus-def">
                  <span className="zeus-def-label">Email</span>
                  <span className="zeus-def-value">
                    <a href={`mailto:${supplier.primaryContact.email}`} className="hover:underline" style={{ color: 'var(--fg-primary)' }}>
                      {supplier.primaryContact.email}
                    </a>
                  </span>
                </div>
              )}
              {supplier.primaryContact.phone && (
                <div className="zeus-def">
                  <span className="zeus-def-label">Phone</span>
                  <span className="zeus-def-value">{supplier.primaryContact.phone}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {supplier.address && (
        <section className="zeus-panel">
          <div className="zeus-panel-head">
            <h2>Address</h2>
          </div>
          <div className="zeus-panel-pad">
            <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-primary)', whiteSpace: 'pre-line' }}>{supplier.address}</p>
          </div>
        </section>
      )}

      {supplier.notes && (
        <section className="zeus-panel">
          <div className="zeus-panel-head">
            <h2>Notes</h2>
          </div>
          <div className="zeus-panel-pad">
            <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-primary)', whiteSpace: 'pre-line' }}>{supplier.notes}</p>
          </div>
        </section>
      )}

      {supplier.tags && supplier.tags.length > 0 && (
        <section className="zeus-panel">
          <div className="zeus-panel-head">
            <h2>Tags</h2>
          </div>
          <div className="zeus-panel-pad" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {supplier.tags.map((t) => (
              <span key={t} className="zeus-state-pill">{t}</span>
            ))}
          </div>
        </section>
      )}

      {supplier.status === 'BLACKLISTED' && supplier.blacklistReason && (
        <section className="zeus-panel" style={{ background: 'var(--rag-red-soft)', borderColor: 'color-mix(in oklab, var(--rag-red) 30%, transparent)' }}>
          <div className="zeus-panel-pad">
            <h2 style={{ margin: '0 0 6px', font: '600 14px var(--font-sans)', color: 'var(--rag-red-deep, var(--rag-red))' }}>Blacklisted</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--rag-red-deep, var(--rag-red))' }}>{supplier.blacklistReason}</p>
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--rag-red-deep, var(--rag-red))' }}>
              on {formatDate(supplier.blacklistedAt)} by {supplier.blacklistedBy}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
