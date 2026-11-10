/**
 * SoftSidebarRail — DawinOS soft-skin icon rail (PR 1b).
 *
 * The rail is the ZeusOS production sidebar. It renders as a 72px fixed
 * column with rounded icon surfaces that float above the canvas; hovering
 * an item slides a label pill out from its 3 o'clock edge, and the
 * rail's own toggle widens it to 232px with inline labels beside each
 * icon. Nav items are sourced from the already-resolved manifest via
 * `AppShell` and a section grouping provided by the parent. All visuals
 * are gated under `<html data-skin="soft">` through the CSS primitives
 * in `src/shared/components/zeus-ui/shell.css`.
 */

import { Fragment } from 'react';
import { ChevronDown, PanelLeftClose, PanelLeftOpen, LogOut, User, Settings, Palette, Check } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getIconByName } from '@/shared/utils/iconMap';
import { cn } from '@/shared/lib/utils';
import type { NavItem } from '@/config/navigation.unified';
import type { NavStatus } from '@/core/navigation/manifest';
import { isConflictIsolated } from '@/core/settings/brand-capabilities';
import type { SubsidiaryId } from '@/core/settings/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/core/components/ui/tooltip';
import { PreferencesMenu } from '@/core/components/layout/PreferencesMenu';
import type { Subsidiary } from '@/types/subsidiary';

export interface SoftSidebarRailSection {
  id: string;
  label: string;
  items: NavItem[];
}

export interface SoftSidebarRailUser {
  initials: string;
  displayName?: string | null;
  email?: string | null;
  roleLabel: string;
}

export interface SoftSidebarRailProps {
  sections: SoftSidebarRailSection[];
  expanded: boolean;
  onToggleExpanded: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  subsidiaries: Subsidiary[];
  currentSubsidiary: Subsidiary | null;
  isParentRoot: boolean;
  onSelectSubsidiary: (sub: Subsidiary) => void;
  user: SoftSidebarRailUser;
  adminEnabled: boolean;
  onSignOut: () => void;
  onNavigate?: () => void;
  isDesktop: boolean;
}

