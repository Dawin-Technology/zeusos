/**
 * Banner — tone-tinted call-out at the top of a module surface.
 * Used for "N IWOs waiting for acceptance", payroll release, PO approval,
 * etc. Tone drives both the soft background and the icon-tile fill.
 */

import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
} from 'lucide-react';

export type BannerTone = 'amber' | 'red' | 'green' | 'blue';

export interface BannerProps {
  tone?: BannerTone;
  title: string;
  message?: React.ReactNode;
  icon?: LucideIcon;
  /** Right-aligned action buttons (shadcn Button, Link, etc.). */
  actions?: React.ReactNode;
  className?: string;
}

const DEFAULT_ICON: Record<BannerTone, LucideIcon> = {
  amber: AlertTriangle,
  red: AlertCircle,
  green: CheckCircle2,
  blue: Info,
};

export function Banner({
  tone = 'amber',
  title,
  message,
  icon,
  actions,
  className,
}: BannerProps) {
  const IconCmp = icon ?? DEFAULT_ICON[tone];
  return (
    <div className={`zui-banner tone-${tone}${className ? ` ${className}` : ''}`}>
      <div className="zui-banner-icon">
        <IconCmp className="h-4 w-4" />
      </div>
      <div className="zui-banner-body">
        <div className="zui-banner-title">{title}</div>
        {message && <div className="zui-banner-msg">{message}</div>}
      </div>
      {actions && <div className="zui-banner-actions">{actions}</div>}
    </div>
  );
}
