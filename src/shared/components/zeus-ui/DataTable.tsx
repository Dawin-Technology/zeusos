/**
 * DataTable — a filtered, sorted, zebra-striped table with a FilterBar
 * (search + chip filters) and a status-row footer, suitable for every
 * list surface in ZeusOS. Rows can open a right-side drawer with a
 * detail panel, or defer to a parent-provided onRowClick for route
 * navigation.
 *
 * Column types: 'text' (default), 'mono', 'money', 'date', 'pill',
 * 'brand', 'status' (via `statusMap`), 'person', 'progress', 'rating'.
 * Pass `render` to override completely.
 */

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-react';
import {
  BrandChip,
  MiniBar,
  MoneyCell,
  PersonChip,
  RagBadge,
  RatingStars,
  type RagTone,
  type SubBrandId,
} from './cells';

export type CellType =
  | 'text'
  | 'mono'
  | 'money'
  | 'date'
  | 'pill'
  | 'brand'
  | 'status'
  | 'person'
  | 'progress'
  | 'rating';

export interface Column<Row> {
  key: keyof Row & string;
  label: string;
  type?: CellType;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  statusMap?: Record<string, { tone: RagTone; label: string }>;
  /** Fully custom cell renderer; receives the raw value and the row. */
  render?: (value: unknown, row: Row) => React.ReactNode;
}

export interface FilterSpec {
  key: string;
  label: string;
  options: string[]; // first option is "All" by convention
}

export interface DataTableProps<Row extends object> {
  rows: Row[];
  columns: Column<Row>[];
  /** Placeholder for the search input. Omit to hide search. */
  search?: string;
  /** Chip filter specs. */
  filters?: FilterSpec[];
  /** Row-level click handler — if provided, the row is cursor:pointer. */
  onRowClick?: (row: Row) => void;
  /**
   * When truthy on a row, paint the brand-accent left edge (used for
   * IWO rows etc.). Return the row's brand id; it drives --brand-accent
   * via inline style.
   */
  rowBrandEdge?: (row: Row) => SubBrandId | string | undefined;
  /** Compact (no FilterBar) — just the table + footer. */
  bare?: boolean;
  /** Keep the sticky header inside a scroll container of this max height. */
  maxHeight?: number | string;
  /** Returns a data-testid for each row's <tr>. Lets Playwright specs
   *  that used row wrappers (e.g. `iwo-row-${id}`) keep matching. */
  rowTestId?: (row: Row) => string;
  className?: string;
}

function renderCell<Row extends object>(col: Column<Row>, row: Row) {
  const raw = row[col.key as keyof Row];
  if (col.render) return col.render(raw, row);
  if (raw == null || raw === '')
    return <span style={{ color: 'var(--fg-tertiary)' }}>—</span>;
  switch (col.type) {
    case 'mono':
      return <span className="zui-mono">{String(raw)}</span>;
    case 'money':
      return <MoneyCell value={raw as number | string} />;
    case 'date':
      return <span style={{ color: 'var(--fg-secondary)' }}>{String(raw)}</span>;
    case 'pill':
      return (
        <span className="zui-rag na">
          <span className="zui-dot" />
          {String(raw)}
        </span>
      );
    case 'brand':
      return <BrandChip id={String(raw) as SubBrandId} />;
    case 'status': {
      const map = col.statusMap ?? {};
      const key = String(raw);
      const spec = map[key] ?? { tone: 'na' as RagTone, label: key };
      return <RagBadge tone={spec.tone} label={spec.label} />;
    }
    case 'person':
      return <PersonChip name={String(raw)} />;
    case 'progress': {
      const pct =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'object' && raw !== null && 'pct' in (raw as Record<string, unknown>)
            ? Number((raw as unknown as { pct: number }).pct)
            : Number(raw);
      return <MiniBar pct={pct} />;
    }
    case 'rating':
      return <RatingStars value={Number(raw)} />;
    default:
      return String(raw);
  }
}

