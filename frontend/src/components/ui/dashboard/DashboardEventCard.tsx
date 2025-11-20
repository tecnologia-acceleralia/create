import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useTenantPath } from '@/hooks/useTenantPath';

import { Button } from '@/components/ui/button';
import { EventCard } from '@/components/events/EventCard';
import type { Event } from '@/services/events';

type DashboardEventCardProps = {
  event: Event;
  className?: string;
};

/**
 * Componente unificado de card de evento para el dashboard.
 * Detecta automáticamente si el usuario está enrolado y muestra los botones correspondientes.
 * Se usa tanto en "Mis eventos" como en "Todos los eventos".
 */
export function DashboardEventCard({ event, className }: DashboardEventCardProps) {
  const { t } = useTranslation();
  const tenantPath = useTenantPath();

  const isRegistered = Boolean(event.is_registered);
  const hasTeam = Boolean(event.has_team);

  // Ruta para ver detalles del evento (landing page pública)
  const viewDetailsPath = tenantPath(`events/${event.id}`);

  // Si el usuario está enrolado, mostrar botones específicos según si tiene equipo o no
  if (isRegistered) {
    return (
      <EventCard
        event={event}
        className={className}
        showStatus={false}
        showPublishWindow={false}
        actions={
          <>
            {hasTeam ? (
              <>
                <Button asChild>
                  <Link to={tenantPath(`dashboard/events/${event.id}/team`)}>{t('teams.title')}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={tenantPath(`dashboard/events/${event.id}/view`)}>{t('auth.submit')}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={viewDetailsPath}>{t('events.viewDetails')}</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline">
                  <Link to={tenantPath(`dashboard/events/${event.id}/projects`)}>
                    {t('projects.title')}
                  </Link>
                </Button>
                <Button asChild>
                  <Link to={tenantPath(`dashboard/events/${event.id}/projects#create`)}>
                    {t('projects.create')}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={tenantPath(`dashboard/events/${event.id}/view`)}>{t('auth.submit')}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={viewDetailsPath}>{t('events.viewDetails')}</Link>
                </Button>
              </>
            )}
          </>
        }
      />
    );
  }

  // Si el usuario NO está enrolado, mostrar solo el botón "Ver detalles"
  return (
    <EventCard
      event={event}
      className={className}
      showStatus={false}
      actions={
        <Button asChild variant="outline">
          <Link to={viewDetailsPath}>{t('events.viewDetails')}</Link>
        </Button>
      }
    />
  );
}

