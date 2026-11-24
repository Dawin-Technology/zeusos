/**
 * /media/new — create a new media plan header.
 *
 * The plan starts in DRAFT and accepts media_buys via the detail page.
 * Subsidiary-org defaults to the user's home subsidiary; an Account Manager
 * can override at create time.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import { createMediaPlan } from '../services/media-plan.service';
import type { MediaPlan, CurrencyCode } from '../types/media-plan.types';
import { SUBSIDIARY_IDS } from '@/core/settings/types';

const CURRENCIES: CurrencyCode[] = ['UGX', 'USD', 'KES'];

export default function MediaPlanCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [masterJobId, setMasterJobId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [subsidiaryOrgId, setSubsidiaryOrgId] = useState<string>('zeus-the-agency');
  const [currency, setCurrency] = useState<CurrencyCode>('UGX');
  const [totalBudget, setTotalBudget] = useState('');
  const [flightStartDate, setFlightStartDate] = useState('');
  const [flightEndDate, setFlightEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!title.trim()) return setError('Title is required');
    if (!masterJobId.trim()) return setError('Master Job ID is required');
    const budgetNum = parseFloat(totalBudget);
    if (Number.isNaN(budgetNum) || budgetNum < 0) return setError('Total budget must be a non-negative number');

    setBusy(true);
    try {
      const plan: Omit<MediaPlan, 'id' | 'createdAt' | 'updatedAt'> = {
        title: title.trim(),
        masterJobId: masterJobId.trim(),
        campaignId: campaignId.trim() || undefined,
        subsidiaryOrgId,
        status: 'DRAFT',
        currency,
        totalBudgetMinor: Math.round(budgetNum * 100),
        flightStartDate: flightStartDate || undefined,
        flightEndDate: flightEndDate || undefined,
        notes: notes.trim() || undefined,
        createdBy: user?.uid || 'unknown',
      };
      const created = await createMediaPlan(plan);
      navigate(`/media/${created.id}`);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-4 mx-auto max-w-2xl">
      <div className="zeus-page-head">
        <Link to="/media" className="zeus-back-link">← Media Plans</Link>
        <div className="zeus-page-head-row">
          <div className="zeus-page-head-title">
            <h1>New media plan</h1>
          </div>
        </div>
      </div>

      {error && <div className="zeus-note danger">{error}</div>}

      <div className="zeus-form-grid">
        <label className="full">
          <span className="zeus-field-label">Title *</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="zeus-input"
            placeholder="e.g. Q3 2026 OOH + Digital"
            autoFocus
            data-testid="media-plan-title"
          />
        </label>

        <label>
          <span className="zeus-field-label">Master Job ID *</span>
          <input
            value={masterJobId}
            onChange={e => setMasterJobId(e.target.value)}
            className="zeus-input"
            style={{ fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)', fontSize: 12 }}
            placeholder="mj_..."
            data-testid="media-plan-master-job"
          />
        </label>

        <label>
          <span className="zeus-field-label">Campaign ID</span>
          <input
            value={campaignId}
            onChange={e => setCampaignId(e.target.value)}
            className="zeus-input"
            style={{ fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)', fontSize: 12 }}
            placeholder="(optional)"
          />
        </label>

        <label>
          <span className="zeus-field-label">Subsidiary *</span>
          <select
            value={subsidiaryOrgId}
            onChange={e => setSubsidiaryOrgId(e.target.value)}
            className="zeus-select"
          >
            {SUBSIDIARY_IDS.filter(id => id !== 'zeus-group').map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
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
          <span className="zeus-field-label">Total budget * (major units)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={totalBudget}
            onChange={e => setTotalBudget(e.target.value)}
            className="zeus-input"
            placeholder="e.g. 50000000"
            data-testid="media-plan-budget"
          />
        </label>

        <label>
          <span className="zeus-field-label">Flight start</span>
          <input
            type="date"
            value={flightStartDate}
            onChange={e => setFlightStartDate(e.target.value)}
            className="zeus-input"
          />
        </label>

        <label>
          <span className="zeus-field-label">Flight end</span>
          <input
            type="date"
            value={flightEndDate}
            onChange={e => setFlightEndDate(e.target.value)}
            className="zeus-input"
          />
        </label>

        <label className="full">
          <span className="zeus-field-label">Notes</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="zeus-textarea"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={busy}
          className="btn btn-primary"
          data-testid="media-plan-create-btn"
        >
          {busy ? 'Creating…' : 'Create plan'}
        </button>
        <Link to="/media" className="btn btn-secondary">Cancel</Link>
      </div>
    </div>
  );
}
