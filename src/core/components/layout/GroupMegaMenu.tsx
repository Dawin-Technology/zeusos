import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, ChevronRight, Dot, Folder, X, type LucideIcon } from 'lucide-react';
import { CORPORATE_NAVIGATION, type NavItem } from '@/config/navigation.unified';
import { getIconByName } from '@/shared/utils/iconMap';
import { cn } from '@/shared/lib/utils';

function iconOr(name: string | undefined, fallback: LucideIcon): LucideIcon {
  if (!name) return fallback;
  return getIconByName(name) ?? fallback;
}

/**
 * Group mega menu — Zeus Group shared services (CEO Strategy / HR Central /
 * Finance / Compliance / Market Intelligence). Replaces the row of GroupNavPills.
 *
 * Behaviour (per handoff README):
 * - Button labelled "Group" with a Building2 icon + chevron. Click toggles,
 *   hover opens after 120ms, pointer-leave closes after 220ms (hover-capable
 *   devices only).
 * - Pressing G arms the prefix; a subsequent S/H/F/O/M (within 1.2s) jumps
 *   to the matching module. The prefix is ignored while an input/textarea/
 *   contenteditable is focused.
 * - Esc closes. Outside click closes.
 * - Active state (current route lives in a Group module) outlines the button
 *   in `color-mix(--accent 30%)`.
 * - Open state fills with --fg-primary (navy) and white label.
 *
 * Also renders the breadcrumb "Group › <Module>" next to the button when
 * the current route belongs to a Group module.
 */

const SHORTCUT_BY_ID: Record<string, string> = {
  strategy: 'S',
  hr: 'H',
  finance: 'F',
  compliance: 'O',
  'market-intel': 'M',
};

const PILL_DESC: Record<string, string> = {
  strategy: 'Strategic plan, OKRs, KPIs',
  hr: 'People, leave, payroll, org',
  finance: 'Cash, spend, CFO briefing',
  compliance: 'Obligations & documents',
  'market-intel': 'Rivals, news, insights',
};

function matchesItem(item: NavItem, pathname: string): boolean {
  if (item.href && pathname === item.href) return true;
  if (item.href && pathname.startsWith(item.href + '/')) return true;
  if (item.children?.some((c) => matchesItem(c, pathname))) return true;
  return false;
}

export function GroupMegaMenu({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeModule = CORPORATE_NAVIGATION.find((m) => matchesItem(m, pathname));
  const BuildingIcon = Building2;

  const hoverCapable = () =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(hover: hover)').matches;

  const handleEnter = () => {
    if (!hoverCapable()) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setOpen(true), 120);
  };
  const handleLeave = () => {
    if (!hoverCapable()) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setOpen(false), 220);
  };

  // Outside-click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Keyboard: Esc closes; G then <letter> jumps to a module.
  useEffect(() => {
    const isEditing = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable === true
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        return;
      }
      if (isEditing()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Second step: a letter within 1.2s of G arms a module
      if (prefixTimerRef.current) {
        const letter = e.key.toUpperCase();
        const target = CORPORATE_NAVIGATION.find(
          (m) => SHORTCUT_BY_ID[m.id] === letter,
        );
        clearTimeout(prefixTimerRef.current);
        prefixTimerRef.current = null;
        if (target) {
          e.preventDefault();
          setOpen(false);
          navigate(target.href);
        }
        return;
      }

      // Prime the prefix on G
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setOpen(true);
        prefixTimerRef.current = setTimeout(() => {
          prefixTimerRef.current = null;
        }, 1200);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, navigate]);

  return (
    <div
      ref={wrapRef}
      className={cn('group-menu-wrap sub-picker-wrap', className)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        className={cn(
          'group-menu-btn',
          activeModule && 'active',
          open && 'open',
        )}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Zeus Group shared services"
      >
        <BuildingIcon className="h-3.5 w-3.5" strokeWidth={2} />
        <span>Group</span>
        <ChevronDown className="h-3 w-3" strokeWidth={2} />
      </button>

      {activeModule && (
        <div className="topbar-crumb" aria-label="Current module">
          <span className="topbar-crumb-parent">Group</span>
          <ChevronRight className="h-3 w-3" style={{ color: 'var(--fg-tertiary)' }} strokeWidth={2} />
          <span className="topbar-crumb-title">{activeModule.label}</span>
        </div>
      )}

      {open && (
        <div
          className="group-mega"
          role="menu"
          aria-label="Zeus Group shared services"
        >
          <div className="group-mega-head">
            <div>
              <b>Zeus Group shared services</b>
              <span>Cross-brand modules · press G then the letter to jump</span>
            </div>
            <button
              type="button"
              className="zeus-icon-btn"
              style={{ width: 28, height: 28, boxShadow: 'none', background: 'transparent' }}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="group-mega-grid">
            {CORPORATE_NAVIGATION.map((col) => {
              const Icon = iconOr(col.icon, Folder);
              const isActive = activeModule?.id === col.id;
              const shortcut = SHORTCUT_BY_ID[col.id];
              return (
                <section
                  key={col.id}
                  className={cn('group-mega-col', isActive && 'on')}
                >
                  <button
                    type="button"
                    className="group-mega-title"
                    onClick={() => {
                      navigate(col.href);
                      setOpen(false);
                    }}
                  >
                    <i>
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </i>
                    <span>
                      <b>{col.label}</b>
                      <small>{col.description ?? PILL_DESC[col.id] ?? ''}</small>
                    </span>
                    {shortcut && <span className="kbd">G {shortcut}</span>}
                  </button>

                  {(col.children?.length ?? 0) > 0 && (
                    <div className="group-mega-links">
                      {col.children!.map((child) => {
                        const ChildIcon = iconOr(child.icon, Dot);
                        const childActive = pathname === child.href || pathname.startsWith(child.href + '/');
                        return (
                          <button
                            key={child.id}
                            type="button"
                            className={cn('group-mega-link', childActive && 'on')}
                            onClick={() => {
                              navigate(child.href);
                              setOpen(false);
                            }}
                          >
                            <ChildIcon className="h-3 w-3" strokeWidth={2} />
                            <span>{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
