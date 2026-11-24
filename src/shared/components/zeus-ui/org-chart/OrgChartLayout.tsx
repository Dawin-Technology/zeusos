/**
 * OrgChartLayout — soft-skin tree-shaped org chart.
 *
 * Presentational tree of compressed `.zeus-panel` cards wired by CSS
 * connector lines (no SVG). Nodes can have any number of children;
 * collapsing a subtree is the caller's job (pass a trimmed tree in).
 *
 * All styling is scoped under `[data-skin="soft"]` via
 * `./OrgChartLayout.css`; elements rendered outside the soft shell
 * inherit no visual rules from this primitive.
 *
 * Playwright-safe anchors:
 *   - the root carries `data-testid="org-chart"` (overridable via
 *     `testId`)
 *   - each node card carries `data-testid="org-node"` + `data-node-id`
 */

import React from 'react';
import './OrgChartLayout.css';

export interface OrgNode {
  id: string;
  name: React.ReactNode;
  /** Role / title shown under the name. */
  title?: React.ReactNode;
  /** Right-aligned chip (department, brand, status pill, …). */
  badge?: React.ReactNode;
  /** Image URL for the avatar square; falls back to initialsOf(name). */
  avatarUrl?: string;
  /** Opaque passthrough for `renderNode` / `onNodeClick`. */
  payload?: unknown;
  children?: OrgNode[];
}

export type OrgChartOrientation = 'vertical' | 'horizontal';

export interface OrgChartLayoutProps {
  root: OrgNode;
  /**
   * Vertical: parents above children (default — reads top-to-bottom).
   * Horizontal: parents left of children (reads left-to-right).
   */
  orientation?: OrgChartOrientation;
  /** Click handler on a node card. Called on Enter/Space too via the button role. */
  onNodeClick?: (node: OrgNode) => void;
  /** Full node renderer override. Receives the raw OrgNode. */
  renderNode?: (node: OrgNode) => React.ReactNode;
  /** Appended as `data-testid` on the wrapper. */
  testId?: string;
  className?: string;
}

function initialsFromText(name: React.ReactNode): string {
  if (typeof name !== 'string') return '·';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase() || '·';
}

/**
 * Soft-skin org chart. All styling is scoped under `[data-skin="soft"]` —
 * elements rendered outside the soft shell inherit no visual rules
 * from this primitive (safe to mount anywhere).
 */
export function OrgChartLayout({
  root,
  orientation = 'vertical',
  onNodeClick,
  renderNode,
  testId = 'org-chart',
  className,
}: OrgChartLayoutProps) {
  return (
    <div
      className={['zui-org', `zui-org-${orientation}`, className ?? '']
        .filter(Boolean)
        .join(' ')}
      data-testid={testId}
      data-orientation={orientation}
    >
      <OrgSubtree node={root} onNodeClick={onNodeClick} renderNode={renderNode} />
    </div>
  );
}

function OrgSubtree({
  node,
  onNodeClick,
  renderNode,
}: {
  node: OrgNode;
  onNodeClick?: (node: OrgNode) => void;
  renderNode?: (node: OrgNode) => React.ReactNode;
}) {
  const kids = node.children ?? [];
  return (
    <div className="zui-org-subtree">
      <div className="zui-org-node-slot">
        {renderNode ? (
          <>{renderNode(node)}</>
        ) : (
          <OrgNodeCard node={node} onClick={onNodeClick} />
        )}
      </div>
      {kids.length > 0 && (
        <div className="zui-org-children">
          {kids.map((kid) => (
            <OrgSubtree
              key={kid.id}
              node={kid}
              onNodeClick={onNodeClick}
              renderNode={renderNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Default node card. Exported so callers can mix default + custom
 * rendering (e.g. pass `renderNode` for a subset and reuse this for
 * the rest).
 */
export function OrgNodeCard({
  node,
  onClick,
}: {
  node: OrgNode;
  onClick?: (node: OrgNode) => void;
}) {
  const content = (
    <>
      <div className="zui-org-avatar" aria-hidden="true">
        {node.avatarUrl ? (
          <img src={node.avatarUrl} alt="" />
        ) : (
          <span>{initialsFromText(node.name)}</span>
        )}
      </div>
      <div className="zui-org-body">
        <div className="zui-org-name">{node.name}</div>
        {node.title && <div className="zui-org-title">{node.title}</div>}
      </div>
      {node.badge && <div className="zui-org-badge">{node.badge}</div>}
    </>
  );

  const commonProps = {
    className: 'zui-org-node',
    'data-testid': 'org-node' as const,
    'data-node-id': node.id,
  };

  if (onClick) {
    return (
      <button type="button" {...commonProps} onClick={() => onClick(node)}>
        {content}
      </button>
    );
  }
  return <div {...commonProps}>{content}</div>;
}