export function SoftSidebarRail({
  sections,
  expanded,
  onToggleExpanded,
  mobileOpen,
  onMobileClose,
  subsidiaries,
  currentSubsidiary,
  isParentRoot,
  onSelectSubsidiary,
  user,
  adminEnabled,
  onSignOut,
  onNavigate,
  isDesktop,
}: SoftSidebarRailProps) {
  const location = useLocation();
  // Mobile: force expanded (drawer-style) so labels are always readable.
  const effectivelyExpanded = isDesktop ? expanded : true;

  const isActive = (href: string) => {
    if (href === '/' || href === '/dashboard') return location.pathname === href;
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const currentCode =
    currentSubsidiary?.shortName?.slice(0, 2).toUpperCase() ?? 'ZG';

  const handleItemClick = () => {
    if (!isDesktop) onMobileClose();
    onNavigate?.();
  };

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={500}>
      <aside
        className="zeus-rail"
        data-testid="unified-sidebar"
        data-expanded={effectivelyExpanded ? 'true' : 'false'}
        data-mobile-open={mobileOpen ? 'true' : 'false'}
        aria-label="Primary navigation"
      >
        {/* Brand mark */}
        <div className="zeus-rail-brand">
          <span className="logo" aria-hidden="true">Z</span>
          <span className="name">
            <b>ZeusOS</b>
            <span>{isParentRoot ? 'Zeus Group' : currentSubsidiary?.name ?? 'Workspace'}</span>
          </span>
        </div>

        {/* Org switcher chip */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="zeus-rail-org"
              aria-label="Switch organisation"
              data-testid="rail-org-switcher"
            >
              <span
                className="dot"
                style={{
                  background: currentSubsidiary?.color || 'var(--zeus-navy)',
                  color: (currentSubsidiary as { ink?: string } | null)?.ink ?? '#fff',
                }}
              >
                {currentCode}
              </span>
              <span className="label">
                {currentSubsidiary?.name ?? 'Zeus Group'}
              </span>
              <ChevronDown className="chev h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-60" sideOffset={8}>
            <div className="px-2 py-1.5 text-[10.5px] uppercase tracking-wider text-[var(--fg-tertiary)] font-semibold">
              Switch organisation
            </div>
            <DropdownMenuSeparator />
            {subsidiaries
              .filter((s) => s.status === 'active')
              .map((sub) => {
                const active = sub.id === currentSubsidiary?.id;
                const isolated = isConflictIsolated(sub.id as SubsidiaryId);
                return (
                  <DropdownMenuItem
                    key={sub.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectSubsidiary(sub);
                    }}
                    className="gap-2.5 py-2"
                  >
                    <span
                      className="inline-block rounded-full h-2.5 w-2.5 shrink-0"
                      style={{ background: sub.color }}
                    />
                    <span className="flex-1 min-w-0 truncate text-[13px]">{sub.name}</span>
                    {isolated && (
                      <span
                        className="text-[9.5px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(230,91,102,0.18)', color: '#cf4b54' }}
                        data-testid="rail-org-isolation-badge"
                      >
                        Iso
                      </span>
                    )}
                    {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Nav items */}
        <nav className="zeus-rail-nav" aria-label="Sections">
          {sections.map((section, idx) =>
            section.items.length === 0 ? null : (
              <Fragment key={section.id}>
                {effectivelyExpanded && idx > 0 && <div className="zeus-rail-eyebrow">{section.label}</div>}
                {effectivelyExpanded && idx === 0 && section.label && (
                  <div className="zeus-rail-eyebrow">{section.label}</div>
                )}
                {section.items.map((item) => (
                  <RailNavButton
                    key={item.id}
                    item={item}
                    active={isActive(item.href) || !!item.children?.some((c) => isActive(c.href))}
                    onClick={handleItemClick}
                    showTooltip={!effectivelyExpanded}
                  />
                ))}
              </Fragment>
            ),
          )}
        </nav>

        {/* Footer: toggle + user */}
        <div className="zeus-rail-foot">
          {isDesktop && (
            <button
              type="button"
              className="zeus-rail-toggle"
              onClick={onToggleExpanded}
              aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
              data-testid="rail-expand-toggle"
            >
              {expanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="zeus-rail-user"
                aria-label="Account menu"
                data-testid="rail-account-menu"
              >
                {user.initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="w-56" sideOffset={8}>
              <div className="px-2 py-1.5">
                <div className="text-[13px] font-medium text-[var(--fg-primary)] truncate">
                  {user.displayName ?? 'User'}
                </div>
                <div className="text-[11px] text-[var(--fg-tertiary)] truncate">{user.email}</div>
                <div className="text-[10.5px] text-[var(--fg-quaternary)] uppercase tracking-wide mt-1">
                  {user.roleLabel}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">
                  <User className="mr-2 h-3.5 w-3.5" /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings/appearance">
                  <Palette className="mr-2 h-3.5 w-3.5" /> Appearance
                </Link>
              </DropdownMenuItem>
              {adminEnabled && (
                <DropdownMenuItem asChild>
                  <Link to="/admin">
                    <Settings className="mr-2 h-3.5 w-3.5" /> Admin
                  </Link>
                </DropdownMenuItem>
              )}
              <PreferencesMenu />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onSignOut}
                data-testid="logout-button"
                className="text-[var(--rag-red)] focus:text-[var(--rag-red)]"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {!isDesktop && (
        <button
          type="button"
          className="zeus-rail-scrim"
          data-open={mobileOpen ? 'true' : 'false'}
          aria-hidden={mobileOpen ? 'false' : 'true'}
          aria-label="Close navigation"
          onClick={onMobileClose}
          tabIndex={mobileOpen ? 0 : -1}
        />
      )}
    </TooltipProvider>
  );
}

interface RailNavButtonProps {
  item: NavItem;
  active: boolean;
  onClick: () => void;
  showTooltip: boolean;
}

function RailNavButton({ item, active, onClick, showTooltip }: RailNavButtonProps) {
  const Icon = getIconByName(item.icon);
  const planned = (item as { status?: NavStatus }).status === 'planned';
  const label = item.label;

  // Collapsed mode uses the portaled Radix tooltip to avoid being clipped
  // by the nav's `overflow-y: auto` scroll container. In expanded mode the
  // label sits inline, so we drop the tooltip to avoid double-labelling.
  const link = (
    <Link
      to={item.href}
      className={cn('zeus-rail-item', active && 'active')}
      data-testid={`nav-${item.id}`}
      onClick={onClick}
      style={planned ? { opacity: 0.75 } : undefined}
      aria-label={label}
      title={showTooltip ? undefined : label}
    >
      {Icon ? <Icon className="icon h-4 w-4" aria-hidden="true" /> : null}
      <span className="inline-label">{label}</span>
      {item.badge != null && typeof item.badge !== 'object' && (
        <span className="count">{item.badge}</span>
      )}
    </Link>
  );

  if (!showTooltip) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="zeus-rail-tooltip">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
