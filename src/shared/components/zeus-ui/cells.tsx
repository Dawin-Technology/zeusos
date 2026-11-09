/**
 * Cell primitives rendered inside DataTable rows — brand chip, RAG
 * badge, person chip, mini progress bar, rating, money, date. All of
 * them live in `.zui-*`-scoped CSS and are reusable on detail pages.
 */

import React from 'react';

/** Build a stable deterministic hue from a name string. */
function hueFor(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function initialsOf(name = ''): string {
  return name
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export type SubBrandId =
  | 'zeus-the-agency'
  | 'zeus-digital'
  | 'labyrinth'
  | 'odd-gorilla'
  | 'house-of-zeus'
  | 'zeus-group';

export interface BrandChipProps {
  id: SubBrandId | string;
  label?: string;
  full?: boolean;
}

const BRAND_LABEL: Record<string, { short: string; name: string }> = {
  'zeus-group':      { short: 'ZG',  name: 'Zeus Group' },
  'zeus-the-agency': { short: 'ZTA', name: 'Zeus The Agency' },
  'zeus-digital':    { short: 'ZD',  name: 'Zeus Digital' },
  labyrinth:         { short: 'LAB', name: 'Labyrinth' },
  'odd-gorilla':     { short: 'OG',  name: 'Odd Gorilla' },
  'house-of-zeus':   { short: 'HOZ', name: 'House of Zeus' },
};

export function BrandChip({ id, label, full = false }: BrandChipProps) {
  const meta = BRAND_LABEL[id] ?? { short: id.slice(0, 3).toUpperCase(), name: id };
  return (
    <span className="zui-brand-chip">
      <span className="zui-brand-dot" data-sb={id} />
      {label ?? (full ? meta.name : meta.short)}
    </span>
  );
}

export type RagTone = 'green' | 'amber' | 'red' | 'blue' | 'na';
export interface RagBadgeProps {
  tone: RagTone;
  label: React.ReactNode;
}
export function RagBadge({ tone, label }: RagBadgeProps) {
  return (
    <span className={`zui-rag ${tone}`}>
      <span className="zui-dot" />
      {label}
    </span>
  );
}

export interface PersonChipProps {
  name: string;
  secondary?: React.ReactNode;
}
export function PersonChip({ name, secondary }: PersonChipProps) {
  const bg = `hsl(${hueFor(name)} 38% 46%)`;
  return (
    <span className="zui-person" title={name}>
      <span className="zui-avatar" style={{ background: bg }}>
        {initialsOf(name) || '?'}
      </span>
      <span className="zui-person-name">{name}</span>
      {secondary && (
        <span style={{ color: 'var(--fg-tertiary)', fontSize: 11, marginLeft: 6 }}>
          {secondary}
        </span>
      )}
    </span>
  );
}

export interface MiniBarProps {
  pct: number;
}
export function MiniBar({ pct }: MiniBarProps) {
  const safe = Math.max(0, Math.min(100, Math.round(pct)));
  const tone = pct > 100 ? 'over' : pct > 90 ? 'warn' : '';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div className={`zui-mini-bar ${tone}`.trim()}>
        <span style={{ width: `${safe}%` }} />
      </div>
      <span
        style={{
          minWidth: 32,
          textAlign: 'right',
          fontSize: 11.5,
          color: 'var(--fg-secondary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {safe}%
      </span>
    </div>
  );
}

export interface RatingStarsProps {
  value: number; // 0..5
}
export function RatingStars({ value }: RatingStarsProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        gap: 2,
        color: 'var(--rag-amber)',
        alignItems: 'center',
      }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ opacity: i < Math.round(value) ? 1 : 0.22 }}>
          ★
        </span>
      ))}
      <span
        style={{
          marginLeft: 4,
          fontSize: 11,
          color: 'var(--fg-tertiary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value.toFixed(1)}
      </span>
    </span>
  );
}

export interface MoneyCellProps {
  /** Minor units (cents / KES centesimi). Pass number or already-formatted string. */
  value: number | string;
  currency?: string;
  /** If true, treat `value` as minor units; else major. */
  minor?: boolean;
}
export function MoneyCell({ value, currency, minor = false }: MoneyCellProps) {
  if (typeof value === 'string') return <span className="zui-money">{value}</span>;
  const n = minor ? value / 100 : value;
  const txt = new Intl.NumberFormat('en-KE', {
    maximumFractionDigits: 0,
  }).format(n);
  return (
    <span className="zui-money">
      {currency ? `${currency} ` : ''}
      {txt}
    </span>
  );
}
