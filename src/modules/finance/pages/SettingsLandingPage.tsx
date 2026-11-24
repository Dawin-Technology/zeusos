// ============================================================================
// SETTINGS LANDING PAGE
// ZeusOS v2.0 - Finance Module
// Replaces card-grid with a vertical list for direct access to settings.
// ============================================================================

import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Link,
  RefreshCw,
  GitBranch,
  Calculator,
  ChevronRight,
} from 'lucide-react';

// ── Section Definitions ────────────────────────────────────────────────────

interface SettingsSection {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  path: string;
}

const SECTIONS: SettingsSection[] = [
  {
    id: 'accounts',
    label: 'Chart of Accounts',
    description: 'Manage account hierarchy, types & classifications',
    icon: BookOpen,
    path: '/finance/settings/accounts',
  },
  {
    id: 'integrations',
    label: 'QBO Integration',
    description: 'QuickBooks Online connection & data sync',
    icon: Link,
    path: '/finance/settings/integrations',
  },
  {
    id: 'sync',
    label: 'Sync Dashboard',
    description: 'QBO sync status monitoring & history',
    icon: RefreshCw,
    path: '/finance/settings/sync',
  },
  {
    id: 'mappings',
    label: 'Account Mappings',
    description: 'Map ZeusOS accounts to QBO counterparts',
    icon: GitBranch,
    path: '/finance/settings/mappings',
  },
  {
    id: 'pricing',
    label: 'Pricing Assumptions',
    description: 'Labour rates, markups & costing parameters',
    icon: Calculator,
    path: '/finance/settings/pricing',
  },
];

// ── Main Page ──────────────────────────────────────────────────────────────

export function SettingsLandingPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Finance · Settings</div>
        <h2 className="h1">Finance Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configuration, integrations & account management
        </p>
      </div>

      {/* Vertical list of settings sections — soft panel of rows */}
      <div className="zeus-panel">
        <ul className="zeus-row-list zeus-finance-settings-list">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <li key={section.id} className="zeus-row zeus-finance-settings-row">
                <button
                  type="button"
                  onClick={() => navigate(section.path)}
                  className="zeus-finance-settings-btn"
                  data-testid={`settings-section-${section.id}`}
                >
                  <div className="zeus-finance-settings-icon">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--fg-primary)' }}>
                      {section.label}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--fg-tertiary)' }}>
                      {section.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--fg-tertiary)' }} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default SettingsLandingPage;
