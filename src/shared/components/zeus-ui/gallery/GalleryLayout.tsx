/**
 * GalleryLayout — soft-skin responsive thumbnail grid.
 *
 * Presentational gallery for media assets, campaign deliverables and
 * headshots. Thumbnail-first; the caller supplies the URLs. Clicking
 * a tile navigates to `href` (when set) or fires `onItemClick`.
 *
 * All styling is scoped under `[data-skin="soft"]` via
 * `./GalleryLayout.css`; elements rendered outside the soft shell
 * inherit no visual rules from this primitive.
 *
 * Playwright-safe anchors:
 *   - the grid root carries `data-testid="gallery-grid"` (overridable
 *     via `testId`)
 *   - each tile carries `data-testid="gallery-item"` + `data-item-id`
 */

import React from 'react';
import './GalleryLayout.css';

export type GalleryTone = 'neutral' | 'accent' | 'amber' | 'red' | 'green';

export interface GalleryItem {
  id: string;
  /** Primary image source. Falls back to the placeholder tile. */
  thumbnailUrl?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Tone drives the badge tint. */
  tone?: GalleryTone;
  /** Right-aligned chip over the thumbnail (e.g. "PDF", "VIDEO"). */
  badge?: React.ReactNode;
  /** Overlaid content (owner avatar + name, meta row). */
  overlay?: React.ReactNode;
  href?: string;
  /** Opaque passthrough for `renderItem` / `onItemClick`. */
  payload?: unknown;
}

export interface GalleryLayoutProps {
  items: GalleryItem[];
  /**
   * Target column count at the widest breakpoint. The grid scales
   * down to 3 → 2 → 1 as the viewport narrows.
   * Defaults to 4.
   */
  columns?: number;
  onItemClick?: (item: GalleryItem) => void;
  /** Full item renderer override. Receives the raw GalleryItem. */
  renderItem?: (item: GalleryItem) => React.ReactNode;
  /** Overlay renderer override. Called only when the item has no own overlay. */
  renderOverlay?: (item: GalleryItem) => React.ReactNode;
  /** Shown when `items` is empty. */
  emptyLabel?: React.ReactNode;
  /** Appended as `data-testid` on the grid wrapper. */
  testId?: string;
  className?: string;
}

/**
 * Soft-skin gallery. All styling is scoped under `[data-skin="soft"]` —
 * elements rendered outside the soft shell inherit no visual rules
 * from this primitive (safe to mount anywhere).
 */
export function GalleryLayout({
  items,
  columns = 4,
  onItemClick,
  renderItem,
  renderOverlay,
  emptyLabel = 'No items yet.',
  testId = 'gallery-grid',
  className,
}: GalleryLayoutProps) {
  const style = {
    ['--zui-gal-cols' as const]: String(Math.max(1, Math.min(8, columns))),
  } as React.CSSProperties;

  return (
    <div
      className={['zui-gal', className ?? ''].filter(Boolean).join(' ')}
      style={style}
      data-testid={testId}
      data-columns={columns}
    >
      {items.length === 0 ? (
        <div className="zui-gal-empty" data-testid="gallery-empty">
          {emptyLabel}
        </div>
      ) : (
        items.map((item) =>
          renderItem ? (
            <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>
          ) : (
            <GalleryTile
              key={item.id}
              item={item}
              onClick={onItemClick}
              renderOverlay={renderOverlay}
            />
          ),
        )
      )}
    </div>
  );
}

/**
 * Default tile renderer. Exported in case a page wants to mix default
 * and custom rendering.
 */
export function GalleryTile({
  item,
  onClick,
  renderOverlay,
}: {
  item: GalleryItem;
  onClick?: (item: GalleryItem) => void;
  renderOverlay?: (item: GalleryItem) => React.ReactNode;
}) {
  const tone = item.tone ?? 'neutral';
  const overlay = item.overlay ?? renderOverlay?.(item);
  const body = (
    <>
      <div className="zui-gal-thumb">
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <div className="zui-gal-thumb-ph" aria-hidden="true">
            <span>{typeof item.title === 'string' ? item.title.slice(0, 2).toUpperCase() : '··'}</span>
          </div>
        )}
        {item.badge && (
          <div className={`zui-gal-badge tone-${tone}`}>{item.badge}</div>
        )}
        {overlay && <div className="zui-gal-overlay">{overlay}</div>}
      </div>
      <div className="zui-gal-meta">
        <div className="zui-gal-title">{item.title}</div>
        {item.subtitle && <div className="zui-gal-sub">{item.subtitle}</div>}
      </div>
    </>
  );

  const commonProps = {
    className: 'zui-gal-item',
    'data-testid': 'gallery-item' as const,
    'data-item-id': item.id,
  };

  if (item.href) {
    return (
      <a
        {...commonProps}
        href={item.href}
        onClick={onClick ? () => onClick(item) : undefined}
      >
        {body}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" {...commonProps} onClick={() => onClick(item)}>
        {body}
      </button>
    );
  }
  return <div {...commonProps}>{body}</div>;
}
