/**
 * SupplierForm — shared create/edit form for a supplier directory entry.
 */

import { useState } from 'react';
import type {
  Supplier,
  SupplierKind,
  PaymentTerms,
  CurrencyCode,
} from '../types/supplier.types';

const KIND_OPTIONS: SupplierKind[] = [
  'MEDIA_HOUSE',
  'TALENT_AGENCY',
  'PRODUCTION_HOUSE',
  'PRINT_SHOP',
  'TECH_VENDOR',
  'VENDOR_OTHER',
];

const PAYMENT_TERMS: PaymentTerms[] = [
  'ON_RECEIPT',
  'NET_15',
  'NET_30',
  'NET_60',
  'NET_90',
  'PREPAID',
];

const CURRENCIES: CurrencyCode[] = ['UGX', 'USD', 'KES', 'EUR', 'GBP'];

export type SupplierFormValues = {
  name: string;
  kind: SupplierKind;
  currency: CurrencyCode;
  paymentTerms: PaymentTerms;
  countryCode: string;
  taxId: string;
  address: string;
  notes: string;
  tagsCsv: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
};

interface Props {
  initial?: Partial<Supplier>;
  submitLabel: string;
  onSave: (values: SupplierFormValues) => Promise<void>;
  onCancel: () => void;
}

export function SupplierForm({ initial, submitLabel, onSave, onCancel }: Props) {
  const [values, setValues] = useState<SupplierFormValues>({
    name: initial?.name ?? '',
    kind: initial?.kind ?? 'MEDIA_HOUSE',
    currency: initial?.currency ?? 'UGX',
    paymentTerms: initial?.paymentTerms ?? 'NET_30',
    countryCode: initial?.countryCode ?? 'UG',
    taxId: initial?.taxId ?? '',
    address: initial?.address ?? '',
    notes: initial?.notes ?? '',
    tagsCsv: (initial?.tags ?? []).join(', '),
    contactName: initial?.primaryContact?.name ?? '',
    contactRole: initial?.primaryContact?.role ?? '',
    contactEmail: initial?.primaryContact?.email ?? '',
    contactPhone: initial?.primaryContact?.phone ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof SupplierFormValues>(key: K, val: SupplierFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(values);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="zeus-panel" data-testid="supplier-form">
      <div className="zeus-panel-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label>
          <span className="zeus-field-label">Supplier name *</span>
          <input
            required
            value={values.name}
            onChange={(e) => update('name', e.target.value)}
            className="zeus-input"
            placeholder="Next Media Services Ltd"
            data-testid="supplier-name-input"
          />
        </label>

        <div className="zeus-form-grid">
          <label>
            <span className="zeus-field-label">Kind *</span>
            <select
              value={values.kind}
              onChange={(e) => update('kind', e.target.value as SupplierKind)}
              className="zeus-select"
              data-testid="supplier-kind-input"
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="zeus-field-label">Country (ISO)</span>
            <input
              value={values.countryCode}
              onChange={(e) => update('countryCode', e.target.value.toUpperCase().slice(0, 2))}
              className="zeus-input"
              style={{ textTransform: 'uppercase' }}
              maxLength={2}
              placeholder="UG"
            />
          </label>
          <label>
            <span className="zeus-field-label">Currency *</span>
            <select
              value={values.currency}
              onChange={(e) => update('currency', e.target.value as CurrencyCode)}
              className="zeus-select"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <span className="zeus-field-label">Payment terms *</span>
            <select
              value={values.paymentTerms}
              onChange={(e) => update('paymentTerms', e.target.value as PaymentTerms)}
              className="zeus-select"
            >
              {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>

        <label>
          <span className="zeus-field-label">Tax ID / TIN</span>
          <input
            value={values.taxId}
            onChange={(e) => update('taxId', e.target.value)}
            className="zeus-input"
          />
        </label>

        <fieldset
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: '14px 16px',
            margin: 0,
          }}
        >
          <legend
            style={{
              padding: '0 6px',
              font: '600 10.5px var(--font-mono)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--fg-tertiary)',
            }}
          >
            Primary contact
          </legend>
          <div className="zeus-form-grid" style={{ marginTop: 6 }}>
            <input
              value={values.contactName}
              onChange={(e) => update('contactName', e.target.value)}
              className="zeus-input"
              placeholder="Name"
            />
            <input
              value={values.contactRole}
              onChange={(e) => update('contactRole', e.target.value)}
              className="zeus-input"
              placeholder="Role"
            />
            <input
              type="email"
              value={values.contactEmail}
              onChange={(e) => update('contactEmail', e.target.value)}
              className="zeus-input"
              placeholder="email@supplier.tld"
            />
            <input
              value={values.contactPhone}
              onChange={(e) => update('contactPhone', e.target.value)}
              className="zeus-input"
              placeholder="+256 …"
            />
          </div>
        </fieldset>

        <label>
          <span className="zeus-field-label">Address</span>
          <textarea
            value={values.address}
            onChange={(e) => update('address', e.target.value)}
            rows={2}
            className="zeus-textarea"
          />
        </label>

        <label>
          <span className="zeus-field-label">Notes</span>
          <textarea
            value={values.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={2}
            className="zeus-textarea"
            placeholder="Risks, capacity, preferred slots…"
          />
        </label>

        <label>
          <span className="zeus-field-label">Tags (comma-separated)</span>
          <input
            value={values.tagsCsv}
            onChange={(e) => update('tagsCsv', e.target.value)}
            className="zeus-input"
            placeholder="radio, luganda, northern-uganda"
          />
        </label>

        {error && <div className="zeus-note danger" data-testid="supplier-form-error">{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel} className="zeus-outline-btn">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            data-testid="supplier-submit"
          >
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
