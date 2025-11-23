import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { cn } from '@/utils/cn';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useTenant } from '@/context/TenantContext';
import { pickContrastColor } from '@/utils/color';
import { getMultilingualText } from '@/utils/multilingual';
import { isActivePhase } from '../utils/headerHelpers';
import type { Task } from '@/services/events';
import type { Location } from "react-router";

interface PhaseMenuProps {
  phase: {
    id: number;
    label: string;
    description?: string | null;
    to: string;
  };
  tasks: Task[];
  activeEventId: string | null;
  location: Location;
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  menuRef: (el: HTMLDivElement | null) => void;
  menuPosition?: { top: number; left: number };
  variant?: 'desktop' | 'mobile';
  onLinkClick?: () => void;
}

export function PhaseMenu({
  phase,
  tasks,
  activeEventId,
  location,
  isOpen,
  onMouseEnter,
  onMouseLeave,
  menuRef,
  menuPosition,
  variant = 'desktop',
  onLinkClick
}: PhaseMenuProps) {
  const { t, i18n } = useTranslation();
  const { branding } = useTenant();
  const tenantPath = useTenantPath();
  const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';

  const taskMenuItems = tasks.map(task => ({
    key: `task-${task.id}`,
    label: getMultilingualText(task.title, currentLang),
    href: tenantPath(`dashboard/events/${activeEventId}/tasks/${task.id}`),
    order_index: typeof task.order_index === 'number' ? task.order_index : Number.MAX_SAFE_INTEGER
  }));

  const menuItems = [...taskMenuItems].sort((a, b) => {
    const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.label.localeCompare(b.label);
  });

  const hasMenu = menuItems.length > 0;
  const isActive = isActivePhase(phase.to, location);

  if (variant === 'mobile') {
    return (
      <div className="flex flex-col gap-1">
        <Link
          to={phase.to}
          onClick={onLinkClick}
          className={cn(
            'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-[color:var(--header-hover)] text-[color:var(--header-fg)] shadow-sm'
              : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
          )}
        >
          {phase.label}
        </Link>
        {hasMenu ? (
          <div className="ml-3 grid gap-1 rounded-lg border border-border/60 bg-card/80 p-2">
            {phase.description && phase.description.trim() ? (
              <p className="text-sm font-medium text-foreground line-clamp-3">
                {getMultilingualText(phase.description, currentLang)}
              </p>
            ) : (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {phase.label}
              </p>
            )}
            {menuItems.map(item => (
              <Link
                key={item.key}
                to={item.href}
                onClick={onLinkClick}
                className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div 
      ref={menuRef}
      className="relative flex-shrink-0 overflow-visible"
      onMouseEnter={hasMenu ? onMouseEnter : undefined}
      onMouseLeave={hasMenu ? onMouseLeave : undefined}
    >
      <Link
        to={phase.to}
        className={cn(
          'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'shadow-sm'
            : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
        )}
        style={isActive ? {
          backgroundColor: branding.primaryColor,
          color: pickContrastColor(branding.primaryColor || '#0ea5e9')
        } : undefined}
        aria-haspopup={hasMenu ? 'menu' : undefined}
      >
        {phase.label}
      </Link>
      {hasMenu && isOpen ? (
        <div
          className={cn(
            'fixed z-[110] w-72 rounded-xl border border-border/70 bg-card/95 p-3 text-foreground shadow-xl backdrop-blur transition-opacity duration-150',
            'pointer-events-auto opacity-100'
          )}
          role="menu"
          aria-label={phase.label}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          style={{
            top: menuPosition?.top ?? 64,
            left: menuPosition?.left ?? '50%',
            marginTop: 4
          }}
        >
          {phase.description && phase.description.trim() ? (
            <p className="text-sm font-medium text-foreground line-clamp-3">
              {getMultilingualText(phase.description, currentLang)}
            </p>
          ) : (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {phase.label}
            </p>
          )}
          <div className="mt-2 space-y-1">
            {menuItems.map(item => (
              <Link
                key={item.key}
                to={item.href}
                className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

