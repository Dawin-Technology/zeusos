/**
 * KanbanLayout — smoke tests for the soft-skin kanban primitive.
 *
 * Covers: columns rendered with count, items grouped into their column,
 * empty columns keep the "Empty" placeholder, onItemClick fires, and
 * href-bearing items render as anchors. Styling lives in CSS and is
 * out of scope here — the unit tests target structure and behaviour.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { KanbanLayout, type KanbanColumn, type KanbanItem } from './KanbanLayout';

const COLUMNS: KanbanColumn[] = [
  { id: 'todo', title: 'To do' },
  { id: 'doing', title: 'Doing' },
  { id: 'done', title: 'Done' },
];

const ITEMS: KanbanItem[] = [
  { id: 'a', columnId: 'todo', title: 'Alpha', value: '$10k' },
  { id: 'b', columnId: 'doing', title: 'Bravo', subtitle: 'ACME Co', href: '/a/b' },
  { id: 'c', columnId: 'todo', title: 'Charlie', meta: 'Due tomorrow' },
];

describe('KanbanLayout', () => {
  it('renders one column per entry with the derived count', () => {
    render(<KanbanLayout columns={COLUMNS} items={ITEMS} />);

    const cols = screen.getAllByTestId('kanban-column');
    expect(cols).toHaveLength(3);
    expect(cols.map((c) => c.getAttribute('data-column-id'))).toEqual([
      'todo',
      'doing',
      'done',
    ]);
    // Count badge rendered inline with the title.
    expect(cols[0].textContent).toContain('To do');
    expect(cols[0].textContent).toContain('· 2');
    expect(cols[1].textContent).toContain('· 1');
    expect(cols[2].textContent).toContain('· 0');
  });

  it('groups cards into their columnId', () => {
    render(<KanbanLayout columns={COLUMNS} items={ITEMS} />);

    const cards = screen.getAllByTestId('kanban-card');
    expect(cards).toHaveLength(3);
    const idsByColumn = new Map<string, string[]>();
    for (const card of cards) {
      const col = card.closest('[data-testid="kanban-column"]');
      const colId = col?.getAttribute('data-column-id') ?? '';
      const list = idsByColumn.get(colId) ?? [];
      list.push(card.getAttribute('data-card-id') ?? '');
      idsByColumn.set(colId, list);
    }
    expect(idsByColumn.get('todo')?.sort()).toEqual(['a', 'c']);
    expect(idsByColumn.get('doing')).toEqual(['b']);
  });

  it('shows the empty placeholder for columns with no items', () => {
    render(<KanbanLayout columns={COLUMNS} items={ITEMS} />);
    const doneCol = screen
      .getAllByTestId('kanban-column')
      .find((c) => c.getAttribute('data-column-id') === 'done');
    expect(doneCol).toBeDefined();
    expect(doneCol!.textContent).toContain('Empty');
  });

  it('renders a link when an item has an href and keeps data-card-id', () => {
    render(<KanbanLayout columns={COLUMNS} items={ITEMS} />);
    const link = screen
      .getAllByTestId('kanban-card')
      .find((c) => c.getAttribute('data-card-id') === 'b');
    expect(link).toBeDefined();
    expect(link!.tagName).toBe('A');
    expect(link!.getAttribute('href')).toBe('/a/b');
  });

  it('fires onItemClick with the item payload when a card is clicked', () => {
    const onItemClick = vi.fn();
    render(<KanbanLayout columns={COLUMNS} items={ITEMS} onItemClick={onItemClick} />);

    const card = screen
      .getAllByTestId('kanban-card')
      .find((c) => c.getAttribute('data-card-id') === 'a');
    fireEvent.click(card!);
    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onItemClick.mock.calls[0][0].id).toBe('a');
  });

  it('delegates rendering when `renderCard` is provided', () => {
    render(
      <KanbanLayout
        columns={COLUMNS}
        items={ITEMS}
        renderCard={(it) => (
          <div data-testid="custom-card" data-card-id={it.id}>
            {`#${it.id}-${it.title}`}
          </div>
        )}
      />,
    );
    const custom = screen.getAllByTestId('custom-card');
    expect(custom).toHaveLength(3);
    expect(custom.map((c) => c.textContent)).toEqual([
      '#a-Alpha',
      '#c-Charlie',
      '#b-Bravo',
    ]);
  });

  it('attaches native drag listeners when onItemMove is provided', () => {
    const onItemMove = vi.fn();
    render(<KanbanLayout columns={COLUMNS} items={ITEMS} onItemMove={onItemMove} />);

    const card = screen
      .getAllByTestId('kanban-card')
      .find((c) => c.getAttribute('data-card-id') === 'a');
    expect(card?.getAttribute('draggable')).toBe('true');

    // Simulate a drop of 'a' onto the Done column.
    const doneCol = screen
      .getAllByTestId('kanban-column')
      .find((c) => c.getAttribute('data-column-id') === 'done')!;
    const dataTransfer = {
      getData: () => 'a',
      setData: () => undefined,
      dropEffect: 'move',
      effectAllowed: 'move',
    };
    fireEvent.dragOver(doneCol, { dataTransfer });
    fireEvent.drop(doneCol, { dataTransfer });

    expect(onItemMove).toHaveBeenCalledWith('a', 'done');
  });
});
