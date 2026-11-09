/**
 * Hbars — horizontal-bar list with an optional threshold marker.
 * Powers the Brand Burn, Brand Capacity and Pipeline Funnel sections.
 *
 * Each row is label / bar / value. Bars colour themselves warn/over
 * when they cross the threshold; a vertical tick marker is drawn at
 * the threshold position when supplied.
 */

export interface HbarRow {
  label: string;
  /** Current value (same units as `max`). */
  value: number;
  /** Optional displayed text instead of the raw value (e.g. "72%"). */
  display?: string;
}

export interface HbarsProps {
  rows: HbarRow[];
  /** Max — the bar hits 100% at this value. Defaults to the biggest row. */
  max?: number;
  /** Threshold line, same units as value. e.g. 80 for an 80 % cap. */
  threshold?: number;
  /** Threshold triggering style: values ≥ this go warn, ≥ threshold go over. */
  warnAt?: number;
  /** Show a percentage next to the bar instead of the raw value. */
  asPercent?: boolean;
  className?: string;
}

export function Hbars({
  rows,
  max,
  threshold,
  warnAt,
  asPercent = false,
  className,
}: HbarsProps) {
  const upper = max ?? Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className={className}>
      {rows.map((r, i) => {
        const pct = Math.max(0, Math.min(100, (r.value / upper) * 100));
        let tone: '' | 'ok' | 'warn' | 'over' = '';
        if (threshold !== undefined && r.value >= threshold) tone = 'over';
        else if (warnAt !== undefined && r.value >= warnAt) tone = 'warn';
        else if (r.value > 0) tone = 'ok';

        return (
          <div className="zui-hbar-row" key={`${r.label}-${i}`}>
            <div className="zui-hbar-label">{r.label}</div>
            <div className={`zui-hbar ${tone}`}>
              <span style={{ width: `${pct}%` }} />
              {threshold !== undefined && (
                <span
                  className="zui-hbar-tick"
                  style={{ left: `${Math.min(100, (threshold / upper) * 100)}%` }}
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="zui-hbar-value">
              {r.display ?? (asPercent ? `${Math.round(pct)}%` : r.value.toLocaleString())}
            </div>
          </div>
        );
      })}
    </div>
  );
}
