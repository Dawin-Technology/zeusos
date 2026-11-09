/**
 * ModuleHeader — DawinOS module title bar: title + subtitle + right-
 * aligned actions, with an optional pill-track tab strip underneath.
 * The tab track uses an absolutely-positioned sliding indicator for
 * the DawinOS "soft" feel.
 */

import React, { useLayoutEffect, useRef, useState } from 'react';

export interface ModuleTab {
  id: string;
  label: string;
}

export interface ModuleHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: ModuleTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
}

export function ModuleHeader({
  title,
  subtitle,
  actions,
  tabs,
  activeTab,
  onTabChange,
}: ModuleHeaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [indStyle, setIndStyle] = useState<React.CSSProperties>({ opacity: 0 });

  useLayoutEffect(() => {
    if (!tabs || !activeTab || !trackRef.current) return;
    const el = trackRef.current.querySelector<HTMLButtonElement>(
      `[data-tab-id="${activeTab}"]`,
    );
    if (!el) return;
    setIndStyle({
      transform: `translateX(${el.offsetLeft - 3}px)`,
      width: el.offsetWidth,
      opacity: 1,
    });
  }, [activeTab, tabs]);

  return (
    <header className="zui-module-head">
      <div className="zui-module-head-row">
        <div style={{ minWidth: 0 }}>
          <h1 className="zui-module-title">{title}</h1>
          {subtitle && <div className="zui-module-sub">{subtitle}</div>}
        </div>
        {actions && <div className="zui-module-actions">{actions}</div>}
      </div>
      {tabs && tabs.length > 0 && (
        <div className="zui-tab-track" ref={trackRef}>
          <span className="zui-tab-ind" style={indStyle} />
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              data-tab-id={t.id}
              className={`zui-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => onTabChange?.(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
