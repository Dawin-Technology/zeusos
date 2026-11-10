/**
 * AppShell Component
 * Main application layout with sidebar and header
 * Enhanced with command palette and improved navigation UX
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  LogOut,
  User,
  Check,
  LucideIcon,
  Building2,
  Settings,
  ChevronRight,
  Palette,
  Plus,
  Briefcase,
  Tag,
  FileText,
  Star as StarIcon,
  ShoppingCart,
  Megaphone,
  Target,
} from 'lucide-react';
import { getIconByName } from '@/shared/utils/iconMap';
import { Button } from '@/core/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import { useUIStore } from '@/shared/stores/uiStore';
import { OfflineBanner } from '@/shared/components/offline/OfflineBanner';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useNavigationStore } from '@/shared/stores/navigationStore';
import { CommandPalette } from '@/core/components/navigation/CommandPalette';
import { SearchIndexMount } from '@/core/components/search/SearchIndexMount';
import { MyTasksProvider } from '@/modules/intelligence-layer/context/MyTasksContext';
import { TeamChannelsProvider, useTeamChannels } from '@/modules/messaging/context/TeamChannelsContext';
import { ChatDock, ChatDockProvider, dockReservedRight, useChatDock } from '@/modules/messaging/components/chat-dock';
import { ActionQueueProvider, useActionQueue } from '@/modules/intelligence-layer/components/action-center';
import { ContextRail, RailTrigger, useRailMode, useRailShortcut, useShellTop } from './context-rail';
import { useRailStore } from '@/shared/stores/railStore';
import { ToastHost } from '@/shared/components/feedback/ToastHost';
import {
  getAllCommandItems,
  AGENCY_NAVIGATION,
  COMMERCIAL_NAVIGATION,
  CORPORATE_NAVIGATION,
  UTILITY_NAVIGATION,
  ADMIN_NAVIGATION,
  filterNavigationByAccess,
  type NavItem,
} from '@/config/navigation.unified';
import { adaptManifestToLegacyNavItem, resolveNav, type NavStatus } from '@/core/navigation/manifest';
import { isParentOrgPrincipal as resolveIsParentOrgPrincipal } from '@/core/settings/org-kind';
import type { SubsidiaryId } from '@/core/settings/types';
import { useUserModules } from '@/hooks/useUserModules';
import { AIIntelligenceMenu } from '@/modules/intelligence-layer/components/AIIntelligenceMenu';
import { cn } from '@/shared/lib/utils';
import { useBranding } from '@/shared/hooks/useBranding';
// WhatsApp + GChat modules removed in Phase 1.C — stub subscriptions.
// TODO Phase 4: rebuild client comms (WhatsApp/Slack) for marketing-agency context.
import { GroupNavPills } from '@/core/components/layout/GroupNavPills';
import { PreferencesMenu } from '@/core/components/layout/PreferencesMenu';
import { SoftSidebarRail, type SoftSidebarRailSection } from '@/core/components/layout/SoftSidebarRail';
import { useGlobalShortcuts } from '@/shared/hooks/useGlobalShortcuts';

// Flat legacy-NavItem lookup used by the manifest adapter so we keep
// child dropdowns (Talent → Roster/Invoices, Billing → Client/Inter-
// Co/GL, …) intact when the manifest item maps to an existing legacy
// entry. Built once at module load — `AGENCY_NAVIGATION`,
// `COMMERCIAL_NAVIGATION`, and `ADMIN_NAVIGATION` are static.
const LEGACY_LOOKUP: Map<string, NavItem> = (() => {
  const map = new Map<string, NavItem>();
  const collect = (item: NavItem) => {
    map.set(item.id, item);
    item.children?.forEach(collect);
  };
  [...AGENCY_NAVIGATION, ...COMMERCIAL_NAVIGATION, ...ADMIN_NAVIGATION].forEach(collect);
  return map;
})();

// UI refresh — sidebar section grouping. The manifest is a flat ordered
// list (no `section` field), so we derive a section per moduleId here and
// render eyebrow-labelled groups. Unmapped ids fall into 'work' (subsidiary)
// so new manifest entries still appear. Order matches SECTION_ORDER.
const SECTION_FOR_MODULE: Record<string, string> = {
  // parent + shared
  dashboard: 'main',
  'account-management': 'commercial',
  clients: 'commercial', // adapter maps account-management → legacy id "clients"
  traffic: 'commercial',
  pricing: 'commercial',
  billing: 'commercial',
  commercial: 'commercial',
  'conflict-firewall': 'commercial',
  procurement: 'ops',
  suppliers: 'ops',
  crm: 'ops',
  talent: 'ops',
  'asset-library': 'ops',
  finance: 'ops',
  'hr-central': 'ops',
  strategy: 'ops',
  'market-intel': 'ops',
  'ai-assistant': 'ops',
  intelligence: 'ops',
  comms: 'ops',
  reports: 'admin',
  compliance: 'admin',
  'my-time': 'admin',
  'team-time': 'admin',
  admin: 'admin',
  'api-keys': 'admin',
  // subsidiary head/middle/tail
  'delivery-inbox': 'main',
  'ecd-review': 'main',
  campaigns: 'work',
  production: 'work',
  media: 'work',
  'burn-sla': 'admin',
  hr: 'admin',
};
const SECTION_LABELS: Record<string, string> = {
  main: 'Today',
  commercial: 'Commercial',
  work: 'Delivery',
  ops: 'Operations',
  admin: 'System',
};
const SECTION_ORDER = ['main', 'commercial', 'work', 'ops', 'admin'];

// Global quick-add menu (header "+" button). Each entry deep-links to a real
// create route. `parentOnly` items (commercial creates) are filtered out for
// subsidiary principals, matching the route guards.
interface QuickAddItem {
  label: string;
  href: string;
  icon: LucideIcon;
  parentOnly?: boolean;
}
const QUICK_ADD_ITEMS: QuickAddItem[] = [
  { label: 'New client',        href: '/clients/new',                         icon: Briefcase,    parentOnly: true },
  { label: 'New quote',         href: '/pricing/quotes/new',                  icon: Tag,          parentOnly: true },
  { label: 'New lead',          href: '/crm/new',                             icon: Target },
  { label: 'New talent',        href: '/talent/new',                          icon: StarIcon },
  { label: 'New media plan',    href: '/media/new',                           icon: Megaphone },
  { label: 'New supplier',      href: '/suppliers/new',                       icon: ShoppingCart },
  { label: 'New purchase order', href: '/procurement/purchase-orders/new',    icon: FileText,     parentOnly: true },
];

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * The shell is wrapped in the providers the context rail reads: ONE task feed,
 * ONE action queue and ONE channel list, shared by the trigger, the segments,
 * the chat dock and the first-run default.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <MyTasksProvider>
      <ActionQueueProvider>
        <TeamChannelsProvider>
          <ChatDockProvider>
            <AppShellFrame>{children}</AppShellFrame>
          </ChatDockProvider>
        </TeamChannelsProvider>
      </ActionQueueProvider>
    </MyTasksProvider>
  );
}

function AppShellFrame({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { dawinUser } = useCurrentDawinUser();
  // The action queue also carries the approvals pending-count badge: same scope
  // rule as the /approvals page, so the number on the sidebar is the number there.
  const actionQueue = useActionQueue();
  const { approvalsCount } = actionQueue;
  const { allAccessibleModuleIds, isAdmin: isModuleAdmin, isSuperUser } = useUserModules();
  const { sidebarOpen, toggleSidebar, sidebarAutoClose, sidebarCollapsed, toggleSidebarCollapsed, navScope } = useUIStore();
  const { currentSubsidiary, subsidiaries, setCurrentSubsidiary } = useSubsidiary();
  const { 
    favoriteItems, 
    recentItems, 
    addFavorite, 
    removeFavorite,
    addRecentItem,
    expandedSections,
    toggleSection: _toggleSection,
    setExpandedSections,
  } = useNavigationStore();

  // Branding (logo + favicon)
  const { branding } = useBranding(currentSubsidiary?.id || 'zeus-group');

  // Update browser favicon whenever branding changes
  useEffect(() => {
    const faviconSrc = branding.faviconUrl || branding.logoUrl;
    if (!faviconSrc) return;

    // Use the id-based link from index.html for maximum reliability
    const el = document.getElementById('app-favicon') as HTMLLinkElement | null;
    if (el) {
      el.removeAttribute('type');
      el.href = faviconSrc;
    } else {
      // Fallback: create a new link if the id-based one isn't found
      const link = document.createElement('link');
      link.id = 'app-favicon';
      link.rel = 'icon';
      link.href = faviconSrc;
      document.head.appendChild(link);
    }

    // Update apple-touch-icon links too
    document.querySelectorAll<HTMLLinkElement>("link[rel='apple-touch-icon']").forEach((icon) => {
      icon.href = faviconSrc;
    });
  }, [branding.faviconUrl, branding.logoUrl]);

  // UI refresh — mirror the active sub-brand onto <html data-brand> so the
  // [data-brand] CSS blocks light up --brand-accent across the shell (sidebar
  // accent bar, active-item marker) and ported surfaces. Canonical SubsidiaryId
  // values match the [data-brand] keys 1:1.
  useEffect(() => {
    const brandId = currentSubsidiary?.id || 'zeus-group';
    document.documentElement.setAttribute('data-brand', brandId);
  }, [currentSubsidiary?.id]);

  // PR 1b — mirror the active density onto <html data-density>. The soft-skin
  // CSS tightens topbar/rail/table padding under `[data-density="dense"]` and
  // loosens under `[data-density="airy"]`; the shadcn primitives ignore it.
  const density = useUIStore((s) => s.density);
  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  // PR 1b — resolve the "system" theme to the current OS preference and mirror
  // it onto <html data-theme>. Soft-skin dark tokens hang off that attribute,
  // so switching between light/dark/system swaps the whole canvas without the
  // legacy sidebar vars (`--bg-sidebar`) being touched.
  const theme = useUIStore((s) => s.theme);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const resolve = () => {
      const resolved = theme === 'system' ? (mql.matches ? 'dark' : 'light') : theme;
      document.documentElement.setAttribute('data-theme', resolved);
    };
    resolve();
    if (theme !== 'system') return;
    mql.addEventListener('change', resolve);
    return () => mql.removeEventListener('change', resolve);
  }, [theme]);

  // Unread conversations, for the rail's door and its Messages segment.
  const { teamUnread: totalMessagingUnread } = useTeamChannels();

  // The context rail — what needs you, and the assistant, in ONE collapsible
  // right column (see context-rail/ContextRail.tsx). It replaced the floating
  // Action Center panel and the assistant FAB that sat over row actions.
  const railOpen = useRailStore((s) => s.open);
  const railInitialised = useRailStore((s) => s.initialised);
  const setRailOpen = useRailStore((s) => s.setOpen);
  const setRailSeg = useRailStore((s) => s.setSeg);
  const applyRailFirstRun = useRailStore((s) => s.applyFirstRun);
  const railMode = useRailMode();
  const { collapseAll: collapseDock } = useChatDock();
  useRailShortcut();
  const desktopHeaderRef = React.useRef<HTMLElement>(null);
  const mobileHeaderRef = React.useRef<HTMLElement>(null);
  useShellTop([desktopHeaderRef, mobileHeaderRef]);

  // First load only: the rail opens by itself when something is BLOCKING, and
  // stays shut otherwise. Decided once the queue has loaded; after that (or
  // after the person touches the rail) its state is theirs and persists.
  useEffect(() => {
    if (railInitialised || actionQueue.loading) return;
    applyRailFirstRun(actionQueue.blockingCount);
  }, [railInitialised, actionQueue.loading, actionQueue.blockingCount, applyRailFirstRun]);

  // A rail sliding OVER the canvas would cover docked chat windows: fold them to
  // their title bars rather than closing them, so nothing is lost.
  const railOverlaying = railOpen && railMode === 'overlay';
  useEffect(() => {
    if (railOverlaying) collapseDock();
    // collapseDock is rebuilt on every dock change; only the rail's move triggers this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [railOverlaying]);

  // Track desktop breakpoint for sidebar rail behavior
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Scroll detection for header shadow
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 5);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Phase 6.UI.0 — sidebar is now sourced from the navigation manifest
  // (`src/core/navigation/manifest.ts`). The manifest resolves
  // (orgKind, subsidiaryId) → ordered NavItem list per the brief, so
  // each subsidiary sees a sidebar tuned to its workflow without the
  // AppShell having to know the per-brand ordering.
  const isPrivileged = isModuleAdmin || isSuperUser;

  // Parent-org admin/owner principal — mirrors ParentOrgGuard. The
  // manifest splits "PARENT" vs "SUBSIDIARY" off this signal: when the
  // user is a parent-org principal AND has the `zeus-group` org
  // selected, we render the PARENT manifest (Account Mgmt, Traffic,
  // Pricing, Billing, Conflict Firewall, …). Otherwise we render the
  // SUBSIDIARY manifest for the selected sub-brand.
  // Shared resolver (super-user email OR homeOrgId==='zeus-group' OR
  // admin/owner with zeus-group access) so the sidebar matches the route
  // guards. Previously this only checked the last branch, so a Zeus Group
  // owner whose subsidiaryAccess listed only a sub-brand — or a super-user
  // email — got an empty sidebar + subsidiary dashboard.
  const isParentOrgPrincipal = useMemo(
    () => resolveIsParentOrgPrincipal(user?.email, dawinUser),
    [user?.email, dawinUser],
  );

  const mainNavItems = useMemo(() => {
    const subId = (currentSubsidiary?.id ?? 'zeus-group') as SubsidiaryId;

    // ADR-2026-05-25 §3.2 step 5 — three org-kind branches:
    //  • PARENT          parent-org admin on `zeus-group`
    //  • SUBSIDIARY_SELLING  parent-org admin viewing a sub-brand, OR
    //                       a brand-direct AD on their own brand
    //                       (their homeOrgId == subId AND they have a
    //                       sales-bearing globalRole). Sidebar adds
    //                       brand-scoped commercial entries.
    //  • SUBSIDIARY     plain delivery user on a sub-brand (delivery-only sidebar)
    let orgKind: 'PARENT' | 'SUBSIDIARY' | 'SUBSIDIARY_SELLING';
    if (isParentOrgPrincipal && subId === 'zeus-group') {
      orgKind = 'PARENT';
    } else if (subId !== 'zeus-group') {
      const userHome = (dawinUser as { homeOrgId?: string } | null)?.homeOrgId;
      const isBrandSeller =
        !!dawinUser &&
        ['admin', 'owner', 'manager'].includes(dawinUser.globalRole) &&
        (userHome === subId || isParentOrgPrincipal);
      orgKind = isBrandSeller ? 'SUBSIDIARY_SELLING' : 'SUBSIDIARY';
    } else {
      orgKind = 'SUBSIDIARY';
    }

    const resolved = resolveNav(orgKind, subId);
    const adapted = resolved.map((item) => adaptManifestToLegacyNavItem(item, LEGACY_LOOKUP));

    // Filter manifest items the user can't access via the module-level
    // gate. Privileged accounts (super-user, module admin) bypass.
    const filtered = filterNavigationByAccess(adapted, allAccessibleModuleIds, isPrivileged).map((item) =>
      item.id === 'approvals' && approvalsCount > 0 ? { ...item, badge: approvalsCount } : item,
    );

    // Admin gating — only show the Admin item if the user has an
    // admin-tier global role or is on the seed admin email list.
    const adminEmails = ['onzimai@zeusgroup.co.ug'];
    const isAdminEmail = !!user?.email && adminEmails.includes(user.email);
    const hasAdminRole = !!dawinUser && ['admin', 'owner', 'super_admin'].includes(dawinUser.globalRole);
    if (hasAdminRole || isAdminEmail || isPrivileged) return filtered;
    return filtered.filter((item) => item.id !== 'admin' && item.id !== 'api-keys');
  }, [
    approvalsCount,
    allAccessibleModuleIds,
    isPrivileged,
    isParentOrgPrincipal,
    currentSubsidiary?.id,
    user?.email,
    dawinUser,
  ]);

  // UI Refresh v3 — roadmap nav scope. 'deployed' hides `planned` items;
  // 'roadmap' (default) keeps them (rendered dimmed in renderNavItem). The
  // status field rides through the manifest adapter onto each NavItem.
  const scopedNavItems = useMemo(() => {
    if (navScope === 'roadmap') return mainNavItems;
    return mainNavItems.filter(
      (it) => ((it as { status?: NavStatus }).status ?? 'live') === 'live',
    );
  }, [mainNavItems, navScope]);
  // Corporate modules filtered by access (header pills)
  const corporateNavItems = useMemo(() => {
    return filterNavigationByAccess(CORPORATE_NAVIGATION, allAccessibleModuleIds, isPrivileged);
  }, [allAccessibleModuleIds, isPrivileged]);

  // Desktop: collapsed rail by default, toggle to expand. Mobile: always expanded (full drawer).
  const sidebarExpanded = isDesktop ? !sidebarCollapsed : true;
  
  // Filter admin navigation based on user roles
  const adminNavItems = useMemo(() => {
    // Fallback admin emails for immediate access
    const adminEmails = ['onzimai@zeusgroup.co.ug'];
    const isAdminEmail = user?.email && adminEmails.includes(user.email);
    
    // Check if user has admin or super_admin global role from DawinUser profile
    let hasAdminRole = false;
    if (dawinUser) {
      hasAdminRole = ['admin', 'owner', 'super_admin'].includes(dawinUser.globalRole);
    }
    
    // Allow access if user has admin role OR is admin email
    if (!hasAdminRole && !isAdminEmail) return [];
    
    return ADMIN_NAVIGATION.filter(item => 
      !item.roles || item.roles.some(role => 
        role === 'admin' || role === 'super_admin' || role === dawinUser?.globalRole
      )
    );
  }, [dawinUser, user?.email]);

  // Command palette items
  const commandItems = useMemo(() => getAllCommandItems(), []);

  // PR 1b — group the resolved manifest for the soft rail. Expanded mode
  // shows section eyebrows above each group, matching the old aside's layout.
  const railSections = useMemo<SoftSidebarRailSection[]>(() => {
    return SECTION_ORDER.map((section) => {
      const items = scopedNavItems.filter(
        (it: NavItem) => (SECTION_FOR_MODULE[it.id] || 'work') === section,
      );
      return { id: section, label: SECTION_LABELS[section] ?? section, items };
    }).filter((s) => s.items.length > 0);
  }, [scopedNavItems]);

  // Global G+letter shortcuts (Strategy/HR/Finance/Capital/Compliance/Market Intel)
  useGlobalShortcuts();

  // Get subsidiary display name and color
  const subsidiaryName = currentSubsidiary?.name || 'Zeus Group';
  const subsidiaryColor = currentSubsidiary?.color || '#872E5C';

  // Auto-expand navigation groups based on active route
  useEffect(() => {
    const allItems = [
      ...mainNavItems,
      ...corporateNavItems,
      ...adminNavItems,
    ];
    const activeParents = allItems.filter(item => 
      item.children?.some((child: NavItem) => 
        location.pathname === child.href || 
        (child.href !== '/' && location.pathname.startsWith(child.href))
      )
    );
    
    if (activeParents.length > 0) {
      const newIds = activeParents.map(p => p.id).filter(id => !expandedSections.includes(id));
      if (newIds.length > 0) {
        setExpandedSections([...expandedSections, ...newIds]);
      }
    }
  }, [location.pathname]);

  // Track recent navigation
  useEffect(() => {
    const currentItem = commandItems.find(item => 
      location.pathname === item.path || location.pathname.startsWith(item.path + '/')
    );
    if (currentItem) {
      addRecentItem(currentItem.id);
    }
  }, [location.pathname]);

  const isActive = (href: string) => {
    if (href === '/' || href === '/dashboard') return location.pathname === href;
    return location.pathname === href || location.pathname.startsWith(href);
  };

  // UI refresh — shell-level breadcrumb + org-chip framing.
  const isParentRoot =
    isParentOrgPrincipal && (currentSubsidiary?.id ?? 'zeus-group') === 'zeus-group';
  const breadcrumbRoot = isParentRoot ? 'Zeus Group' : subsidiaryName;
  const activeNavLabel = [...mainNavItems, ...corporateNavItems]
    .filter((it) => isActive(it.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.label;
  const userInitials =
    user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';
  const userRoleLabel = isParentRoot
    ? 'Parent-org admin'
    : dawinUser?.globalRole
      ? dawinUser.globalRole.charAt(0).toUpperCase() + dawinUser.globalRole.slice(1)
      : 'Team member';

  const getIcon = (iconName: string): LucideIcon | null => {
    return getIconByName(iconName);
  };

  const handleSubsidiarySwitch = (sub: typeof subsidiaries[0]) => {
    setCurrentSubsidiary(sub);
    // Use React Router navigation instead of full page reload
    navigate('/');
  };


  // Render corporate nav item for header dropdown
  const renderCorporateMenuItem = (item: NavItem) => {
    const IconComponent = getIcon(item.icon);
    return (
      <DropdownMenuItem
        key={item.id}
        onClick={() => navigate(item.href)}
        className="gap-2 cursor-pointer"
      >
        {IconComponent && <IconComponent className="h-4 w-4" />}
        <div className="flex-1">
          <div className="font-medium">{item.label}</div>
          {item.description && (
            <div className="text-xs text-muted-foreground">{item.description}</div>
          )}
        </div>
      </DropdownMenuItem>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Boot the global-search index (no-op when feature flag is off). */}
      <SearchIndexMount />
      <OfflineBanner />

      {/* Desktop Header — UI Refresh v3 two-row layout (handoff README
          §"Top bar, two rows"). Row 1: breadcrumb + search + icon cluster.
          Row 2: corporate service pills. On lg+, left-padded to start at the
          sidebar's right edge (sidebar: w-16 collapsed, w-60 expanded). */}
      <header
        ref={desktopHeaderRef}
        className={cn(
          'hidden lg:flex sticky top-0 z-40 flex-col transition-shadow duration-200',
          'border-b border-[var(--border-default)] bg-[var(--bg-surface)]',
          sidebarExpanded ? 'lg:pl-[248px]' : 'lg:pl-[88px]',
          isScrolled && 'shadow-[var(--shadow-sm)]'
        )}
        style={{ boxShadow: 'inset 0 -2px 0 var(--zeus-red)' }}
      >
        {/* Row 1 — breadcrumb · search · actions */}
        <div className="flex h-14 items-center gap-3 pr-6">
          {/* UI refresh — shell breadcrumb (root › active surface) */}
          <div className="flex items-center gap-1.5 text-[13px] shrink-0 min-w-0 max-w-[280px]">
            <span className="text-[var(--fg-tertiary)] truncate">{breadcrumbRoot}</span>
            {activeNavLabel && (
              <>
                <ChevronRight className="h-3 w-3 text-[var(--fg-quaternary)] flex-none" />
                <span className="font-semibold text-[var(--fg-primary)] truncate">{activeNavLabel}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Command Palette in header */}
          <CommandPalette
            items={commandItems}
            recentItems={recentItems}
            favoriteItems={favoriteItems}
            onAddFavorite={addFavorite}
            onRemoveFavorite={removeFavorite}
            organizationId={(user as { organizationId?: string } | null)?.organizationId || 'default'}
            subsidiaryId={currentSubsidiary?.id}
          />

          {/* The context rail's door: what needs you. */}
          <RailTrigger unread={totalMessagingUnread} />

          {/* Global quick-add (+) — dropdown of "create" deep-links. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Quick add"
                data-testid="global-quick-add"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-tertiary)]">
                Quick add
              </div>
              <DropdownMenuSeparator />
              {QUICK_ADD_ITEMS.filter((it) => !it.parentOnly || isParentRoot).map((it) => {
                const ItemIcon = it.icon;
                return (
                  <DropdownMenuItem key={it.href} asChild>
                    <Link to={it.href}>
                      <ItemIcon className="mr-2 h-3.5 w-3.5" /> {it.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User avatar — rightmost. Account menu (Profile / Appearance /
              Admin / Preferences / Sign out); mirrors the sidebar footer card. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8 ml-0.5"
                aria-label="Account menu"
                data-testid="header-account-menu"
              >
                <span
                  className="inline-flex items-center justify-center rounded-full text-[11px] font-semibold text-white"
                  style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #e63946, #b8222e)' }}
                >
                  {userInitials}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <div className="text-[13px] font-medium text-[var(--fg-primary)] truncate">
                  {user?.displayName || 'User'}
                </div>
                <div className="text-[11px] text-[var(--fg-tertiary)] truncate">{user?.email}</div>
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
              {adminNavItems.length > 0 && (
                <DropdownMenuItem asChild>
                  <Link to="/admin">
                    <Settings className="mr-2 h-3.5 w-3.5" /> Admin
                  </Link>
                </DropdownMenuItem>
              )}
              <PreferencesMenu />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut()}
                data-testid="header-logout-button"
                className="text-[var(--rag-red)] focus:text-[var(--rag-red)]"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Row 2 — corporate service pills: "CORPORATE" label · module pills ·
            divider · AI Intelligence · (parent only) right-aligned Admin.
            Org switcher + account menu live in the sidebar (chip + footer). */}
        <div className="flex items-center gap-1 pr-6 pb-2 overflow-x-auto">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-quaternary)] mr-1.5 flex-none">
            Corporate
          </span>
          <GroupNavPills items={corporateNavItems} />
          <span className="self-stretch w-px bg-[var(--border-subtle)] mx-1.5 my-1" />
          <GroupNavPills items={UTILITY_NAVIGATION} />
          {isParentRoot && adminNavItems.length > 0 && (
            <div className="ml-auto flex-none">
              <GroupNavPills items={ADMIN_NAVIGATION} />
            </div>
          )}
        </div>
      </header>

      {/* Mobile Header */}
      <header
        ref={mobileHeaderRef}
        className={cn(
          "lg:hidden sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 transition-shadow duration-200",
          isScrolled && "shadow-sm"
        )}
        style={{ boxShadow: 'inset 0 -2px 0 var(--zeus-red)' }}
      >
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div className="flex-1">
          <CommandPalette
            items={commandItems}
            recentItems={recentItems}
            favoriteItems={favoriteItems}
            onAddFavorite={addFavorite}
            onRemoveFavorite={removeFavorite}
            organizationId={(user as { organizationId?: string } | null)?.organizationId || 'default'}
            subsidiaryId={currentSubsidiary?.id}
            onSelect={() => {
              // Auto-close sidebar when selecting from command palette on mobile
              if (sidebarAutoClose && window.innerWidth < 1024) {
                setTimeout(() => toggleSidebar(), 100);
              }
            }}
          />
        </div>
        {/* AI Intelligence + Tasks - Mobile */}
        <AIIntelligenceMenu />
        <RailTrigger unread={totalMessagingUnread} />

        {/* Zeus Group dropdown for mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Zeus Group Services
            </div>
            {corporateNavItems.map(renderCorporateMenuItem)}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/profile">Profile</Link>
            </DropdownMenuItem>
            {/* Admin Dashboard - Only show if user has admin role */}
            {adminNavItems.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin">
                    <Settings className="mr-2 h-4 w-4" />
                    Admin Dashboard
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} data-testid="logout-button">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Subsidiary Switcher - Mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <div
                className="h-6 w-6 rounded flex items-center justify-center"
                style={{ backgroundColor: subsidiaryColor }}
              >
                <span className="text-xs font-bold" style={{ color: currentSubsidiary?.ink ?? '#fff' }}>{subsidiaryName.charAt(0)}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" style={{ zIndex: 70 }}>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Switch Subsidiary
            </div>
            {subsidiaries.filter(s => s.status === 'active').map((sub) => (
              <DropdownMenuItem
                key={sub.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubsidiarySwitch(sub);
                }}
                className="gap-2 cursor-pointer"
              >
                <div
                  className="h-6 w-6 rounded flex items-center justify-center"
                  style={{ backgroundColor: sub.color }}
                >
                  <span className="text-xs font-bold" style={{ color: sub.ink }}>{sub.shortName.charAt(0)}</span>
                </div>
                <span className="flex-1">{sub.name}</span>
                {currentSubsidiary?.id === sub.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {subsidiaries.filter(s => s.status === 'coming-soon').map((sub) => (
              <DropdownMenuItem
                key={sub.id}
                disabled
                className="gap-2 opacity-50"
              >
                <div className="h-6 w-6 rounded flex items-center justify-center bg-muted">
                  <span className="text-muted-foreground text-xs font-bold">{sub.shortName.charAt(0)}</span>
                </div>
                <span className="flex-1">{sub.name}</span>
                <span className="text-xs text-muted-foreground">Soon</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex flex-1">
        {/* PR 1b — soft 72px icon rail. See SoftSidebarRail.tsx. The rail
            is `position: fixed` so the surrounding `<main>` only needs a
            left margin to clear the rail's own width. Mobile collapses
            the rail into a slide-in drawer via `mobileOpen` + the scrim
            the rail renders itself. */}
        <SoftSidebarRail
          sections={railSections}
          expanded={!sidebarCollapsed}
          onToggleExpanded={toggleSidebarCollapsed}
          mobileOpen={sidebarOpen}
          onMobileClose={() => sidebarOpen && toggleSidebar()}
          subsidiaries={subsidiaries}
          currentSubsidiary={currentSubsidiary}
          isParentRoot={isParentRoot}
          onSelectSubsidiary={handleSubsidiarySwitch}
          user={{
            initials: userInitials,
            displayName: user?.displayName,
            email: user?.email,
            roleLabel: userRoleLabel,
          }}
          adminEnabled={adminNavItems.length > 0}
          onSignOut={signOut}
          isDesktop={isDesktop}
        />

        {/* Main Content. lg:ml-* offsets for the fixed 72px rail
            (expanded → 232px). The SoftSidebarRail renders its own mobile
            scrim; no separate overlay here. */}
        <main
          className={cn(
            'flex-1 min-w-0',
            sidebarExpanded ? 'lg:ml-[232px]' : 'lg:ml-[72px]'
          )}
          style={railOpen && railMode === 'push' ? { marginRight: 'var(--rail-w)' } : undefined}
        >
          {children}
        </main>
      </div>

      {/* The context rail. Overlay mode gets a scrim that closes it. */}
      {railOverlaying && (
        <button
          type="button"
          className="rail-scrim"
          aria-label="Close the context rail"
          tabIndex={-1}
          onClick={() => setRailOpen(false)}
        />
      )}
      <ContextRail
        mode={railMode}
        unread={totalMessagingUnread}
        assistantContext={{ currentModule: location.pathname.split('/')[1] || 'general' }}
      />

      {/* Docked chat windows. No launcher of their own: the rail's Messages
          segment opens them, and they keep clear of the lane the rail holds. */}
      <ChatDock onBrowseAll={() => setRailSeg('messages')} reservedRight={dockReservedRight(railOpen)} />

      {/* Toast bus + optimistic-write failure reporter (shared/components/feedback). */}
      <ToastHost />
    </div>
  );
}
