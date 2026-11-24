/**
 * CalendarLayout — soft-skin calendar primitive.
 *
 * Presentational month / week / day grid with pill-shaped events.
 * All behaviour (date math beyond laying out the grid, event resolution,
 * drag-to-reschedule) is delegated to callers — the component just
 * renders an anchor-dated grid of dates and places events on it.
 *
 * All styling is scoped under `[data-skin="soft"]` via
 * `./CalendarLayout.css`; elements rendered outside the soft shell
 * inherit no visual rules from this primitive.
 *
 * Playwright-safe anchors:
 *   - the grid root carries `data-testid="calendar-grid"` (overridable
 *     via `testId`)
 *   - each day cell carries `data-testid="calendar-day"` +
 *     `data-day="YYYY-MM-DD"`
 *   - each event carries `data-testid="calendar-event"` +
 *     `data-event-id`
 */

import React from 'react';
import './CalendarLayout.css';

export type CalendarView = 'month' | 'week' | 'day';
export type CalendarTone = 'neutral' | 'accent' | 'amber' | 'red' | 'green';

export interface CalendarEvent {
  id: string;
  /** Inclusive start (YYYY-MM-DD or ISO Date-time). */
  start: string;
  /** Inclusive end; defaults to start when omitted. */
  end?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: CalendarTone;
  owner?: React.ReactNode;
  href?: string;
  /** Opaque passthrough for `renderEvent` / `onItemClick`. */
  payload?: unknown;
}

export interface CalendarLayoutProps {
  items: CalendarEvent[];
  view?: CalendarView;
  /** Any date inside the window to render (YYYY-MM-DD). Defaults to today. */
  anchorDate?: string;
  /** Click/activate handler for an event pill. */
  onItemClick?: (event: CalendarEvent) => void;
  /** Click handler for an empty day cell (returns the YYYY-MM-DD). */
  onDayClick?: (dayIso: string) => void;
  /** Full event renderer override. Receives the raw CalendarEvent. */
  renderEvent?: (event: CalendarEvent) => React.ReactNode;
  /** Week starts on Monday by default; set to 0 for Sunday. */
  weekStartsOn?: 0 | 1;
  /** Max visible events per day in month view before "+N more". */
  maxEventsPerDay?: number;
  /** Appended as `data-testid` on the grid wrapper. */
  testId?: string;
  className?: string;
}

