// ============================================================================
// CASH & FORECAST LANDING PAGE
// Replaces the Optimizer card grid + Forecasting tab with a unified view.
// Shows: KPI cards, pill sub-navigation, projection chart, spend plan,
//        top expenditures (same content as OptimizerDashboardPage but as a tab landing).
// ============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/core/components/ui/button';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import {
  AlertTriangle,
  RefreshCw,
  Zap,
  TrendingUp,
  Clock,
  Loader2,
  ListOrdered,
  Calendar,
} from 'lucide-react';
import { useOptimizer } from '../hooks/useOptimizer';
import { ProjectionChart } from '../components/optimizer/ProjectionChart';
import { SpendPlanTimeline } from '../components/optimizer/SpendPlanTimeline';
import { TierBadge } from '../components/optimizer/ExpenditureScoreCard';
import { PRIORITY_TIER_COLORS } from '../constants/optimizer.constants';
import { useAuth } from '@/shared/hooks/useAuth';

function formatUGX(value: number): string {
  return `UGX ${value.toLocaleString('en-UG')}`;
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function CashForecastLandingPage() {
  const navigate = useNavigate();
  useAuth();
  const companyId = 'zeus-group';

  const {
    projection,
    expenditureQueue,
    todaysSpendPlan,
    config,
    queueByTier,
    criticalCount,
    totalPendingAmount,
    isLoading,
    error,
    refresh,
    generatePlan,
    runIngestion,
    rescoreAll,
    approveItem,
    deferItem,
  } = useOptimizer({ companyId });

  const [isRunning, setIsRunning] = useState(false);

  const handleRunOptimizer = async () => {
    setIsRunning(true);
    try {
      await runIngestion();
      await rescoreAll();
      await generatePlan(
        todaysSpendPlan?.openingBankBalance || 0,
        todaysSpendPlan?.openingSavingsBalance || 0,
      );
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading && !expenditureQueue.length) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  const cashPosition = todaysSpendPlan?.openingBankBalance || 0;
  const pendingCount = expenditureQueue.length;
  const scheduledToday = todaysSpendPlan?.scheduledExpenditures?.length || 0;
  const bufferAmount = config?.cashBufferSettings?.minimumCashBuffer || 5_000_000;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Finance · Cash & Forecast</div>
          <h2 className="h1">Cash & Forecast</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-tertiary)' }}>
            Cash optimization, projections, and three-statement forecasting
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleRunOptimizer}
            disabled={isRunning}
            className="zeus-finance-cta"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-1.5" />
            )}
            Run Optimizer
          </Button>
        </div>
      </div>

      {error && (
        <div className="zeus-finance-alert zeus-finance-alert-red">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Crisis Alert */}
      {criticalCount > 0 && (
        <div className="zeus-finance-alert zeus-finance-alert-red zeus-finance-alert-strong">
          <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: 'var(--rag-red)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--rag-red)' }}>
              {criticalCount} critical expenditure{criticalCount > 1 ? 's' : ''} require immediate attention
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--rag-red)' }}>
              Total: {formatUGX(queueByTier['CRITICAL']?.reduce((s: number, i: any) => s + i.amountUGX, 0) || 0)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            style={{ color: 'var(--rag-red)', borderColor: 'var(--rag-red)' }}
            onClick={() => navigate('/finance/cash/expenditures?tier=CRITICAL')}
          >
            View
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <KPIGrid cols={4}>
        <KPICard
          label="Cash Position"
          value={formatCompact(cashPosition)}
          unit="UGX"
        />
        <KPICard
          label="Pending Queue"
          value={pendingCount}
          delta={`${formatCompact(totalPendingAmount)} total`}
        />
        <KPICard
          label="Scheduled Today"
          value={scheduledToday}
          delta={todaysSpendPlan ? formatCompact(todaysSpendPlan.totalOutflow) : '—'}
        />
        <KPICard
          label="Priority Tiers"
          value={
            <div className="flex gap-1.5 mt-1">
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'DEFERRABLE'] as const).map(tier => {
                const count = queueByTier[tier]?.length || 0;
                return (
                  <div
                    key={tier}
                    className="flex-1 text-center"
                    title={`${tier}: ${count}`}
                  >
                    <div
                      className="text-base font-bold"
                      style={{ color: PRIORITY_TIER_COLORS[tier] }}
                    >
                      {count}
                    </div>
                    <div className="text-[9px] text-[var(--fg-tertiary)] truncate">{tier.slice(0, 4)}</div>
                  </div>
                );
              })}
            </div>
          }
        />
      </KPIGrid>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Projection Chart */}
        <div className="zeus-panel lg:col-span-2">
          <div className="zeus-panel-head">
            <h3>90-Day Cash Projection</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/finance/cash/projections')}
              className="text-xs"
            >
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              Details
            </Button>
          </div>
          <div className="zeus-panel-pad">
            <ProjectionChart
              projection={projection}
              bufferAmount={bufferAmount}
              height={300}
            />
          </div>
        </div>

        {/* Today's Spend Plan */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--fg-primary)' }}>Today&apos;s Spend Plan</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/finance/cash/spend-plan')}
              className="text-xs"
            >
              <Calendar className="w-3.5 h-3.5 mr-1" />
              Full Plan
            </Button>
          </div>
          {todaysSpendPlan ? (
            <SpendPlanTimeline
              plan={todaysSpendPlan}
              onApprove={(id) => todaysSpendPlan?.id && approveItem(todaysSpendPlan.id, id)}
              onDefer={(id) => deferItem(id, 'Deferred from dashboard')}
            />
          ) : (
            <div className="zeus-panel zeus-panel-pad" style={{ textAlign: 'center', padding: '24px' }}>
              <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--fg-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--fg-secondary)' }}>No spend plan generated yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleRunOptimizer}
                disabled={isRunning}
              >
                Generate Plan
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Top Critical Items */}
      {expenditureQueue.length > 0 && (
        <div className="zeus-panel">
          <div className="zeus-panel-head">
            <h3>Top Expenditures by Score</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/finance/cash/expenditures')}
              className="text-xs"
            >
              <ListOrdered className="w-3.5 h-3.5 mr-1" />
              View All
            </Button>
          </div>
          <div className="zeus-panel-pad">
            <div className="space-y-2">
              {expenditureQueue.slice(0, 5).map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span
                    className="text-sm font-bold w-8 text-center"
                    style={{ color: PRIORITY_TIER_COLORS[item.priorityTier as keyof typeof PRIORITY_TIER_COLORS] }}
                  >
                    {item.compositeScore.toFixed(0)}
                  </span>
                  <TierBadge tier={item.priorityTier} />
                  <span className="text-sm truncate flex-1" style={{ color: 'var(--fg-secondary)' }}>{item.description}</span>
                  {item.vendor && (
                    <span className="text-xs hidden sm:block" style={{ color: 'var(--fg-tertiary)' }}>{item.vendor}</span>
                  )}
                  <span className="text-sm font-medium shrink-0" style={{ color: 'var(--fg-primary)' }}>{formatUGX(item.amountUGX)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Data Sources — Cross-module links */}
      <div className="zeus-panel zeus-panel-pad">
        <h3 className="eyebrow" style={{ marginBottom: 12 }}>
          Cash Data Sources
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/finance/operations/bills')}
            className="zeus-finance-link"
            data-testid="cash-source-bills"
          >
            <div className="zeus-finance-link-dot" style={{ background: 'var(--rag-red)' }} />
            QBO Bills & Payables
          </button>
          <button
            onClick={() => navigate('/manufacturing/procurement')}
            className="zeus-finance-link"
            data-testid="cash-source-pos"
          >
            <div className="zeus-finance-link-dot" style={{ background: 'var(--rag-blue)' }} />
            Purchase Orders
          </button>
          <button
            onClick={() => navigate('/hr/payroll')}
            className="zeus-finance-link"
            data-testid="cash-source-payroll"
          >
            <div className="zeus-finance-link-dot" style={{ background: 'var(--rag-amber)' }} />
            Salary & PAYE
          </button>
          <button
            onClick={() => navigate('/finance/operations/invoices')}
            className="zeus-finance-link"
            data-testid="cash-source-invoices"
          >
            <div className="zeus-finance-link-dot" style={{ background: 'var(--rag-green)' }} />
            Invoices & Receipts
          </button>
        </div>
      </div>
    </div>
  );
}

export default CashForecastLandingPage;
