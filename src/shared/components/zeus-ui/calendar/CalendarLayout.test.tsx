/**
 * CalendarLayout — smoke tests for the soft-skin calendar primitive.
 *
 * Covers the structure contract: week-view lays out 7 days, events
 * slot into the right day, href-bearing events render as anchors, the
 * "today" cell is tagged, onDayClick fires, renderEvent delegates
 * rendering, and the month-view overflow is counted.
 */

import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  CalendarLayout,
  type CalendarEvent,
} from './CalendarLayout';

const EVENTS: CalendarEvent[] = [
  { id: 'a', start: '2026-03-02', title: 'Alpha', tone: 'accent' },
  { id: 'b', start: '2026-03-03', end: '2026-03-05', title: 'Bravo', href: '/plans/b' },
  { id: 'c', start: '2026-03-02', title: 'Charlie', subtitle: 'half-day' },
];

describe('CalendarLayout (week view)', () => {
  it('renders 7 day cells around the anchor date', () => {
    render(<CalendarLayout view="week" anchorDate="2026-03-04" items={[]} />);
    expect(screen.getAllByTestId('calendar-day')).toHaveLength(7);
  });

  it('places single-day events into their own day', () => {
    render(<CalendarLayout view="week" anchorDate="2026-03-04" items={EVENTS} />);
    const alphaDay = screen
      .getAllByTestId('calendar-day')
      .find((d) => d.getAttribute('data-day') === '2026-03-02');
    expect(alphaDay).toBeDefined();
    const alphaEvent = alphaDay!.querySelector('[data-event-id="a"]');
    expect(alphaEvent).not.toBeNull();
    expect(alphaEvent!.textContent).toContain('Alpha');
  });

  it('spans multi-day events across every day in the range', () => {
    render(<CalendarLayout view="week" anchorDate="2026-03-04" items={EVENTS} />);
    const bravos = screen.getAllByTestId('calendar-event').filter((n) =>
      n.getAttribute('data-event-id') === 'b',
    );
    // 3rd, 4th, 5th
    expect(bravos.length).toBe(3);
  });

  it('renders an anchor when an event has an href', () => {
    render(<CalendarLayout view="week" anchorDate="2026-03-04" items={EVENTS} />);
    const bravo = screen.getAllByTestId('calendar-event').find((n) =>
      n.getAttribute('data-event-id') === 'b',
    );
    expect(bravo?.tagName).toBe('A');
    expect(bravo?.getAttribute('href')).toBe('/plans/b');
  });

  it('fires onItemClick with the raw event payload', () => {
    const onItemClick = vi.fn();
    render(
      <CalendarLayout
        view="week"
        anchorDate="2026-03-04"
        items={EVENTS}
        onItemClick={onItemClick}
      />,
    );
    const alpha = screen
      .getAllByTestId('calendar-event')
      .find((n) => n.getAttribute('data-event-id') === 'a');
    fireEvent.click(alpha!);
    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onItemClick.mock.calls[0][0].id).toBe('a');
  });

  it('fires onDayClick with the ISO date when a day cell is clicked', () => {
    const onDayClick = vi.fn();
    render(
      <CalendarLayout
        view="week"
        anchorDate="2026-03-04"
        items={[]}
        onDayClick={onDayClick}
      />,
    );
    const day = screen
      .getAllByTestId('calendar-day')
      .find((d) => d.getAttribute('data-day') === '2026-03-02');
    fireEvent.click(day!);
    expect(onDayClick).toHaveBeenCalledWith('2026-03-02');
  });

  it('delegates rendering when renderEvent is provided', () => {
    render(
      <CalendarLayout
        view="week"
        anchorDate="2026-03-04"
        items={EVENTS}
        renderEvent={(ev) => (
          <div data-testid="custom-event" data-event-id={ev.id}>
            {`#${ev.id}`}
          </div>
        )}
      />,
    );
    const custom = screen.getAllByTestId('custom-event');
    // "b" renders on 3 days + "a" + "c" → 5 custom nodes.
    expect(custom.length).toBe(5);
  });
});

describe('CalendarLayout (month view)', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15)); // 2026-03-15 to pin "today"
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('tags the cell matching today', () => {
    render(<CalendarLayout view="month" anchorDate="2026-03-15" items={[]} />);
    const today = screen
      .getAllByTestId('calendar-day')
      .find((d) => d.getAttribute('data-day') === '2026-03-15');
    expect(today?.className).toContain('is-today');
  });

  it('shows "+N more" when a day has more events than maxEventsPerDay', () => {
    const many: CalendarEvent[] = Array.from({ length: 6 }, (_, i) => ({
      id: `e${i}`,
      start: '2026-03-10',
      title: `Event ${i}`,
    }));
    render(
      <CalendarLayout
        view="month"
        anchorDate="2026-03-15"
        items={many}
        maxEventsPerDay={3}
      />,
    );
    const march10 = screen
      .getAllByTestId('calendar-day')
      .find((d) => d.getAttribute('data-day') === '2026-03-10');
    expect(march10?.textContent).toContain('+3 more');
  });

  it('mutes days from the adjacent month', () => {
    render(<CalendarLayout view="month" anchorDate="2026-03-15" items={[]} />);
    // Feb has 28 days in 2026; March 1 is a Sunday, so weekStartsOn:1 pulls
    // Feb 23-28 into the leading row.
    const feb28 = screen
      .getAllByTestId('calendar-day')
      .find((d) => d.getAttribute('data-day') === '2026-02-28');
    expect(feb28).toBeDefined();
    expect(feb28?.className).toContain('is-muted');
  });
});
