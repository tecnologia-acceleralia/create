import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '@/context/TenantContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPublicEvents } from '@/services/public';

type PublicEvent = Awaited<ReturnType<typeof getPublicEvents>>[number];

function LandingPage() {
  const { t } = useTranslation();
  const { branding, tenantSlug } = useTenant();
  const [events, setEvents] = useState<PublicEvent[]>([]);

  useEffect(() => {
    if (!tenantSlug) return;
    getPublicEvents(tenantSlug).then(setEvents).catch(() => setEvents([]));
  }, [tenantSlug]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-white to-background">
      <section className="flex flex-col items-center gap-6 px-6 py-16 text-center">
        {branding.logoUrl ? <img src={branding.logoUrl} alt="Tenant logo" className="h-20" /> : null}
        <h1 className="text-4xl font-bold" style={{ color: branding.primaryColor }}>
          {t('landing.heroTitle')}
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{t('landing.heroSubtitle')}</p>
        <div className="flex gap-4">
          <Button asChild>
            <Link to="/login">{t('landing.login')}</Link>
          </Button>
          <Button variant="outline" style={{ borderColor: branding.accentColor, color: branding.accentColor }}>
            {t('landing.exploreEvents')}
          </Button>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="mx-auto max-w-4xl space-y-6">
          <h2 className="text-2xl font-semibold" style={{ color: branding.secondaryColor }}>
            {t('events.title')}
          </h2>
          {events.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {events.map(event => (
                <Card key={event.id}>
                  <CardHeader>
                    <CardTitle>{event.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-muted-foreground">{event.description}</p>
                    <p>{new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}</p>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs uppercase tracking-wide">
                      {event.status}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('landing.noEvents')}</p>
          )}
        </div>
      </section>
    </main>
  );
}

export default LandingPage;