export function DataTable<Row extends object>({
  rows,
  columns,
  search,
  filters,
  onRowClick,
  rowBrandEdge,
  bare = false,
  maxHeight,
  rowTestId,
  className,
}: DataTableProps<Row>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string | null; dir: 'asc' | 'desc' }>(
    { key: null, dir: 'asc' },
  );
  const [active, setActive] = useState<Record<string, string>>({});

  const processed = useMemo(() => {
    let data = rows;
    const norm = (s: unknown) =>
      String(s ?? '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    Object.entries(active).forEach(([k, v]) => {
      if (!v || v === 'All') return;
      data = data.filter((r) => norm((r as Record<string, unknown>)[k]) === norm(v));
    });

    if (query.trim()) {
      const q = query.toLowerCase();
      data = data.filter((r) =>
        Object.values(r as Record<string, unknown>).some((v) =>
          v != null &&
          (typeof v === 'object' ? JSON.stringify(v) : String(v))
            .toLowerCase()
            .includes(q),
        ),
      );
    }

    if (sort.key) {
      const d = sort.dir === 'asc' ? 1 : -1;
      data = [...data].sort((a, b) => {
        const av = (a as Record<string, unknown>)[sort.key!];
        const bv = (b as Record<string, unknown>)[sort.key!];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * d;
        return String(av).localeCompare(String(bv), undefined, { numeric: true }) * d;
      });
    }
    return data;
  }, [rows, query, sort, active]);

  const isFiltered = query || Object.values(active).some((v) => v && v !== 'All');

  const toggleSort = (key: string, sortable?: boolean) => {
    if (sortable === false) return;
    setSort((s) => {
      if (s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return { key: null, dir: 'asc' };
    });
  };

  const clearAll = () => {
    setQuery('');
    setActive({});
  };

  return (
    <div className={`zui-card${className ? ` ${className}` : ''}`}>
      {!bare && (search || filters) && (
        <div className="zui-filter-bar">
          {search && (
            <div
              style={{
                position: 'relative',
                width: 280,
                maxWidth: '100%',
              }}
            >
              <Search
                className="h-3.5 w-3.5"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: 10,
                  transform: 'translateY(-50%)',
                  color: 'var(--fg-tertiary)',
                }}
              />
              <input
                className="zui-input"
                placeholder={search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  fontSize: 12.5,
                  background: 'var(--bg-surface)',
                  color: 'var(--fg-primary)',
                }}
              />
            </div>
          )}
          {(filters ?? []).map((f) => {
            const cur = active[f.key] || f.options[0];
            return (
              <div
                key={f.key}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--fg-tertiary)',
                    marginRight: 4,
                  }}
                >
                  {f.label}
                </span>
                {f.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`zui-chip ${cur === o ? 'active' : ''}`}
                    onClick={() =>
                      setActive((a) => ({ ...a, [f.key]: o }))
                    }
                  >
                    {o}
                  </button>
                ))}
              </div>
            );
          })}
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--fg-tertiary)',
            }}
          >
            <Filter className="h-3 w-3" />
            {isFiltered ? (
              <>
                <strong style={{ color: 'var(--fg-primary)' }}>Filtered</strong>
                <button
                  type="button"
                  onClick={clearAll}
                  className="zui-icon-btn"
                  aria-label="Clear filters"
                  style={{ width: 22, height: 22 }}
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              'Showing all'
            )}
          </div>
        </div>
      )}

      <div
        style={
          maxHeight
            ? { maxHeight, overflow: 'auto' }
            : undefined
        }
      >
        <table className="zui-tbl">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={c.sortable !== false ? 'sortable' : undefined}
                  onClick={() => toggleSort(c.key, c.sortable)}
                  style={{
                    width: c.width,
                    textAlign: c.align ?? 'left',
                  }}
                >
                  {c.label}
                  {sort.key === c.key && (
                    <span className="zui-sort-arrow">
                      {sort.dir === 'asc' ? (
                        <ChevronUp className="h-3 w-3 inline" />
                      ) : (
                        <ChevronDown className="h-3 w-3 inline" />
                      )}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processed.map((row, i) => {
              const brandId = rowBrandEdge?.(row);
              const handleClick = onRowClick
                ? () => onRowClick(row)
                : undefined;
              return (
                <tr
                  key={i}
                  className={brandId ? 'is-brand-edge' : undefined}
                  style={
                    brandId
                      ? ({
                          ['--brand-accent' as string]:
                            `var(--sb-${brandId})`,
                        } as React.CSSProperties)
                      : undefined
                  }
                  onClick={handleClick}
                  data-testid={rowTestId?.(row)}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{
                        textAlign: c.align ?? 'left',
                      }}
                    >
                      {renderCell(c, row)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {processed.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    height: 80,
                    color: 'var(--fg-tertiary)',
                    textAlign: 'center',
                    fontSize: 12,
                  }}
                >
                  Nothing matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="zui-tbl-footer">
        <span>
          Showing <strong style={{ color: 'var(--fg-primary)' }}>{processed.length}</strong> of {rows.length}
        </span>
        {isFiltered && (
          <button
            type="button"
            onClick={clearAll}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--fg-secondary)',
              fontSize: 12,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
