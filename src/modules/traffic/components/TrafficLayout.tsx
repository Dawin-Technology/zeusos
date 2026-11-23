/**
 * Phase 6.UI.B — Traffic module layout. Tabbed nav per the manifest:
 *   Routing Queue · Active IWOs · Brand Capacity · Override Log
 *
 * Shell re-skin PR 3: the raw Tailwind tab rail is replaced with the
 * soft-skin `.zeus-tabs` primitive so Traffic reads as a sibling of
 * the PR 2 Sales/Accounts cluster. `data-testid` on every tab is
 * preserved verbatim for Playwright.
 */

import { NavLink, Outlet } from 'react-router-dom';
import { PageHero } from '@/shared/components/refresh';

const TABS: { to: string; label: string; testId: string }[] = [
  { to: '/traffic',            label: 'Routing Queue',  testId: 'traffic-tab-queue' },
  { to: '/traffic/active',     label: 'Active IWOs',    testId: 'traffic-tab-active' },
  { to: '/traffic/capacity',   label: 'Brand Capacity', testId: 'traffic-tab-capacity' },
  { to: '/traffic/overrides',  label: 'Override Log',   testId: 'traffic-tab-overrides' },
];

export function TrafficLayout() {
  return (
    <div style={{ padding: 'var(--pad-page)' }} data-testid="traffic-layout">
      <PageHero
        eyebrow="Traffic"
        title="Routing & assignment"
        body="Brand-routing decisions for open master jobs. The engine proposes a serving brand; Traffic confirms or overrides before issuance. Conflict-walled candidates are excluded automatically."
      />

      <nav className="zeus-tabs" aria-label="Traffic tabs">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/traffic'}
            data-testid={t.testId}
            className={({ isActive }) => `zeus-tab${isActive ? ' active' : ''}`}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

export default TrafficLayout;
