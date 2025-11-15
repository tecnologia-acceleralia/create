import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { getPublicEvents } from '@/services/public';
import { EventCard } from '@/components/events/EventCard';
import { PublicHero, PublicEventsSection } from '@/components/public';
import { createSurfaceTheme } from '@/utils/color';

type PublicEvent = Awaited<ReturnType<typeof getPublicEvents>>[number];

function LandingPage() {
  const { t, i18n } = useTranslation();
  const { branding, tenantSlug } = useTenant();
  const tenantPath = useTenantPath();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const currentLanguage = i18n.language?.toLowerCase() ?? 'es';
  const baseLanguage = currentLanguage.split('-')[0];
  const heroVariant = branding.heroContent[currentLanguage] ?? branding.heroContent[baseLanguage] ?? null;
  const heroTitle =
    heroVariant && typeof heroVariant.title === 'string' && heroVariant.title.trim()
      ? heroVariant.title.trim()
      : t('landing.heroTitle');
  const heroSubtitle =
    heroVariant && typeof heroVariant.subtitle === 'string' && heroVariant.subtitle.trim()
      ? heroVariant.subtitle.trim()
      : t('landing.heroSubtitle');

  const landingTheme = useMemo(() => createSurfaceTheme(branding.primaryColor), [branding.primaryColor]);
  const landingStyle = useMemo<CSSProperties>(
    () => ({
      '--landing-bg': landingTheme.subtle,
      '--landing-surface': landingTheme.surface,
      '--landing-border': landingTheme.border,
      '--landing-hover': landingTheme.hover,
      '--landing-foreground': landingTheme.foreground,
      '--landing-muted': landingTheme.muted,
      '--landing-accent': branding.accentColor
    }),
    [landingTheme, branding.accentColor]
  );

  useEffect(() => {
    if (!tenantSlug) return;
    getPublicEvents(tenantSlug).then(setEvents).catch(() => setEvents([]));
  }, [tenantSlug]);

  const publishedEvents = useMemo(
    () => events.filter(event => event.status?.toLowerCase() === 'published'),
    [events]
  );

  return (
    <div
      className="relative overflow-hidden"
      style={landingStyle}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color:var(--landing-bg)] via-transparent to-[color:var(--landing-surface)]"
        aria-hidden="true"
      />
      <div className="relative z-10 space-y-12 pb-12">
        <PublicHero
          title={heroTitle}
          subtitle={heroSubtitle}
          logoUrl={branding.logoUrl}
          logoAlt={t('navigation.brand', { defaultValue: 'Create' })}
          actions={null}
        />

        <PublicEventsSection
          title={t('events.title')}
          events={publishedEvents}
          emptyMessage={<p className="text-sm text-[color:var(--landing-muted)]">{t('landing.noEvents')}</p>}
          renderEvent={event => (
            <EventCard
              key={event.id}
              event={event}
              to={tenantSlug ? tenantPath(`events/${event.id}`) : undefined}
              showVideo
            />
          )}
        />
      </div>
    </div>
  );
}

export default LandingPage;

