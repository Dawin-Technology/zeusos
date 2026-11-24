/**
 * RoleProfileDetailPage — Phase 6.UI.A (PR 6).
 *
 * Per-profile detail surface. Top: edit form (RoleProfileForm).
 * Below: list of current role assignments + "Assign employee"
 * button that opens RoleAssignmentDialog. Archive button on header.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import { Archive, Plus } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import type { RoleAssignment, RoleProfile } from '@/modules/hr-central/role-profiles/types';
import {
  archiveRoleProfileFn,
  endRoleAssignmentFn,
  subscribeRoleAssignments,
  subscribeRoleProfile,
} from '../services/role-profile.service';
import { RoleProfileForm } from '../components/RoleProfileForm';
import { RoleAssignmentDialog } from '../components/RoleAssignmentDialog';

export default function RoleProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<RoleProfile | null>(null);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const decoded = decodeURIComponent(id);
    const u1 = subscribeRoleProfile(decoded, setProfile, (e) =>
      setErr(`Role profile load failed: ${e.message}`),
    );
    const u2 = subscribeRoleAssignments(setAssignments, undefined, { roleProfileId: decoded });
    return () => { u1(); u2(); };
  }, [id]);

  const archive = async () => {
    if (!profile) return;
    setBusy('archive');
    setErr(null);
    try {
      await archiveRoleProfileFn({ id: profile.id });
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const endAssignment = async (assignmentId: string) => {
    setBusy(assignmentId);
    setErr(null);
    try {
      await endRoleAssignmentFn({ id: assignmentId });
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!profile) {
    return (
      <div style={{ padding: 'var(--pad-page)' }}>
        <Link to="/hr/role-profiles" className="zeus-back-link">← Role profiles</Link>
        <p style={{ marginTop: 8, fontSize: 13, color: 'var(--fg-secondary)' }}>
          {err ?? 'Loading role profile…'}
        </p>
      </div>
    );
  }

  const activeAssignments = assignments.filter((a) => a.status === 'active');

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-5" data-testid="role-profile-detail-page">
      <div className="zeus-page-head">
        <Link to="/hr/role-profiles" className="zeus-back-link">← Role profiles</Link>
        <div className="zeus-page-head-row">
          <div className="zeus-page-head-title">
            <h1>{profile.title}</h1>
            <code
              style={{
                fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)',
                fontSize: 12,
                color: 'var(--fg-tertiary)',
              }}
            >
              {profile.id}
            </code>
          </div>
          <div className="zeus-page-head-actions">
            {profile.status !== 'archived' && (
              <Button
                size="sm"
                variant="outline"
                data-testid="rp-archive-btn"
                disabled={busy === 'archive'}
                onClick={archive}
              >
                <Archive className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                {busy === 'archive' ? 'Archiving…' : 'Archive'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {err && (
        <div role="alert" data-testid="rp-detail-error" className="zeus-note danger">
          {err}
        </div>
      )}

      {/* Edit form */}
      <section className="zeus-panel" data-testid="rp-edit-section">
        <div className="zeus-panel-head">
          <h2>Role profile</h2>
          <span className="zeus-panel-head-meta">Edit the capability contract</span>
        </div>
        <div className="zeus-panel-pad">
          <RoleProfileForm profile={profile} />
        </div>
      </section>

      {/* Assignments */}
      <section className="zeus-panel" data-testid="rp-assignments-section">
        <header className="zeus-panel-head">
          <h2>
            Assignments
            <span className="zeus-panel-head-meta" style={{ marginLeft: 8 }}>
              ({activeAssignments.length} active{assignments.length > activeAssignments.length ? `, ${assignments.length - activeAssignments.length} ended` : ''})
            </span>
          </h2>
          <Button
            size="sm"
            data-testid="open-assign-dialog"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            Assign employee
          </Button>
        </header>

        {assignments.length === 0 ? (
          <div
            data-testid="rp-assignments-empty"
            className="zeus-panel-empty"
          >
            No one's been assigned to this role yet.
          </div>
        ) : (
          <ul className="zeus-row-list">
            {assignments.map((a) => (
              <li
                key={a.id}
                data-testid={`rp-assignment-${a.id}`}
                className="zeus-row"
                style={{ gridTemplateColumns: '1fr auto', fontSize: 12 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: 'var(--fg-primary)', fontSize: 12.5 }}>
                    <code
                      style={{
                        fontFamily: 'var(--font-mono, ui-monospace, Menlo, monospace)',
                      }}
                    >
                      {a.employeeId}
                    </code>
                    {a.isPrimary && (
                      <span className="zeus-state-pill accent" style={{ marginLeft: 8 }}>primary</span>
                    )}
                  </div>
                  <div className="zeus-row-sub">
                    {a.status} · effective {typeof a.effectiveFrom === 'string' ? (a.effectiveFrom as string).slice(0, 10) : '—'}
                  </div>
                </div>
                {a.status === 'active' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid={`rp-end-assignment-${a.id}`}
                    disabled={busy === a.id}
                    onClick={() => endAssignment(a.id)}
                  >
                    {busy === a.id ? 'Ending…' : 'End'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <RoleAssignmentDialog
        open={dialogOpen}
        roleProfile={profile}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
