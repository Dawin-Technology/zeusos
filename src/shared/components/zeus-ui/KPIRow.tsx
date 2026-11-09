/**
 * KPIRow — the 4-up KPI row at the top of every DawinOS-style page.
 * Each card shows label · big tabular value · ↑/↓/→ delta · sparkline.
 * The grid collapses to 2-up on tablet and 1-up on mobile via CSS.
 */

import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import { Sparkline } from './Sparkline';

export type KPITrend = 'up' | 'down' | 'flat';

export interface KPI {
  label: string;
  value: string | number;
  unit?: string;
  /** Optional delta label — e.g. "+12% vs May" or "on track". */
  delta?: string;
  trend?: KPITrend;
  /** Data for the inline sparkline; omit to render without one. */
  spark?: number[];
  /** Override the sparkline colour. Defaults to var(--accent). */
  color?: string;
}

export interface KPIRowProps {
  kpis: KPI[];
  /** Hide all sparklines (respected globally via a UI preference). */
  showSparklines?: boolean;
  /**
   * Force a column count. Defaults to kpis.length (max 4). Useful
   * when a surface knows it's always a 3-up row.
   */
  columns?: 2 | 3 | 4;
  className?: string;
}

function DeltaIcon({ trend }: { trend: KPITrend }) {
  if (trend === 'up') return <ArrowUp className="h-3 w-3" strokeWidth={2.4} />;
  if (trend === 'down')
    return <ArrowDown className="h-3 w-3" strokeWidth={2.4} />;
  return <ChevronRight className="h-3 w-3" strokeWidth={2.4} />;
}

export function KPIRow({
  kpis,
  showSparklines = true,
  columns,
  className,
}: KPIRowProps) {
  const cols = columns ?? Math.min(kpis.length, 4);
  return (
    <div
      className={`zui-kpi-row${className ? ` ${className}` : ''}`}
      style={{ ['--zui-kpi-cols' as string]: cols }}
    >
      {kpis.map((k, i) => (
        <div className="zui-kpi" key={`${k.label}-${i}`}>
          <span className="zui-kpi-label">{k.label}</span>
          <span className="zui-kpi-value">
            {k.value}
            {k.unit && <span className="zui-kpi-unit">{k.unit}</span>}
          </span>
          {k.delta && (
            <span className={`zui-kpi-delta ${k.trend ?? 'flat'}`}>
              <DeltaIcon trend={k.trend ?? 'flat'} />
              {k.delta}
            </span>
          )}
          {showSparklines && k.spark && k.spark.length >= 2 && (
            <Sparkline points={k.spark} color={k.color} />
          )}
        </div>
      ))}
    </div>
  );
}
