/**
 * KanbanLayout — soft-skin kanban board primitive.
 *
 * A presentational columns + cards layout, scoped under
 * `[data-skin="soft"]` via `./KanbanLayout.css`. Pages pass column
 * definitions, cards, and (optionally) a per-column summary slot plus
 * a swim-lane field. All behaviour (drag/drop, click-to-open) is
 * delegated to callers — the component just renders.
 *
 * Playwright-safe anchors:
 *   - the board root carries `data-testid="kanban-board"` (unless the
 *     caller overrides with `testId`)
 *   - each column carries `data-testid="kanban-column"` + `data-column-id`
 *   - each card carries `data-testid="kanban-card"` + `data-card-id`
 */

import React from 'react';
import './KanbanLayout.css';

export interface KanbanColumn {
  id: string;
  title: React.ReactNode;
  /** Explicit count override; otherwise derived from `items.filter(c => c.columnId === id)`. */
  count?: number;
  /** Colour of the under-title rule — defaults to `var(--border-strong)`. */
  tone?: string;
  /** Right-aligned column meta (e.g. "$180k · weighted"). */
  meta?: React.ReactNode;
  /** Card shown above the list, often totals. `null` suppresses even the default. */
  summary?: React.ReactNode;
  /** Shown when no items are in this column. Defaults to "Empty". */
  emptyLabel?: React.ReactNode;
}

export interface KanbanItem {
  id: string;
  columnId: string;
  /** Ignored unless the parent also passes `renderLanes`. */
  laneId?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  badge?: React.ReactNode;
  avatar?: React.ReactNode;
  owner?: React.ReactNode;
  meta?: React.ReactNode;
  /** Underlying record href — if given, clicking the card navigates. */
  href?: string;
  /** Opaque passthrough for `renderCard`/`onItemClick` / `onItemMove`. */
  payload?: unknown;
}

export interface KanbanLane {
  id: string;
  title: React.ReactNode;
}

export interface KanbanLayoutProps {
  columns: KanbanColumn[];
  items: KanbanItem[];
  /** Optional swim-lanes grouping inside each column (top → bottom order). */
  lanes?: KanbanLane[];
  /** Click/activate handler for a card. Called on Enter/Space too. */
  onItemClick?: (item: KanbanItem) => void;
  /**
   * Drag-and-drop handler. When provided, cards and columns opt-in to
   * native HTML5 drag events and columns become drop targets. This
   * primitive stays stateless — callers reconcile the drop in their own
   * store.
   */
  onItemMove?: (itemId: string, targetColumnId: string, targetLaneId?: string) => void;
  /** Full card renderer override. Receives the raw KanbanItem. */
  renderCard?: (item: KanbanItem) => React.ReactNode;
  /** Shown above each column — totals, weighted value, etc. */
  renderColumnSummary?: (column: KanbanColumn, items: KanbanItem[]) => React.ReactNode;
  /** Shown below the column list (e.g. a "+ Add" button). */
  renderColumnFooter?: (column: KanbanColumn) => React.ReactNode;
  /** Appended as `data-testid` on the board wrapper. */
  testId?: string;
  className?: string;
}

/**
 * Soft-skin Kanban board. All styling is scoped under `[data-skin="soft"]`
 * — elements rendered outside the soft shell inherit no visual rules
 * from this primitive (safe to mount anywhere).
 */
