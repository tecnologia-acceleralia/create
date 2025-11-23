import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react";
import { cn } from '@/utils/cn';
import { useTenantPath } from '@/hooks/useTenantPath';
import { safeTranslate } from '@/utils/i18n-helpers';
import type { Location } from "react-router";

interface TrackingMenuProps {
  location: Location;
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  menuRef: (el: HTMLDivElement | null) => void;
  menuPosition?: { top: number; left: number };
  variant?: 'desktop' | 'mobile';
  onLinkClick?: () => void;
}

export function TrackingMenu({
  location,
  isOpen,
  onMouseEnter,
  onMouseLeave,
  menuRef,
  menuPosition,
  variant = 'desktop',
  onLinkClick
}: TrackingMenuProps) {
  const { t } = useTranslation();
  const tenantPath = useTenantPath();

  const trackingMenuItems = [
    {
      key: 'deliverables',
      label: safeTranslate(t, 'navigation.trackingDeliverables'),
      href: tenantPath('dashboard/tracking/deliverables')
    }
  ];

  const hasTrackingMenu = trackingMenuItems.length > 0;
  const isActive = location.pathname.includes('/tracking/');

  if (variant === 'mobile') {
    return (
      <Link
        to={tenantPath('dashboard/tracking/deliverables')}
        onClick={onLinkClick}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--header-border)] px-3 py-2 text-sm font-medium text-[color:var(--header-muted)] transition-colors hover:border-[color:var(--header-fg)] hover:text-[color:var(--header-fg)]"
      >
        <BarChart3 className="h-5 w-5" aria-hidden="true" />
        <span>{safeTranslate(t, 'navigation.tracking')}</span>
      </Link>
    );
  }

  return (
    <div 
      ref={menuRef}
      className="relative flex-shrink-0 overflow-visible"
      onMouseEnter={hasTrackingMenu ? onMouseEnter : undefined}
      onMouseLeave={hasTrackingMenu ? onMouseLeave : undefined}
    >
      <Link
        to={tenantPath('dashboard/tracking/deliverables')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-[color:var(--header-hover)] text-[color:var(--header-fg)] shadow-sm'
            : 'text-[color:var(--header-muted)] hover:bg-[color:var(--header-hover)] hover:text-[color:var(--header-fg)]'
        )}
        aria-label={safeTranslate(t, 'navigation.tracking')}
        title={safeTranslate(t, 'navigation.tracking')}
        aria-haspopup={hasTrackingMenu ? 'menu' : undefined}
      >
        <BarChart3 className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{safeTranslate(t, 'navigation.tracking')}</span>
      </Link>
      {hasTrackingMenu && isOpen ? (
        <div
          className={cn(
            'fixed z-[110] w-72 rounded-xl border border-border/70 bg-card/95 p-3 text-foreground shadow-xl backdrop-blur transition-opacity duration-150',
            'pointer-events-auto opacity-100'
          )}
          role="menu"
          aria-label={safeTranslate(t, 'navigation.tracking')}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          style={{ 
            top: menuPosition?.top ?? 64,
            left: menuPosition?.left ?? '50%',
            marginTop: 4
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {safeTranslate(t, 'navigation.tracking')}
          </p>
          <div className="mt-2 space-y-1">
            {trackingMenuItems.map(item => (
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

