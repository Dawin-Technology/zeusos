/**
 * Sparkline — tiny inline trend line with gradient fill + end dot.
 * Ported from the design handoff (`dawin-kit.jsx`).
 *
 * Size is driven by the parent via CSS (defaults to 60%×36px when
 * dropped inside a `.zui-kpi`); the SVG uses a fixed viewBox so it
 * scales without re-measuring.
 */

import React from 'react';

export interface SparklineProps {
  /** Numeric data points. Needs at least 2 to draw a line. */
  points: number[];
  /** Stroke/dot colour — any CSS color, including var(--accent). */
  color?: string;
  /** Height of the SVG viewBox. Width is fixed at 120. */
  height?: number;
  /** Extra className forwarded to the SVG. */
  className?: string;
}

export function Sparkline({
  points,
  color = 'var(--accent)',
  height = 36,
  className,
}: SparklineProps) {
  if (!points || points.length < 2) return null;

  const w = 120;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);

  const coords = points.map((v, i): [number, number] => [
    i * step,
    height - 3 - ((v - min) / range) * (height - 8),
  ]);
  const d = coords
    .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ');
  const gid =
    'zui-spark-' + Math.abs(points.reduce((a, b) => a * 7 + b, 3) | 0);
  const last = coords[coords.length - 1];

  return (
    <svg
      className={className ?? 'zui-kpi-spark'}
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${height} L0,${height} Z`} fill={`url(#${gid})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
    </svg>
  );
}
