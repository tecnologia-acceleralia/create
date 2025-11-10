import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { PageContainer, Spinner } from '@/components/common';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { getPublicEvents } from '@/services/public';
import { PublicHero } from '@/components/public';

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

function formatDate(locale: string, raw: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(raw));
}

function EventLandingPage() {
  const { tenantSlug } = useTenant();
  const tenantPath = useTenantPath();
  const { tenantSlug: tenantSlugFromParams, eventId } = useParams<{ tenantSlug?: string; eventId?: string }>();
  const { t, i18n } = useTranslation();
  const [eventDetail, setEventDetail] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const effectiveTenantSlug = tenantSlug ?? tenantSlugFromParams ?? null;

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
  const formattedDates = useMemo(() => {
    if (!eventDetail) {
      return null;
    }
    return `${formatDate(locale, eventDetail.start_date)} — ${formatDate(locale, eventDetail.end_date)}`;
  }, [eventDetail, locale]);

  if (!effectiveTenantSlug) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <Spinner fullHeight />;
  }

  if (error) {
    return (
      <PageContainer className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-destructive">{t('eventLanding.error')}</p>
        <Button asChild variant="outline">
          <Link to={tenantSlug ? tenantPath('') : tenantSlugFromParams ? `/${tenantSlugFromParams}` : '/'}>
            {t('eventLanding.backToHome')}
          </Link>
        </Button>
      </PageContainer>
    );
  }

  if (!eventDetail) {
    return (
      <PageContainer className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{t('eventLanding.notFound')}</p>
        <Button asChild variant="outline">
          <Link to={tenantSlug ? tenantPath('') : tenantSlugFromParams ? `/${tenantSlugFromParams}` : '/'}>
            {t('eventLanding.backToHome')}
          </Link>
        </Button>
      </PageContainer>
    );
  }

  const embedUrl = getEmbedUrl(eventDetail.video_url);
  const isRegistrationOpen = eventDetail.allow_open_registration !== false;

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
        title={eventDetail.name}
        subtitle={eventDetail.description}
        actions={
          isRegistrationOpen ? (
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
                  {t('eventLanding.registerCta')}
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
                  {t('eventLanding.loginCta')}
                </Link>
              </Button>
            </>
          ) : (
            <p className="rounded-full border border-border/70 bg-card/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('eventLanding.registrationClosed')}
            </p>
          )
        }
        className="rounded-2xl border border-border/60 bg-card/80 shadow-sm"
      />

      {embedUrl ? (
        <div className="mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-border/60 shadow-lg">
          <iframe
            title={eventDetail.name}
            src={embedUrl}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : null}
    </PageContainer>
  );
}

export default EventLandingPage;

