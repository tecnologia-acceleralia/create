import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { PageContainer, Spinner } from '@/components/common';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMultilingualText } from '@/utils/multilingual';
import { getPublicEvents } from '@/services/public';
import { PublicHero } from '@/components/public';
import { useAuth } from '@/context/AuthContext';
import { formatDateRange } from '@/utils/date';

type PublicEvent = Awaited<ReturnType<typeof getPublicEvents>>[number];

function getEmbedUrl(raw?: string | null) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('youtube.com')) {
      const directId = parsed.searchParams.get('v');
      if (directId) {
        return `https://www.youtube.com/embed/${directId}`;
      }

      if (parsed.pathname.startsWith('/embed/')) {
        return `https://www.youtube.com${parsed.pathname}`;
      }

      const shortId = parsed.pathname
        .split('/')
        .reverse()
        .find(Boolean);
      if (shortId) {
        return `https://www.youtube.com/embed/${shortId}`;
      }
    }

    if (host.includes('youtu.be')) {
      const videoId = parsed.pathname.split('/').find(Boolean);
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  } catch {
    return raw;
  }

  return raw;
}

function EventLandingPage() {
  const { tenantSlug } = useTenant();
  const tenantPath = useTenantPath();
  const { tenantSlug: tenantSlugFromParams, eventId } = useParams<{ tenantSlug?: string; eventId?: string }>();
  const { t, i18n } = useTranslation();
  const { user, activeMembership, memberships, isSuperAdmin, loading: authLoading } = useAuth();
  const [eventDetail, setEventDetail] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const effectiveTenantSlug = tenantSlug ?? tenantSlugFromParams ?? null;
  const canAccessTenant = useMemo(() => {
    if (!effectiveTenantSlug || !user) {
      return false;
    }
    if (isSuperAdmin) {
      return true;
    }
    // Verificar si el activeMembership coincide con el tenant actual
    if (activeMembership?.tenant?.slug === effectiveTenantSlug && activeMembership.status === 'active') {
      return true;
    }
    // Si no coincide, buscar en todas las membresías si hay una válida para este tenant
    const validMembership = memberships.find(
      membership => membership.tenant?.slug === effectiveTenantSlug && membership.status === 'active'
    );
    return Boolean(validMembership);
  }, [activeMembership?.tenant?.slug, activeMembership?.status, effectiveTenantSlug, isSuperAdmin, user, memberships]);

  // Determinar la ruta correcta según el rol del usuario
  const getEventAccessPath = useMemo(() => {
    if (!eventDetail) {
      return '';
    }

    const roleScopes = new Set(
      activeMembership?.roles?.map(role => role.scope) ?? user?.roleScopes ?? []
    );
    
    // Si es admin u organizador, va a la vista de administración
    const isAdminOrOrganizer = isSuperAdmin || 
      roleScopes.has('tenant_admin') || 
      roleScopes.has('organizer');
    
    // Si es participante o no tiene scopes específicos pero tiene membresía activa, va a la vista de participante
    const isParticipant = roleScopes.has('participant') || 
      roleScopes.has('team_captain') ||
      (activeMembership?.status === 'active' && !isAdminOrOrganizer);

    const basePath = tenantSlug
      ? tenantPath(`dashboard/events/${eventDetail.id}`)
      : tenantSlugFromParams
      ? `/${tenantSlugFromParams}/dashboard/events/${eventDetail.id}`
      : `/dashboard/events/${eventDetail.id}`;

    if (isAdminOrOrganizer) {
      return basePath;
    } else if (isParticipant) {
      return `${basePath}/home`;
    }
    
    // Por defecto, intentar la vista de participante
    return `${basePath}/home`;
  }, [eventDetail, activeMembership, user, isSuperAdmin, tenantSlug, tenantSlugFromParams, tenantPath]);

  useEffect(() => {
    if (!effectiveTenantSlug || !eventId) {
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(false);

    getPublicEvents(effectiveTenantSlug)
      .then(events => {
        if (!isMounted) {
          return;
        }
        const found = events.find(candidate => String(candidate.id) === eventId);
        if (found) {
          setEventDetail(found);
        } else {
          setEventDetail(null);
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
  }, [effectiveTenantSlug, eventId]);

  const locale = i18n.language ?? 'es';

  // Obtener el idioma actual del usuario (debe estar antes de cualquier return)
  const currentLang = useMemo(() => {
    const lang = i18n.language?.split('-')[0] || 'es';
    return (lang === 'es' || lang === 'ca' || lang === 'en' ? lang : 'es') as 'es' | 'ca' | 'en';
  }, [i18n.language]);

  const formattedDates = useMemo(() => {
    if (!eventDetail) {
      return null;
    }

    return (
      formatDateRange(locale, eventDetail.start_date, eventDetail.end_date, {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }) ?? null
    );
  }, [eventDetail, locale]);

  // Asegurar que todos los valores multilingües sean siempre strings válidos (debe estar antes de cualquier return)
  const eventName = useMemo(() => {
    if (!eventDetail) return '';
    const raw = getMultilingualText(eventDetail.name, currentLang);
    return typeof raw === 'string' ? raw : String(raw || '');
  }, [eventDetail, currentLang]);
  
  const eventDescription = useMemo(() => {
    if (!eventDetail?.description) return undefined;
    const raw = getMultilingualText(eventDetail.description, currentLang);
    return typeof raw === 'string' ? raw : raw ? String(raw) : undefined;
  }, [eventDetail, currentLang]);
  
  // Extraer el HTML en el idioma del usuario (debe estar antes de cualquier return)
  const eventDescriptionHtml = useMemo(() => {
    if (!eventDetail?.description_html) return undefined;
    const raw = getMultilingualText(eventDetail.description_html, currentLang);
    return typeof raw === 'string' && raw.trim() ? raw : undefined;
  }, [eventDetail, currentLang]);

  const embedUrl = useMemo(() => {
    return eventDetail ? getEmbedUrl(eventDetail.video_url) : null;
  }, [eventDetail]);

  const isRegistrationOpen = useMemo(() => {
    return eventDetail?.allow_open_registration !== false;
  }, [eventDetail]);

  if (!effectiveTenantSlug) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <Spinner fullHeight />;
  }

  if (error) {
    return (
      <PageContainer className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-destructive">{safeTranslate(t, 'eventLanding.error')}</p>
        <Button asChild variant="outline">
          <Link to={tenantSlug ? tenantPath('') : tenantSlugFromParams ? `/${tenantSlugFromParams}` : '/'}>
            {safeTranslate(t, 'eventLanding.backToHome')}
          </Link>
        </Button>
      </PageContainer>
    );
  }

  if (!eventDetail) {
    return (
      <PageContainer className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{safeTranslate(t, 'eventLanding.notFound')}</p>
        <Button asChild variant="outline">
          <Link to={tenantSlug ? tenantPath('') : tenantSlugFromParams ? `/${tenantSlugFromParams}` : '/'}>
            {safeTranslate(t, 'eventLanding.backToHome')}
          </Link>
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-10">
      <div className="flex justify-center">
        {formattedDates ? (
          <span className="inline-flex items-center rounded-full border border-border/70 bg-card/60 px-4 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {formattedDates}
          </span>
        ) : null}
      </div>
      <PublicHero
        withBackground={false}
        align="center"
        title={eventName}
        subtitle={eventDescription}
        actions={
          isRegistrationOpen ? (
            authLoading ? null : canAccessTenant ? (
              <Button size="lg" asChild>
                <Link to={getEventAccessPath}>
                  {safeTranslate(t, 'landing.accessCta')}
                </Link>
              </Button>
            ) : user ? (
              // Si el usuario está logueado pero no tiene acceso al tenant, no mostrar acciones
              null
            ) : (
              <>
                <Button size="lg" asChild>
                  <Link
                    to={{
                      pathname: tenantSlug
                        ? tenantPath('register')
                        : tenantSlugFromParams
                        ? `/${tenantSlugFromParams}/register`
                        : '/register',
                      search: `?eventId=${eventDetail.id}`
                    }}
                  >
                    {safeTranslate(t, 'eventLanding.registerCta')}
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link
                    to={
                      tenantSlug
                        ? tenantPath('login')
                        : tenantSlugFromParams
                        ? `/${tenantSlugFromParams}/login`
                        : '/login'
                    }
                    state={{ intent: 'login', eventId: eventDetail.id }}
                  >
                    {safeTranslate(t, 'eventLanding.loginCta')}
                  </Link>
                </Button>
              </>
            )
          ) : (
            <p className="rounded-full border border-border/70 bg-card/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {safeTranslate(t, 'eventLanding.registrationClosed')}
            </p>
          )
        }
        className="rounded-2xl border border-border/60 bg-card/80 shadow-sm"
      />

      {embedUrl ? (
        <div className="mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-border/60 shadow-lg">
          <iframe
            title={eventName}
            src={embedUrl}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : null}

      {eventDescriptionHtml ? (
        <div className="mx-auto w-full max-w-4xl">
          <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
            <div 
              className="html-content"
              dangerouslySetInnerHTML={{ __html: eventDescriptionHtml }} 
            />
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}

export default EventLandingPage;