export function KanbanLayout({
  columns,
  items,
  lanes,
  onItemClick,
  onItemMove,
  renderCard,
  renderColumnSummary,
  renderColumnFooter,
  testId = 'kanban-board',
  className,
}: KanbanLayoutProps) {
  const byColumn = React.useMemo(() => {
    const map = new Map<string, KanbanItem[]>();
    for (const col of columns) map.set(col.id, []);
    for (const it of items) {
      const bucket = map.get(it.columnId);
      if (bucket) bucket.push(it);
    }
    return map;
  }, [columns, items]);

  return (
    <div
      className={['zui-kanban', className ?? ''].filter(Boolean).join(' ')}
      data-testid={testId}
    >
      {columns.map((col) => {
        const colItems = byColumn.get(col.id) ?? [];
        const count = col.count ?? colItems.length;
        const summary =
          col.summary !== undefined
            ? col.summary
            : renderColumnSummary
              ? renderColumnSummary(col, colItems)
              : null;
        const footer = renderColumnFooter?.(col);
        return (
          <section
            key={col.id}
            className="zui-kanban-col"
            data-testid="kanban-column"
            data-column-id={col.id}
            data-stage={col.id}
            onDragOver={
              onItemMove
                ? (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }
                : undefined
            }
            onDrop={
              onItemMove
                ? (e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/plain');
                    if (id) onItemMove(id, col.id);
                  }
                : undefined
            }
          >
            <header className="zui-kanban-col-head">
              <span className="zui-kanban-col-title">
                {col.title}
                <span className="zui-kanban-col-count">· {count}</span>
              </span>
              {col.meta && <span className="zui-kanban-col-meta">{col.meta}</span>}
            </header>
            <div
              className="zui-kanban-col-rule"
              style={col.tone ? { background: col.tone } : undefined}
            />
            {summary && <div className="zui-kanban-col-summary">{summary}</div>}

            {lanes && lanes.length > 0 ? (
              <div>
                {lanes.map((lane) => {
                  const laneItems = colItems.filter((c) => c.laneId === lane.id);
                  return (
                    <div key={lane.id} className="zui-kanban-lane">
                      <div className="zui-kanban-lane-head">
                        <span className="zui-kanban-lane-title">{lane.title}</span>
                      </div>
                      <div className="zui-kanban-list">
                        {laneItems.length === 0 ? (
                          <div className="zui-kanban-empty">
                            {col.emptyLabel ?? 'Empty'}
                          </div>
                        ) : (
                          laneItems.map((item) =>
                            renderCard ? (
                              <React.Fragment key={item.id}>
                                {renderCard(item)}
                              </React.Fragment>
                            ) : (
                              <KanbanCard
                                key={item.id}
                                item={item}
                                onClick={onItemClick}
                                draggable={!!onItemMove}
                              />
                            ),
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="zui-kanban-list">
                {colItems.length === 0 ? (
                  <div className="zui-kanban-empty">{col.emptyLabel ?? 'Empty'}</div>
                ) : (
                  colItems.map((item) =>
                    renderCard ? (
                      <React.Fragment key={item.id}>
                        {renderCard(item)}
                      </React.Fragment>
                    ) : (
                      <KanbanCard
                        key={item.id}
                        item={item}
                        onClick={onItemClick}
                        draggable={!!onItemMove}
                      />
                    ),
                  )
                )}
              </div>
            )}

            {footer && <div style={{ marginTop: 10 }}>{footer}</div>}
          </section>
        );
      })}
    </div>
  );
}

/**
 * Default card renderer. Used when the caller does not pass `renderCard`.
 * Exported in case a page wants to mix default + custom rendering.
 */
export function KanbanCard({
  item,
  onClick,
  draggable,
}: {
  item: KanbanItem;
  onClick?: (item: KanbanItem) => void;
  draggable?: boolean;
}) {
  const handleActivate = () => onClick?.(item);
  const content = (
    <>
      <div className="zui-kanban-card-head">
        <div className="zui-kanban-card-title">{item.title}</div>
        {item.badge && <div style={{ flex: 'none' }}>{item.badge}</div>}
      </div>
      {item.subtitle && <div className="zui-kanban-card-sub">{item.subtitle}</div>}
      {item.value && (
        <div className="zui-kanban-card-row">
          <span className="zui-kanban-card-value">{item.value}</span>
          {item.avatar}
        </div>
      )}
      {item.owner && (
        <div className="zui-kanban-card-foot">
          {item.avatar}
          <span>{item.owner}</span>
          {item.meta && <span className="zui-kanban-card-meta">{item.meta}</span>}
        </div>
      )}
      {!item.owner && item.meta && (
        <div className="zui-kanban-card-foot">
          <span className="zui-kanban-card-meta">{item.meta}</span>
        </div>
      )}
    </>
  );

  const commonProps = {
    className: 'zui-kanban-card',
    'data-testid': 'kanban-card' as const,
    'data-card-id': item.id,
    draggable: !!draggable,
    onDragStart: draggable
      ? (e: React.DragEvent) => {
          e.dataTransfer.setData('text/plain', item.id);
          e.dataTransfer.effectAllowed = 'move';
        }
      : undefined,
  };

  if (item.href) {
    return (
      <a href={item.href} {...commonProps} onClick={onClick ? handleActivate : undefined}>
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      {...commonProps}
      style={{ width: '100%', background: 'none' }}
      onClick={handleActivate}
    >
      {content}
    </button>
  );
}
