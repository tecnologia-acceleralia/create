import { useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Event, Phase } from '@/services/events';
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { formatDateRange } from '@/utils/date';

type EventTimelineTabProps = {
  event: Event & { phases?: Phase[]; tasks?: unknown[]; rubrics?: unknown[] };
};

export function EventTimelineTab({ event }: EventTimelineTabProps) {
  const { t, i18n } = useTranslation();
  const { branding } = useTenant();
  const tenantPath = useTenantPath();
  const locale = i18n.language ?? 'es';

  const phases = useMemo(() => {
    if (!event.phases || !Array.isArray(event.phases)) {
      return [];
    }
    return (event.phases as Phase[])
      .slice()
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }, [event.phases]);

  if (!phases.length) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{t('events.noPhases')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        {/* Timeline line */}
        <div
          className="absolute left-4 top-0 bottom-0 w-0.5"
          style={{ backgroundColor: branding.primaryColor || '#00416b' }}
        />
        
        {/* Timeline items */}
        <div className="space-y-6">
          {phases.map((phase, index) => {
            const color = branding.primaryColor || '#00416b';
            const dateRange = formatDateRange(locale, phase.start_date ?? null, phase.end_date ?? null);
            
            return (
              <div key={phase.id} className="relative flex gap-4">
                {/* Timeline dot */}
                <div
                  className="relative z-10 h-8 w-8 rounded-full border-2 border-background flex-shrink-0"
                  style={{
                    backgroundColor: color,
                    marginLeft: '2px'
                  }}
                />
                
                {/* Content */}
                <div className="flex-1 pb-6">
                  <Link
                    to={tenantPath(`dashboard/events/${event.id}/view?phase=${phase.id}`)}
                    className="block rounded-lg border p-4 transition-all hover:shadow-md cursor-pointer"
                    style={{
                      borderColor: `${color}40`,
                      backgroundColor: `${color}08`
                    }}
                  >
                    <h3 className="text-lg font-semibold mb-1" style={{ color }}>
                      {phase.name}
                    </h3>
                    {dateRange && (
                      <p className="text-sm text-muted-foreground mb-2">{dateRange}</p>
                    )}
                    {phase.description && (
                      <p className="text-sm text-muted-foreground">{phase.description}</p>
                    )}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