const DOW_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseIsoDate(iso: string): Date {
  // Treat bare YYYY-MM-DD as local midnight to avoid TZ drift at day boundaries.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(iso);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(d.getDate() + n);
  return out;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeek(d: Date, weekStartsOn: 0 | 1): Date {
  const dow = d.getDay(); // 0 = Sun
  const diff = weekStartsOn === 1 ? (dow === 0 ? -6 : 1 - dow) : -dow;
  return addDays(d, diff);
}

/**
 * Soft-skin calendar layout. All styling is scoped under
 * `[data-skin="soft"]` — elements rendered outside the soft shell inherit
 * no visual rules from this primitive (safe to mount anywhere).
 */
export function CalendarLayout({
  items,
  view = 'month',
  anchorDate,
  onItemClick,
  onDayClick,
  renderEvent,
  weekStartsOn = 1,
  maxEventsPerDay = 3,
  testId = 'calendar-grid',
  className,
}: CalendarLayoutProps) {
  const anchor = anchorDate ? parseIsoDate(anchorDate) : new Date();

  // Build the list of days to render.
  const days = React.useMemo<Date[]>(() => {
    if (view === 'day') return [anchor];
    if (view === 'week') {
      const start = startOfWeek(anchor, weekStartsOn);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const firstOfMonth = startOfMonth(anchor);
    const lastOfMonth = endOfMonth(anchor);
    const gridStart = startOfWeek(firstOfMonth, weekStartsOn);
    const list: Date[] = [];
    let cursor = gridStart;
    // Fill until we're past the end of the month AND on a week boundary.
    while (cursor <= lastOfMonth || list.length % 7 !== 0 || list.length < 7) {
      list.push(cursor);
      cursor = addDays(cursor, 1);
      if (list.length >= 42) break;
    }
    return list;
  }, [anchor, view, weekStartsOn]);

  // Pre-bucket events by ISO day for quick lookup.
  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of items) {
      const startDate = parseIsoDate(ev.start);
      const endDate = ev.end ? parseIsoDate(ev.end) : startDate;
      // Clamp iteration to a sensible window (never more than 365 days per event).
      let d = startDate;
      let safety = 0;
      while (d <= endDate && safety < 366) {
        const key = toIsoDate(d);
        const bucket = map.get(key) ?? [];
        bucket.push(ev);
        map.set(key, bucket);
        d = addDays(d, 1);
        safety += 1;
      }
    }
    return map;
  }, [items]);

  const dowLabels = weekStartsOn === 1 ? DOW_MON : DOW_SUN;
  const anchorMonth = anchor.getMonth();
  const todayIso = toIsoDate(new Date());

  const gridClass = [
    'zui-cal',
    `zui-cal-${view}`,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={gridClass} data-testid={testId} data-view={view}>
      {view !== 'day' && (
        <div className="zui-cal-dow" aria-hidden="true">
          {dowLabels.map((lbl) => (
            <div key={lbl} className="zui-cal-dow-cell">{lbl}</div>
          ))}
        </div>
      )}
      <div className="zui-cal-body">
        {days.map((d) => {
          const iso = toIsoDate(d);
          const inAnchorMonth = view === 'month' ? d.getMonth() === anchorMonth : true;
          const isToday = iso === todayIso;
          const dayEvents = byDay.get(iso) ?? [];
          const visible =
            view === 'month'
              ? dayEvents.slice(0, maxEventsPerDay)
              : dayEvents;
          const overflow =
            view === 'month' && dayEvents.length > visible.length
              ? dayEvents.length - visible.length
              : 0;

          return (
            <div
              key={iso}
              className={[
                'zui-cal-day',
                inAnchorMonth ? '' : 'is-muted',
                isToday ? 'is-today' : '',
                onDayClick ? 'is-interactive' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-testid="calendar-day"
              data-day={iso}
              onClick={onDayClick ? () => onDayClick(iso) : undefined}
            >
              <div className="zui-cal-day-head">
                <span className="zui-cal-day-num">{d.getDate()}</span>
                {view === 'day' && (
                  <span className="zui-cal-day-label">
                    {d.toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>
              <div className="zui-cal-day-events">
                {visible.map((ev) =>
                  renderEvent ? (
                    <React.Fragment key={`${ev.id}-${iso}`}>
                      {renderEvent(ev)}
                    </React.Fragment>
                  ) : (
                    <CalendarEventPill
                      key={`${ev.id}-${iso}`}
                      event={ev}
                      onClick={onItemClick}
                    />
                  ),
                )}
                {overflow > 0 && (
                  <div className="zui-cal-overflow">+{overflow} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Default event pill. Exported so callers can mix default + custom
 * rendering (e.g. pass `renderEvent` for a subset and reuse this for
 * the rest).
 */
export function CalendarEventPill({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
}) {
  const tone = event.tone ?? 'accent';
  const content = (
    <>
      <span className="zui-cal-event-title">{event.title}</span>
      {event.subtitle && (
        <span className="zui-cal-event-sub">{event.subtitle}</span>
      )}
    </>
  );
  const commonProps = {
    className: `zui-cal-event tone-${tone}`,
    'data-testid': 'calendar-event' as const,
    'data-event-id': event.id,
  };

  if (event.href) {
    return (
      <a
        {...commonProps}
        href={event.href}
        onClick={onClick ? () => onClick(event) : undefined}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      {...commonProps}
      onClick={() => onClick?.(event)}
    >
      {content}
    </button>
  );
}
