/**
 * /suppliers/new — create a new supplier directory entry.
 */

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import { createSupplier } from '../services/supplier.service';
import { SupplierForm, type SupplierFormValues } from '../components/SupplierForm';

export default function SupplierCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid ?? 'unknown-user';

  async function handleSave(values: SupplierFormValues) {
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

    const created = await createSupplier({
      name: values.name,
      kind: values.kind,
      currency: values.currency,
      paymentTerms: values.paymentTerms,
      ...(values.countryCode.trim() && { countryCode: values.countryCode.trim() }),
      ...(values.taxId.trim() && { taxId: values.taxId.trim() }),
      ...(values.address.trim() && { address: values.address.trim() }),
      ...(values.notes.trim() && { notes: values.notes.trim() }),
      ...(tags.length > 0 && { tags }),
      ...(primaryContact && { primaryContact }),
      createdBy: userId,
    });

    navigate(`/suppliers/${created.id}`);
  }

  return (
    <div style={{ padding: 'var(--pad-page)', maxWidth: 820, margin: '0 auto' }} className="space-y-6">
      <header className="zeus-page-head">
        <Link to="/suppliers" className="zeus-back-link">
          ← All suppliers
        </Link>
        <div className="zeus-page-head-row">
          <div className="zeus-page-head-title">
            <h1>New supplier</h1>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-tertiary)' }}>
          Add an external supplier to the shared directory.
        </p>
      </header>

      <SupplierForm
        submitLabel="Create supplier"
        onSave={handleSave}
        onCancel={() => navigate('/suppliers')}
      />
    </div>
  );
}
