// ============================================================================
// ANALYSIS LANDING PAGE
// ZeusOS v2.0 - Finance Module
// Section landing page with card grid linking to 8 analysis sub-pages
// ============================================================================

import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Search,
  Target,
  ArrowLeftRight,
  TrendingUp,
  LineChart,
  Crosshair,
  Heart,
  Library,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ── Card Definitions ─────────────────────────────────────────────────────────

interface AnalysisCard {
  icon: LucideIcon;
  label: string;
  description: string;
  path: string;
}

const CARDS: AnalysisCard[] = [
  {
    icon: BarChart3,
    label: 'KPIs',
    description: 'Key financial ratios and metrics',
    path: '/finance/analysis/kpis',
  },
  {
    icon: Search,
    label: 'KPI Explorer',
    description: 'Deep-dive into individual KPIs',
    path: '/finance/analysis/kpi-explorer',
  },
  {
    icon: Target,
    label: 'Profitability',
    description: 'Breakeven analysis & cost structure',
    path: '/finance/analysis/profitability',
  },
  {
    icon: ArrowLeftRight,
    label: 'Cash Flow',
    description: 'Cash flow analysis & waterfall',
    path: '/finance/analysis/cash-flow',
  },
  {
    icon: TrendingUp,
    label: 'Growth',
    description: 'Revenue & expense growth rates',
    path: '/finance/analysis/growth',
  },
  {
    icon: LineChart,
    label: 'Trend',
    description: 'Time-series trends across accounts',
    path: '/finance/analysis/trend',
  },
  {
    icon: Crosshair,
    label: 'Goal Seek',
    description: 'Sensitivity analysis & targets',
    path: '/finance/analysis/goal-seek',
  },
  {
    icon: Heart,
    label: 'Financial Health',
    description: 'Overall financial health score',
    path: '/finance/analysis/financial',
  },
  {
    icon: Library,
    label: 'KPI Library',
    description: 'Browse the full financial KPI library',
    path: '/strategy/kpis/library?category=financial_performance',
  },
];

// ── Card Component ───────────────────────────────────────────────────────────

function AnalysisNavCard({ card }: { card: AnalysisCard }) {
  const navigate = useNavigate();
  const Icon = card.icon;

  return (
    <button
      type="button"
      onClick={() => navigate(card.path)}
      className="zeus-finance-nav-card"
      data-testid={`analysis-card-${card.label.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div className="flex items-start gap-4">
        <div className="zeus-finance-nav-icon">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="zeus-finance-nav-title">{card.label}</h3>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--fg-tertiary)' }}>
            {card.description}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function AnalysisLandingPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Finance · Analysis</div>
        <h2 className="h1">Financial Analysis</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--fg-tertiary)' }}>
          Analyse financial performance, ratios, and trends
        </p>
      </div>

      {/* Card Grid */}
      <div className="zeus-finance-nav-grid">
        {CARDS.map((card) => (
          <AnalysisNavCard key={card.path} card={card} />
        ))}
      </div>
    </div>
  );
}

export default AnalysisLandingPage;
