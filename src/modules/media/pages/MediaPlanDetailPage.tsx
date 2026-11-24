/**
 * /media/:planId — buy grid with planned/booked/actual columns and add-buy slide-over.
 */

import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getMediaPlan,
  listMediaBuys,
  addMediaBuy,
  updateMediaBuy,
  updateMediaPlan,
  deleteMediaPlan,
} from '../services/media-plan.service';
import type { MediaPlan, MediaPlanStatus, CurrencyCode } from '../types/media-plan.types';
import type { MediaBuy } from '../types/media-buy.types';
import { MediaPlanStatusBadge } from '../components/MediaPlanStatusBadge';
import { MediaBuyGrid } from '../components/MediaBuyGrid';
import { MediaBuyForm } from '../components/MediaBuyForm';

const CURRENCIES: CurrencyCode[] = ['UGX', 'USD', 'KES'];
const STATUSES: MediaPlanStatus[] = ['DRAFT', 'ACTIVE', 'CLOSED'];

export default function MediaPlanDetailPage() {
  const navigate = useNavigate();
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<MediaPlan | null>(null);
  const [buys, setBuys] = useState<MediaBuy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBuy, setEditingBuy] = useState<MediaBuy | undefined>();
  const [editingPlan, setEditingPlan] = useState(false);
  const [draft, setDraft] = useState<Partial<MediaPlan>>({});
  const [savingPlan, setSavingPlan] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    if (!planId) return;
    try {
      const [p, b] = await Promise.all([getMediaPlan(planId), listMediaBuys(planId)]);
      setPlan(p);
      setBuys(b);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [planId]);

  async function handleSaveBuy(values: Omit<MediaBuy, 'id' | 'planId' | 'actualMinor' | 'createdAt' | 'updatedAt'>) {
    if (!planId) return;
    if (editingBuy) {
      await updateMediaBuy(planId, editingBuy.id, values);
    } else {
      await addMediaBuy(planId, values);
    }
    await reload();
  }

  async function handleSavePlan() {
    if (!planId || !plan) return;
    setSavingPlan(true);
    try {
      const updates: Partial<MediaPlan> = {
        title: draft.title ?? plan.title,
        status: (draft.status ?? plan.status) as MediaPlanStatus,
        currency: (draft.currency ?? plan.currency) as CurrencyCode,
        totalBudgetMinor: draft.totalBudgetMinor ?? plan.totalBudgetMinor,
        flightStartDate: draft.flightStartDate ?? plan.flightStartDate,
        flightEndDate: draft.flightEndDate ?? plan.flightEndDate,
        notes: draft.notes ?? plan.notes,
      };
      await updateMediaPlan(planId, updates);
      await reload();
      setEditingPlan(false);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleDelete() {
    if (!planId || !plan) return;
    const ok = window.confirm(
      `Delete media plan "${plan.title}"? This permanently removes the plan header. ` +
      `Existing buy rows under it will be orphaned — close the plan instead if work is in flight.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteMediaPlan(planId);
      navigate('/media');
    } catch (err) {
      setError(String((err as Error).message));
      setDeleting(false);
    }
  }

  if (loading) return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading…</p>;
  if (error && !plan) return <div style={{ padding: 'var(--pad-page)' }}><div className="zeus-note danger">Error: {error}</div></div>;
  if (!plan)   return <p style={{ padding: 'var(--pad-page)', fontSize: 13, color: 'var(--fg-tertiary)' }}>Plan not found.</p>;

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-5">
      <div className="zeus-page-head">
        <Link to="/media" className="zeus-back-link">← Media Plans</Link>
        <div className="zeus-page-head-row">
          <div className="zeus-page-head-title">
            <h1>{plan.title}</h1>
            <MediaPlanStatusBadge status={plan.status} />
          </div>
          <div className="zeus-page-head-actions">
            <Link to={`/media/${planId}/actuals`} className="zeus-outline-btn">
              Post Actuals
            </Link>
            {!editingPlan && (
              <button
                type="button"
                onClick={() => { setDraft(plan); setEditingPlan(true); }}
                className="zeus-outline-btn"
                data-testid="media-plan-edit-btn"
              >
                Edit Plan
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="zeus-outline-btn danger"
              data-testid="media-plan-delete-btn"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              onClick={() => { setEditingBuy(undefined); setShowForm(true); }}
              className="btn btn-primary"
            >
              Add Buy
            </button>
          </div>
        </div>
        <dl className="zeus-def-grid">
          <div className="zeus-def">
            <dt className="zeus-def-label">Master Job</dt>
            <dd className="zeus-def-value mono">{plan.masterJobId}</dd>
          </div>
          <div className="zeus-def">
            <dt className="zeus-def-label">Currency</dt>
            <dd className="zeus-def-value strong">{plan.currency}</dd>
          </div>
          <div className="zeus-def">
            <dt className="zeus-def-label">Total Budget</dt>
            <dd className="zeus-def-value strong">
              {plan.currency} {(plan.totalBudgetMinor / 100).toLocaleString()}
            </dd>
          </div>
          {(plan.flightStartDate || plan.flightEndDate) && (
            <div className="zeus-def">
              <dt className="zeus-def-label">Flight</dt>
              <dd className="zeus-def-value">
                {plan.flightStartDate ?? '—'} → {plan.flightEndDate ?? '—'}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {editingPlan && (
        <section className="zeus-panel">
          <div className="zeus-panel-head">
            <h3>Edit plan</h3>
          </div>
          <div className="zeus-panel-pad">
            <div className="zeus-form-grid">
              <label className="full">
                <span className="zeus-field-label">Title</span>
                <input
                  value={draft.title ?? ''}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  className="zeus-input"
                />
              </label>
              <label>
                <span className="zeus-field-label">Status</span>
                <select
                  value={(draft.status ?? plan.status) as string}
                  onChange={e => setDraft(d => ({ ...d, status: e.target.value as MediaPlanStatus }))}
                  className="zeus-select"
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>
                <span className="zeus-field-label">Currency</span>
                <select
                  value={(draft.currency ?? plan.currency) as string}
                  onChange={e => setDraft(d => ({ ...d, currency: e.target.value as CurrencyCode }))}
                  className="zeus-select"
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="full">
                <span className="zeus-field-label">Total budget (major units)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={((draft.totalBudgetMinor ?? plan.totalBudgetMinor) / 100).toString()}
                  onChange={e => setDraft(d => ({ ...d, totalBudgetMinor: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                  className="zeus-input"
                />
              </label>
              <label>
                <span className="zeus-field-label">Flight start</span>
                <input
                  type="date"
                  value={draft.flightStartDate ?? plan.flightStartDate ?? ''}
                  onChange={e => setDraft(d => ({ ...d, flightStartDate: e.target.value }))}
                  className="zeus-input"
                />
              </label>
              <label>
                <span className="zeus-field-label">Flight end</span>
                <input
                  type="date"
                  value={draft.flightEndDate ?? plan.flightEndDate ?? ''}
                  onChange={e => setDraft(d => ({ ...d, flightEndDate: e.target.value }))}
                  className="zeus-input"
                />
              </label>
              <label className="full">
                <span className="zeus-field-label">Notes</span>
                <textarea
                  value={draft.notes ?? plan.notes ?? ''}
                  onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                  rows={3}
                  className="zeus-textarea"
                />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleSavePlan}
                disabled={savingPlan}
                className="btn btn-primary"
              >
                {savingPlan ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditingPlan(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      {error && plan && <div className="zeus-note danger">{error}</div>}

      <MediaBuyGrid
        buys={buys}
        currency={plan.currency}
        onEditBuy={(buy) => { setEditingBuy(buy); setShowForm(true); }}
      />

      <MediaBuyForm
        open={showForm}
        initial={editingBuy}
        onClose={() => { setShowForm(false); setEditingBuy(undefined); }}
        onSave={handleSaveBuy}
      />
    </div>
  );
}
