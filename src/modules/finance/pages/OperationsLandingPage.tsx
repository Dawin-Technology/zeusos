// ============================================================================
// OPERATIONS LANDING PAGE
// ZeusOS v2.0 - Finance Module
// Replaces card-grid navigation with summary data + pill sub-navigation.
// Shows: 4 summary stat cards, top items tables, pill navigation bar.
// ============================================================================

import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
} from 'lucide-react';
import { useFinanceDashboard } from '../hooks/useFinanceDashboard';
import { useAuth } from '@/shared/hooks/useAuth';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

const COMPANY_ID = 'zeus-group';

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function OperationsLandingPage() {
  const navigate = useNavigate();
  useAuth();

  const {
    metrics,
    budgets,
    accounts,
    loading,
  } = useFinanceDashboard(COMPANY_ID);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Finance · Operations</div>
        <h2 className="h1">Finance Operations</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--fg-tertiary)' }}>
          Day-to-day financial activities & workflows
        </p>
      </div>

      {/* Row 1: Summary Stats */}
      <KPIGrid cols={4}>
        <KPICard
          label="Accounts"
          value={metrics.accountCount}
          delta="Active postable accounts"
        />
        <KPICard
          label="Cash Balance"
          value={formatCompact(metrics.totalCash)}
          unit="UGX"
        />
        <KPICard
          label="Budget Utilization"
          value={`${metrics.budgetUtilization}%`}
          delta={`${formatCompact(metrics.totalSpent)} of ${formatCompact(metrics.totalBudget)}`}
        />
        <KPICard
          label="Active Budgets"
          value={metrics.activeBudgetCount}
          delta={`${metrics.recentTransactionCount} recent txns`}
        />
      </KPIGrid>

      {/* Row 2: Budget Status + Top Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Budget Status */}
        <div className="zeus-panel">
          <div className="zeus-panel-head">
            <h3>Active Budgets</h3>
            <button
              onClick={() => navigate('/finance/operations/budgets')}
              className="inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--rag-green)' }}
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="zeus-panel-pad">
            {budgets.length > 0 ? (
              <div className="space-y-3">
                {budgets.map((b) => (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="truncate max-w-[50%]" style={{ color: 'var(--fg-secondary)' }}>{b.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>{b.category}</span>
                        <span className={`text-xs font-medium ${b.utilization >= 100 ? 'text-[var(--rag-red)]' : b.utilization >= 85 ? 'text-[var(--rag-amber)]' : ''}`}
                          style={b.utilization < 85 ? { color: 'var(--fg-tertiary)' } : undefined}
                        >
                          {b.utilization}%
                        </span>
                      </div>
                    </div>
                    <div className="zeus-burn-track">
                      <div
                        className={`zeus-burn-fill ${b.utilization >= 100 ? 'over' : b.utilization >= 85 ? 'warn' : ''}`}
                        style={{ width: `${Math.min(b.utilization, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="zeus-panel-empty">No active budgets</p>
            )}
          </div>
        </div>

        {/* Top Accounts */}
        <div className="zeus-panel">
          <div className="zeus-panel-head">
            <h3>Top Accounts by Balance</h3>
            <button
              onClick={() => navigate('/finance/settings/accounts')}
              className="inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--rag-green)' }}
            >
              Chart of Accounts <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="zeus-panel-pad">
            {accounts.length > 0 ? (
              <div className="space-y-2">
                {accounts.slice(0, 5).map((a) => {
                  const typeTone =
                    a.type === 'asset' || a.type === 'equity' ? 'zeus-state-pill' :
                    a.type === 'liability' ? 'zeus-state-pill red' :
                    a.type === 'revenue' ? 'zeus-state-pill green' :
                    'zeus-state-pill amber';
                  const typeStyle =
                    a.type === 'asset' || a.type === 'equity'
                      ? { background: 'var(--rag-blue-soft)', color: 'var(--rag-blue)' }
                      : undefined;
                  return (
                    <div key={a.id} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={typeTone} style={typeStyle}>{a.type}</span>
                        <span className="text-sm truncate" style={{ color: 'var(--fg-secondary)' }}>{a.name}</span>
                      </div>
                      <span className="text-sm font-medium shrink-0 ml-2" style={{ color: 'var(--fg-primary)' }}>
                        {formatCompact(a.balance)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="zeus-panel-empty">No account data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OperationsLandingPage;
