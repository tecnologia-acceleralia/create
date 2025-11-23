import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/utils/cn';
import { formatDate, formatDateRange } from '@/utils/date';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMultilingualText } from '@/utils/multilingual';
import type { MultilingualText } from '@/services/events';

type EventLike =
  | {
      id: number | string;
      name: MultilingualText | string;
      description?: MultilingualText | string | null;
      start_date: string;
      end_date: string;
      status?: string | null;
      video_url?: string | null;
      is_public?: boolean | null;
      publish_start_at?: string | null;
      publish_end_at?: string | null;
      allow_open_registration?: boolean | null;
    }
  | {
      id: number | string;
      name: MultilingualText | string;
      description?: MultilingualText | string | null;
      startDate: string;
      endDate: string;
      status?: string | null;
      videoUrl?: string | null;
      isPublic?: boolean | null;
      publishStartAt?: string | null;
      publishEndAt?: string | null;
      allowOpenRegistration?: boolean | null;
    };

type EventCardProps = {
  event: EventLike;
  to?: string;
  className?: string;
  actions?: ReactNode;
  children?: ReactNode;
  showVideo?: boolean;
  showStatus?: boolean;
  showPublishWindow?: boolean;
};

function resolveVideoUrl(raw?: string | null) {
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

function normalizeEvent(event: EventLike) {
  if ('start_date' in event) {
    return {
      name: event.name,
      description: event.description ?? null,
      startDate: event.start_date,
      endDate: event.end_date,
      status: event.status ?? null,
      videoUrl: event.video_url ?? null,
      isPublic: event.is_public ?? null,
      publishStartAt: event.publish_start_at ?? null,
      publishEndAt: event.publish_end_at ?? null,
      allowOpenRegistration:
        event.allow_open_registration ?? (event as Record<string, any>).allowOpenRegistration ?? null
    };
  }

  return {
    name: event.name,
    description: event.description ?? null,
    startDate: event.startDate,
    endDate: event.endDate,
    status: event.status ?? null,
    videoUrl: event.videoUrl ?? null,
    isPublic: event.isPublic ?? null,
    publishStartAt: event.publishStartAt ?? null,
    publishEndAt: event.publishEndAt ?? null,
    allowOpenRegistration: event.allowOpenRegistration ?? null
  };
}

export function EventCard({ event, to, className, actions, children, showVideo = false, showStatus = true, showPublishWindow = true }: EventCardProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language ?? 'es';
  const normalized = useMemo(() => normalizeEvent(event), [event]);
  const hasActions = Boolean(actions);
  const hasExtraContent = Boolean(children);
  const showVisibility = normalized.isPublic !== null && normalized.isPublic !== undefined;
  const publishWindowAvailable = Boolean(normalized.publishStartAt && normalized.publishEndAt);

  // Convertir el nombre y descripción del evento a string usando getMultilingualText
  const currentLang = useMemo(() => (locale.split('-')[0] || 'es') as 'es' | 'ca' | 'en', [locale]);
  const eventName = useMemo(() => getMultilingualText(event.name, currentLang), [event.name, currentLang]);
  const eventDescription = useMemo(() => getMultilingualText(event.description, currentLang), [event.description, currentLang]);

  const statusLabel = normalized.status
    ? safeTranslate(t, `events.status.${normalized.status}`, {
        defaultValue: normalized.status.charAt(0).toUpperCase() + normalized.status.slice(1)
      })
    : null;

  const videoSrc = useMemo(() => (showVideo ? resolveVideoUrl(normalized.videoUrl) : null), [showVideo, normalized.videoUrl]);

  const titleContent = hasActions && to ? (
    <Link to={to} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tenant-primary)] focus-visible:ring-offset-2 rounded">
      {eventName}
    </Link>
  ) : (
    eventName
  );

  const content = (
    <>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-semibold text-[color:var(--tenant-secondary)]">
            {titleContent}
          </CardTitle>
          {statusLabel && showStatus ? (
            <span className="rounded-full bg-[color:var(--tenant-primary)]/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--tenant-primary)]">
              {statusLabel}
            </span>
          ) : null}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {formatDateRange(locale, normalized.startDate, normalized.endDate) ?? '—'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {eventDescription ? <p className="text-muted-foreground">{eventDescription}</p> : null}

        {showVisibility ? (
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1',
                normalized.isPublic
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-amber-500/10 text-amber-600'
              )}
            >
              {normalized.isPublic ? safeTranslate(t, 'events.publicBadge') : safeTranslate(t, 'events.privateBadge')}
            </span>
            {showPublishWindow && publishWindowAvailable ? (
              <span className="text-muted-foreground">
                {safeTranslate(t, 'events.publishWindow', {
                  start: formatDate(locale, normalized.publishStartAt ?? null),
                  end: formatDate(locale, normalized.publishEndAt ?? null)
                })}
              </span>
            ) : null}
          </div>
        ) : null}

        {videoSrc ? (
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-border/40">
            <iframe
              title={eventName}
              src={videoSrc}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : null}

        {hasActions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        {hasExtraContent ? <div className="space-y-3">{children}</div> : null}
      </CardContent>
    </>
  );

  // When there are actions, don't make the entire card clickable to avoid nested <a> tags
  if (to && !hasActions) {
    return (
      <Card
        asChild
        className={cn(
          'border border-border/60 bg-card/80 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tenant-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className
        )}
      >
        <Link to={to} className="block h-full rounded-xl">
          {content}
        </Link>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'border border-border/60 bg-card/80 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md',
        className
      )}
    >
      {content}
    </Card>
  );
}

export type { EventCardProps };

