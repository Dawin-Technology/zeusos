import React from 'react';
import { Bell, Search, Menu, MessageSquare, Sparkles, LogOut, User as UserIcon, Settings } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/core/components/ui/tooltip';
import { GroupMegaMenu } from './GroupMegaMenu';
import { SubsidiaryPicker } from './SubsidiaryPicker';
import { PreferencesMenu } from './PreferencesMenu';
import { useNotifications, useAuth } from '@/integration/store';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '@/shared/services/firebase';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
// WhatsApp module removed in Phase 1.C — stub subscription returns unsubscribe noop.
// TODO Phase 4: rebuild client comms (WhatsApp/Slack) against marketing-agency message shapes.
const subscribeToUnreadCount = (_setter: (n: number) => void): (() => void) => () => {};
import { cn } from '@/shared/lib/utils';

export interface TopNavBarProps {
  onOpenNotifications?: () => void;
  onOpenSearch?: () => void;
  onMenuClick?: () => void;
}

/**
 * Zeus Group topbar (soft skin, 60px tall).
 *
 *   Left:   mobile menu toggle · Group mega menu button + crumb
 *   Middle: ⌘K search pill
 *   Right:  AI · Comms · Notifications · Subsidiary picker · Avatar menu
 *
 * Styling lives in `src/shared/components/zeus-ui/shell.css` and is scoped
 * under `[data-skin="soft"]`. AppShell sets that attribute on <html> so the
 * soft chrome is the default across the app.
 */
export function TopNavBar({
  onOpenNotifications,
  onOpenSearch,
  onMenuClick,
}: TopNavBarProps) {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const { displayName, email } = useAuth();
  const whatsappEnabled = useFeatureFlag('WHATSAPP_ENABLED');
  const [waUnread, setWaUnread] = React.useState(0);

  React.useEffect(() => {
    if (!whatsappEnabled) return;
    return subscribeToUnreadCount(setWaUnread);
  }, [whatsappEnabled]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const avatarInitials =
    displayName?.[0]?.toUpperCase() ||
    email?.[0]?.toUpperCase() ||
    'U';

  return (
    <header className={cn('zeus-topbar')}>
      {/* ──── Left: mobile menu (hidden on md+) + Group mega menu ──── */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-9 w-9"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <GroupMegaMenu className="hidden md:block" />

      {/* Spacer */}
      <div className="flex-1" />

      {/* ──── Middle: ⌘K pill ──── */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="kbar-button hidden sm:inline-flex"
        aria-label="Search (⌘K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search or jump to…</span>
        <span className="kbd">⌘K</span>
      </button>

      {/* Mobile search */}
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden h-9 w-9"
        onClick={onOpenSearch}
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </Button>

      {/* ──── Right: icon cluster · brand picker · avatar ──── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="zeus-icon-btn"
            onClick={() => navigate('/intelligence')}
            aria-label="AI Intelligence"
          >
            <Sparkles className="h-4 w-4" />
            <span className="badge" />
          </button>
        </TooltipTrigger>
        <TooltipContent>AI Intelligence</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="zeus-icon-btn"
            onClick={() => navigate('/comms')}
            aria-label="Messages"
          >
            <MessageSquare className="h-4 w-4" />
            {waUnread > 0 && <span className="badge" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>Messages{waUnread > 0 ? ` (${waUnread})` : ''}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="zeus-icon-btn relative"
            onClick={onOpenNotifications}
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span
                data-testid="notification-bell-count"
                className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ring-2 ring-[var(--bg-surface)]"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </TooltipContent>
      </Tooltip>

      {/* Subsidiary / brand picker (keeps existing component; CSS hooks already
          set up soft treatment via .sub-picker-wrap wrapper it renders). */}
      <SubsidiaryPicker className="ml-1" />

      {/* Avatar + account menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="user-avatar-btn"
            aria-label="Account menu"
          >
            {avatarInitials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-0.5">
              <p className="text-[13px] font-medium text-[var(--fg-primary)]">
                {displayName || 'User'}
              </p>
              <p className="text-[11px] text-[var(--fg-tertiary)] truncate">{email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/profile')}>
            <UserIcon className="mr-2 h-3.5 w-3.5" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/admin/settings')}>
            <Settings className="mr-2 h-3.5 w-3.5" /> Settings
          </DropdownMenuItem>
          <PreferencesMenu />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-[var(--rag-red)] focus:text-[var(--rag-red)]"
          >
            <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
