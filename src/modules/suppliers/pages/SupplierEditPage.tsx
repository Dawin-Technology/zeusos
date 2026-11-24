/**
 * /suppliers/:supplierId/edit — edit supplier profile (excluding status,
 * which has dedicated action buttons on the detail page).
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getSupplier, updateSupplier } from '../services/supplier.service';
import type { Supplier } from '../types/supplier.types';
import { SupplierForm, type SupplierFormValues } from '../components/SupplierForm';

export default function SupplierEditPage() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supplierId) return;
    getSupplier(supplierId)
      .then(setSupplier)
      .catch((err) => setError(String((err as Error).message)))
      .finally(() => setLoading(false));
  }, [supplierId]);

  async function handleSave(values: SupplierFormValues) {
    if (!supplierId) return;
    const tags = values.tagsCsv
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const primaryContact = values.contactName.trim()
      ? {
          name: values.contactName.trim(),
          ...(values.contactRole.trim() && { role: values.contactRole.trim() }),
          ...(values.contactEmail.trim() && { email: values.contactEmail.trim() }),
          ...(values.contactPhone.trim() && { phone: values.contactPhone.trim() }),
        }
      : undefined;

    await updateSupplier(supplierId, {
      name: values.name,
      kind: values.kind,
      currency: values.currency,
      paymentTerms: values.paymentTerms,
      countryCode: values.countryCode.trim() || undefined,
      taxId: values.taxId.trim() || undefined,
      address: values.address.trim() || undefined,
      notes: values.notes.trim() || undefined,
      tags,
      primaryContact,
    });

    navigate(`/suppliers/${supplierId}`);
  }

  if (loading) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading supplier…</p>;
  if (error) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--rag-red)' }}>Error: {error}</p>;
  if (!supplier) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Supplier not found.</p>;

  return (
    <div style={{ padding: 'var(--pad-page)', maxWidth: 820, margin: '0 auto' }} className="space-y-6">
      <header className="zeus-page-head">
        <Link to={`/suppliers/${supplier.id}`} className="zeus-back-link">
          ← Back to supplier
        </Link>
        <div className="zeus-page-head-row">
          <div className="zeus-page-head-title">
            <h1>Edit supplier</h1>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-tertiary)' }}>
          Update profile details. Status changes (activate/deactivate/blacklist) live on the detail page.
        </p>
      </header>

      <SupplierForm
        initial={supplier}
        submitLabel="Save changes"
        onSave={handleSave}
        onCancel={() => navigate(`/suppliers/${supplier.id}`)}
      />
    </div>
  );
}
