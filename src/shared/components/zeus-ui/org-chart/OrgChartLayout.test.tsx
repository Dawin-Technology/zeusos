/**
 * OrgChartLayout — smoke tests for the soft-skin org-chart primitive.
 *
 * Covers: tree traversal (every node rendered), node-id anchors, name
 * and title rendering, initials fallback, onNodeClick firing with the
 * raw node, renderNode delegation, and the orientation marker on the
 * wrapper.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrgChartLayout, type OrgNode } from './OrgChartLayout';

const TREE: OrgNode = {
  id: 'ceo',
  name: 'Alex Chen',
  title: 'CEO',
  children: [
    {
      id: 'coo',
      name: 'Blake Patel',
      title: 'COO',
      children: [
        { id: 'ops1', name: 'Casey Lee', title: 'Head of Ops' },
      ],
    },
    { id: 'cfo', name: 'Daria Volk', title: 'CFO' },
  ],
};

describe('OrgChartLayout', () => {
  it('renders every node in the tree', () => {
    render(<OrgChartLayout root={TREE} />);
    const nodes = screen.getAllByTestId('org-node');
    const ids = nodes.map((n) => n.getAttribute('data-node-id')).sort();
    expect(ids).toEqual(['ceo', 'cfo', 'coo', 'ops1']);
  });

  it('shows name and title on each card', () => {
    render(<OrgChartLayout root={TREE} />);
    const ceo = screen
      .getAllByTestId('org-node')
      .find((n) => n.getAttribute('data-node-id') === 'ceo');
    expect(ceo?.textContent).toContain('Alex Chen');
    expect(ceo?.textContent).toContain('CEO');
  });

  it('falls back to initials when avatarUrl is absent', () => {
    render(<OrgChartLayout root={TREE} />);
    const ceo = screen
      .getAllByTestId('org-node')
      .find((n) => n.getAttribute('data-node-id') === 'ceo');
    // "Alex Chen" → "AC"
    expect(ceo?.textContent).toContain('AC');
  });

  it('renders an img inside the avatar when avatarUrl is set', () => {
    const tree: OrgNode = {
      id: 'solo',
      name: 'Erin Oak',
      avatarUrl: 'https://example.com/erin.png',
    };
    render(<OrgChartLayout root={tree} />);
    const solo = screen.getByTestId('org-node');
    const img = solo.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://example.com/erin.png');
  });

  it('fires onNodeClick with the raw node payload', () => {
    const onNodeClick = vi.fn();
    render(<OrgChartLayout root={TREE} onNodeClick={onNodeClick} />);
    const coo = screen
      .getAllByTestId('org-node')
      .find((n) => n.getAttribute('data-node-id') === 'coo');
    fireEvent.click(coo!);
    expect(onNodeClick).toHaveBeenCalledTimes(1);
    expect(onNodeClick.mock.calls[0][0].id).toBe('coo');
  });

  it('wraps each card in a <button> when onNodeClick is provided', () => {
    render(<OrgChartLayout root={TREE} onNodeClick={() => {}} />);
    const ceo = screen
      .getAllByTestId('org-node')
      .find((n) => n.getAttribute('data-node-id') === 'ceo');
    expect(ceo?.tagName).toBe('BUTTON');
  });

  it('delegates rendering when renderNode is provided', () => {
    render(
      <OrgChartLayout
        root={TREE}
        renderNode={(n) => (
          <div data-testid="custom-node" data-node-id={n.id}>
            {`#${n.id}`}
          </div>
        )}
      />,
    );
    expect(screen.queryAllByTestId('org-node')).toHaveLength(0);
    expect(screen.getAllByTestId('custom-node')).toHaveLength(4);
  });

  it('writes the orientation marker on the wrapper', () => {
    const { rerender } = render(
      <OrgChartLayout root={TREE} orientation="horizontal" testId="my-tree" />,
    );
    expect(screen.getByTestId('my-tree').getAttribute('data-orientation')).toBe(
      'horizontal',
    );
    rerender(<OrgChartLayout root={TREE} testId="my-tree" />);
    expect(screen.getByTestId('my-tree').getAttribute('data-orientation')).toBe(
      'vertical',
    );
  });
});
