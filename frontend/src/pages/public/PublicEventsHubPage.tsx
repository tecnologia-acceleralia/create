import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Spinner } from '@/components/common';
import { getAllPublicEvents } from '@/services/public';
import { useTenant } from '@/context/TenantContext';
import { EventCard } from '@/components/events/EventCard';
import { PublicHero } from '@/components/public';

type PublicEvent = Awaited<ReturnType<typeof getAllPublicEvents>>[number];

function useGroupedEvents(events: PublicEvent[]) {
  return useMemo(() => {
    return events.reduce<Record<string, PublicEvent[]>>((acc, event) => {
      const key = event.tenant?.slug ?? 'unknown';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(event);
      return acc;
    }, {});
  }, [events]);
}

function PublicEventsHubPage() {
  const { t, i18n } = useTranslation();
  const { tenantSlug, setTenantSlug } = useTenant();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (tenantSlug) {
      setTenantSlug(null);
    }
  }, [tenantSlug, setTenantSlug]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    getAllPublicEvents()
      .then(data => {
        if (isMounted) {
          setEvents(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(true);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const publishedEvents = useMemo(
    () => events.filter(event => event.status?.toLowerCase() === 'published'),
    [events]
  );

  const groupedEvents = useGroupedEvents(publishedEvents);
  const tenantKeys = Object.keys(groupedEvents);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-white to-background">
      <PublicHero
        title={t('publicHub.title')}
        subtitle={t('publicHub.subtitle')}
        className="mx-auto max-w-5xl text-center"
      />

      <section className="mx-auto max-w-5xl px-6 pb-16">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : null}

        {!loading && error ? (
          <p className="text-center text-sm text-destructive">{t('publicHub.error')}</p>
        ) : null}

        {!loading && !error && publishedEvents.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">{t('publicHub.noEvents')}</p>
        ) : null}

        {!loading && !error && publishedEvents.length > 0 ? (
          <div className="space-y-10">
            {tenantKeys.map(key => {
              const tenantEvents = groupedEvents[key];
              const tenant = tenantEvents[0]?.tenant ?? null;
              const tenantName = tenant?.name ?? '';
              const tenantSlugForLinks = tenant?.slug ?? '';

              return (
                <div key={key} className="space-y-4">
                  <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
                    <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
                      {tenant?.logo_url ? (
                        <div
                          className="flex h-12 w-auto items-center justify-center rounded border border-border p-2"
                          style={{
                            backgroundColor: tenant.primary_color || '#0ea5e9'
                          }}
                        >
                          <img
                            src={tenant.logo_url}
                            alt={tenantName}
                            className="h-full w-auto max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : null}
                      <div>
                        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                          {t('publicHub.tenantLabel')}
                        </p>
                        <h2 className="text-2xl font-semibold text-foreground">
                          {tenantSlugForLinks ? (
                            <Link
                              to={`/${tenantSlugForLinks}`}
                              className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              {tenantName}
                            </Link>
                          ) : (
                            tenantName
                          )}
                        </h2>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {tenantEvents.map(event => (
                      <EventCard
                        key={`${event.id}-${event.start_date}`}
                        event={event}
                        to={tenantSlugForLinks ? `/${tenantSlugForLinks}/events/${event.id}` : undefined}
                        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        showVideo
                        showStatus={false}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default PublicEventsHubPage;


