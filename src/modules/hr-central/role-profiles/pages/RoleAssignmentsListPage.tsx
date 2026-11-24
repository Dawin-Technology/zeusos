/**
 * RoleAssignmentsListPage — Phase 6.UI.A (PR 6).
 *
 * Global view of every role assignment, grouped by role profile.
 * The page is read-only; rows link back to the role profile detail
 * page where ending assignments + creating new ones lives.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RoleAssignment, RoleProfile } from '@/modules/hr-central/role-profiles/types';
import {
  subscribeRoleAssignments,
  subscribeRoleProfiles,
} from '../services/role-profile.service';
import { PageHero } from '@/shared/components/refresh';

const ASSIGNMENT_TONE: Record<RoleAssignment['status'], 'green' | 'amber' | ''> = {
  active: 'green',
  paused: 'amber',
  ended: '',
};

export default function RoleAssignmentsListPage() {
  const [profiles, setProfiles] = useState<RoleProfile[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');

  useEffect(() => {
    const u1 = subscribeRoleProfiles(setProfiles);
    const u2 = subscribeRoleAssignments(setAssignments, (e) =>
      setErr(`Role assignments subscription failed: ${e.message}`),
    );
    return () => { u1(); u2(); };
  }, []);

  const profilesById = useMemo(() => {
    const out: Record<string, RoleProfile> = {};
    for (const p of profiles) out[p.id] = p;
    return out;
  }, [profiles]);

  const visible = useMemo(() => {
    if (!statusFilter) return assignments;
    return assignments.filter((a) => a.status === statusFilter);
  }, [assignments, statusFilter]);

  const grouped = useMemo(() => {
    const out = new Map<string, RoleAssignment[]>();
    for (const a of visible) {
      if (!out.has(a.roleProfileId)) out.set(a.roleProfileId, []);
      out.get(a.roleProfileId)!.push(a);
    }
    return Array.from(out.entries()).sort((a, b) => {
      const titleA = profilesById[a[0]]?.title ?? a[0];
      const titleB = profilesById[b[0]]?.title ?? b[0];
      return titleA.localeCompare(titleB);
    });
  }, [visible, profilesById]);

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-4" data-testid="role-assignments-list-page">
      <PageHero
        eyebrow="Operations · HR Central"
        title="Role assignments"
        body="Effective-dated EmployeeId × RoleProfileId edges consumed by the EmployeeAssignmentService."
      />

      {err && (
        <div role="alert" data-testid="ra-list-error" className="zeus-note danger">
          {err}
        </div>
      )}

      <div className="zeus-filter-bar">
        <label className="block">
          <span className="zeus-field-label">Status</span>
          <select
            data-testid="ra-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="zeus-select"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
            <option value="paused">Paused</option>
          </select>
        </label>
      </div>

      {grouped.length === 0 ? (
        <div
          data-testid="ra-list-empty"
          className="zeus-panel zeus-panel-empty"
        >
          No assignments match the current filter.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([roleProfileId, rows]) => {
            const profile = profilesById[roleProfileId];
            return (
              <section
                key={roleProfileId}
                data-testid={`ra-group-${roleProfileId}`}
                className="zeus-panel"
              >
                <header className="zeus-panel-head">
                  <Link
                    to={`/hr/role-profiles/${encodeURIComponent(roleProfileId)}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <h3>{profile?.title ?? roleProfileId}</h3>
                  </Link>
                  <span className="zeus-panel-head-meta">
                    {profile?.brandId ?? '—'} · {rows.length}
                  </span>
                </header>
                <ul className="zeus-row-list">
                  {rows.map((a) => {
                    const tone = ASSIGNMENT_TONE[a.status];
                    return (
                      <li
                        key={a.id}
                        data-testid={`ra-row-${a.id}`}
                        className="zeus-row"
                        style={{ gridTemplateColumns: 'auto auto 1fr auto', fontSize: 12 }}
                      >
                        <code
                          style={{
                            fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)',
                            color: 'var(--fg-primary)',
                          }}
                        >
                          {a.employeeId}
                        </code>
                        {a.isPrimary ? (
                          <span className="zeus-state-pill accent">primary</span>
                        ) : (
                          <span />
                        )}
                        <span />
                        <span className="zeus-row-sub" style={{ margin: 0 }}>
                          <span className={`zeus-state-pill ${tone}`} style={{ marginRight: 8 }}>{a.status}</span>
                          {typeof a.effectiveFrom === 'string' ? (a.effectiveFrom as string).slice(0, 10) : '—'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
