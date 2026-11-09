/**
 * SectionCard — a padded card with a title / optional subtitle / right-
 * aligned action slot, and a body. Used for dashboard sections (Brand
 * burn, Watch list, Pipeline funnel) and detail panels.
 */

import React from 'react';

export interface SectionCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** Remove the inner body padding (for tables, calendars). */
  flush?: boolean;
  /** Hover elevation. */
  hoverable?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function SectionCard({
  title,
  subtitle,
  action,
  flush = false,
  hoverable = false,
  className,
  children,
}: SectionCardProps) {
  return (
    <section
      className={[
        'zui-card',
        hoverable ? 'is-hoverable' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {(title || action) && (
        <div className="zui-card-head">
          <div style={{ minWidth: 0 }}>
            {title && <h3>{title}</h3>}
            {subtitle && <div className="zui-card-sub">{subtitle}</div>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div
        className={flush ? '' : 'zui-card-body'}
        style={flush ? undefined : (title ? undefined : { paddingTop: 'var(--pad-card, 20px)' })}
      >
        {children}
      </div>
    </section>
  );
}
