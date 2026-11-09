/**
 * Drawer — right-side slide panel, 480px by default, with a sunken
 * footer for primary actions. Click-outside and Escape close it.
 *
 * Purely visual; wire the open/onClose state in the parent.
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  width = 480,
  footer,
  children,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="zui-drawer-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <aside
        className="zui-drawer"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="zui-drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="zui-drawer-title">{title}</h3>
            {subtitle && <div className="zui-drawer-sub">{subtitle}</div>}
          </div>
          <button
            type="button"
            className="zui-icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="zui-drawer-body">{children}</div>
        {footer && <footer className="zui-drawer-foot">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}
