// Shared pill sub-navigation for finance sections.
// Renders a horizontal scrollable row of pill buttons.

import { useNavigate, useLocation } from 'react-router-dom';

export interface SubNavPill {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

interface SubNavPillsProps {
  pills: SubNavPill[];
}

export function SubNavPills({ pills }: SubNavPillsProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="zeus-subpills">
      {pills.map((pill) => {
        const Icon = pill.icon;
        const isActive = location.pathname === pill.path;
        return (
          <button
            key={pill.id}
            onClick={() => navigate(pill.path)}
            className={`zeus-subpill${isActive ? ' active' : ''}`}
            data-testid={`subpill-${pill.id}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}
