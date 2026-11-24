/**
 * RoleProfilesListPage — Phase 6.UI.A (PR 6).
 *
 * Lists every role profile with a filter by brand + status.
 * "New role profile" opens an inline `RoleProfileForm` (create mode).
 * Clicking a row navigates to the detail page where the same form
 * lands in edit mode.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Briefcase } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import type { RoleProfile } from '@/modules/hr-central/role-profiles/types';
import { subscribeRoleProfiles } from '../services/role-profile.service';
import { RoleProfileForm } from '../components/RoleProfileForm';
import { PageHero } from '@/shared/components/refresh';

const STATUS_TONE: Record<RoleProfile['status'], 'green' | 'amber' | 'red' | ''> = {
  draft: '',
  active: 'green',
  archived: '',
};

export default function RoleProfilesListPage() {
  const [rows, setRows] = useState<RoleProfile[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeRoleProfiles(setRows, (e) =>
      setErr(`Role profiles subscription failed: ${e.message}`),
    );
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (brandFilter && r.brandId !== brandFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, brandFilter, statusFilter]);

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-4" data-testid="role-profiles-list-page">
      <PageHero
        eyebrow="Operations · HR Central"
        title="Role profiles"
        body="Typed contracts describing what a holder can do, approve, and absorb in workload (Addendum v1.2 §2.1)."
        actions={
          !showCreate ? (
            <Button size="sm" data-testid="open-create-role-profile" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              New role profile
            </Button>
          ) : undefined
        }
      />

      {err && (
        <div role="alert" data-testid="role-profiles-error" className="zeus-note danger">
          {err}
        </div>
      )}

      {showCreate && (
        <section className="zeus-panel" data-testid="role-profile-create">
          <div className="zeus-panel-head">
            <h2>New role profile</h2>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
          <div className="zeus-panel-pad">
            <RoleProfileForm onSaved={() => setShowCreate(false)} />
          </div>
        </section>
      )}

      <div className="zeus-filter-bar">
        <label className="block">
          <span className="zeus-field-label">Brand</span>
          <select
            data-testid="rp-brand-filter"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="zeus-select"
          >
            <option value="">All brands</option>
            <option value="zeus-the-agency">Zeus The Agency</option>
            <option value="zeus-digital">Zeus Digital</option>
            <option value="labyrinth">Labyrinth</option>
            <option value="odd-gorilla">Odd Gorilla</option>
            <option value="house-of-zeus">House of Zeus</option>
            <option value="all">All-brand roles</option>
          </select>
        </label>
        <label className="block">
          <span className="zeus-field-label">Status</span>
          <select
            data-testid="rp-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="zeus-select"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div
          data-testid="role-profiles-empty"
          className="zeus-panel zeus-panel-empty"
        >
          {rows.length === 0
            ? 'No role profiles yet. Create the first one to start declaring capabilities + assignments.'
            : 'No role profiles match the current filters.'}
        </div>
      ) : (
        <div className="zeus-panel">
          <ul className="zeus-row-list">
            {filtered.map((r) => {
              const tone = STATUS_TONE[r.status];
              return (
                <li key={r.id} className="zeus-row" style={{ gridTemplateColumns: '28px 1fr auto auto', padding: 0 }}>
                  <Link
                    to={`/hr/role-profiles/${encodeURIComponent(r.id)}`}
                    data-testid={`role-profile-row-${r.id}`}
                    style={{
                      display: 'contents',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <span style={{ padding: '12px 0 12px 18px', display: 'inline-flex', alignItems: 'center' }}>
                      <Briefcase className="h-3.5 w-3.5" style={{ color: 'var(--fg-tertiary)' }} aria-hidden="true" />
                    </span>
                    <span style={{ padding: '12px 0', minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600, color: 'var(--fg-primary)', fontSize: 13 }}>
                        {r.title}
                      </span>
                      <span className="zeus-row-sub" style={{ marginTop: 2 }}>
                        {r.brandId} · {r.departmentId} · {r.jobLevel}
                      </span>
                    </span>
                    <span style={{ padding: '12px 10px', display: 'inline-flex', alignItems: 'center' }}>
                      <span className={`zeus-state-pill ${tone}`}>{r.status}</span>
                    </span>
                    <code
                      style={{
                        padding: '12px 18px 12px 0',
                        fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)',
                        fontSize: 10.5,
                        color: 'var(--fg-tertiary)',
                        whiteSpace: 'nowrap',
                      }}
                      className="hidden md:inline"
                    >
                      {r.id}
                    </code>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
