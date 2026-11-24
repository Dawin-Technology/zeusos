/**
 * GalleryLayout — smoke tests for the soft-skin gallery primitive.
 *
 * Covers: grid rendering, placeholder when no thumbnail, href-bearing
 * tiles render as anchors, button fallback for click handlers without
 * an href, badge rendering, empty-state, renderItem delegation, and
 * the columns marker on the wrapper.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GalleryLayout, type GalleryItem } from './GalleryLayout';

const ITEMS: GalleryItem[] = [
  {
    id: 'a',
    thumbnailUrl: 'https://example.com/a.jpg',
    title: 'Hero shot',
    subtitle: 'Odd Gorilla · HQ-2026',
    href: '/assets/a',
    badge: 'JPG',
    tone: 'accent',
  },
  {
    id: 'b',
    title: 'Pitch deck v4',
    subtitle: 'Zeus Digital',
    badge: 'PDF',
    tone: 'red',
  },
  {
    id: 'c',
    thumbnailUrl: 'https://example.com/c.mp4',
    title: 'Teaser cut',
    tone: 'green',
  },
];

describe('GalleryLayout', () => {
  it('renders one tile per item with the right id', () => {
    render(<GalleryLayout items={ITEMS} />);
    const tiles = screen.getAllByTestId('gallery-item');
    expect(tiles).toHaveLength(3);
    expect(tiles.map((t) => t.getAttribute('data-item-id'))).toEqual(['a', 'b', 'c']);
  });

  it('shows the placeholder when a tile has no thumbnailUrl', () => {
    render(<GalleryLayout items={ITEMS} />);
    const b = screen
      .getAllByTestId('gallery-item')
      .find((t) => t.getAttribute('data-item-id') === 'b');
    expect(b?.querySelector('img')).toBeNull();
    // Placeholder renders the first two characters of the title.
    expect(b?.textContent).toContain('PI');
  });

  it('renders an <img> when a tile has a thumbnailUrl', () => {
    render(<GalleryLayout items={ITEMS} />);
    const a = screen
      .getAllByTestId('gallery-item')
      .find((t) => t.getAttribute('data-item-id') === 'a');
    const img = a?.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://example.com/a.jpg');
  });

  it('renders an anchor when a tile has an href', () => {
    render(<GalleryLayout items={ITEMS} />);
    const a = screen
      .getAllByTestId('gallery-item')
      .find((t) => t.getAttribute('data-item-id') === 'a');
    expect(a?.tagName).toBe('A');
    expect(a?.getAttribute('href')).toBe('/assets/a');
  });

  it('falls back to a <button> when onItemClick is set and href is not', () => {
    const onItemClick = vi.fn();
    render(<GalleryLayout items={ITEMS} onItemClick={onItemClick} />);
    const b = screen
      .getAllByTestId('gallery-item')
      .find((t) => t.getAttribute('data-item-id') === 'b');
    expect(b?.tagName).toBe('BUTTON');
    fireEvent.click(b!);
    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onItemClick.mock.calls[0][0].id).toBe('b');
  });

  it('renders badges with the tone class', () => {
    render(<GalleryLayout items={ITEMS} />);
    const a = screen
      .getAllByTestId('gallery-item')
      .find((t) => t.getAttribute('data-item-id') === 'a');
    const badge = a?.querySelector('.zui-gal-badge');
    expect(badge).not.toBeNull();
    expect(badge!.className).toContain('tone-accent');
    expect(badge!.textContent).toBe('JPG');
  });

  it('shows the empty-state placeholder when no items are passed', () => {
    render(<GalleryLayout items={[]} emptyLabel="Nothing here yet." />);
    expect(screen.queryAllByTestId('gallery-item')).toHaveLength(0);
    const empty = screen.getByTestId('gallery-empty');
    expect(empty.textContent).toContain('Nothing here yet.');
  });

  it('delegates rendering when renderItem is provided', () => {
    render(
      <GalleryLayout
        items={ITEMS}
        renderItem={(it) => (
          <div data-testid="custom-tile" data-item-id={it.id}>
            {`#${it.id}`}
          </div>
        )}
      />,
    );
    expect(screen.queryAllByTestId('gallery-item')).toHaveLength(0);
    expect(screen.getAllByTestId('custom-tile')).toHaveLength(3);
  });

  it('writes the columns marker on the wrapper', () => {
    render(<GalleryLayout items={ITEMS} columns={3} testId="my-gallery" />);
    const wrapper = screen.getByTestId('my-gallery');
    expect(wrapper.getAttribute('data-columns')).toBe('3');
  });
});
