import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/utils/cn';

type EventLike =
  | {
      id: number | string;
      name: string;
      description?: string | null;
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
      name: string;
      description?: string | null;
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

function formatDate(locale: string, rawDate: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return formatter.format(new Date(rawDate));
}

function formatDateRange(locale: string, startRaw: string, endRaw: string) {
  const start = formatDate(locale, startRaw);
  const end = formatDate(locale, endRaw);

  return `${start} — ${end}`;
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

export function EventCard({ event, to, className, actions, children, showVideo = false, showStatus = true }: EventCardProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language ?? 'es';
  const normalized = useMemo(() => normalizeEvent(event), [event]);
  const hasActions = Boolean(actions);
  const hasExtraContent = Boolean(children);
  const showVisibility = normalized.isPublic !== null && normalized.isPublic !== undefined;
  const publishWindowAvailable = Boolean(normalized.publishStartAt && normalized.publishEndAt);

  const statusLabel = normalized.status
    ? t(`events.status.${normalized.status}`, {
        defaultValue: normalized.status.charAt(0).toUpperCase() + normalized.status.slice(1)
      })
    : null;

  const videoSrc = useMemo(() => (showVideo ? resolveVideoUrl(normalized.videoUrl) : null), [showVideo, normalized.videoUrl]);

  const content = (
    <>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-semibold text-[color:var(--tenant-secondary)]">
            {normalized.name}
          </CardTitle>
          {statusLabel && showStatus ? (
            <span className="rounded-full bg-[color:var(--tenant-primary)]/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--tenant-primary)]">
              {statusLabel}
            </span>
          ) : null}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {formatDateRange(locale, normalized.startDate, normalized.endDate)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {normalized.description ? <p className="text-muted-foreground">{normalized.description}</p> : null}

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
              {normalized.isPublic ? t('events.publicBadge') : t('events.privateBadge')}
            </span>
            {publishWindowAvailable ? (
              <span className="text-muted-foreground">
                {t('events.publishWindow', {
                  start: formatDate(locale, normalized.publishStartAt!),
                  end: formatDate(locale, normalized.publishEndAt!)
                })}
              </span>
            ) : null}
          </div>
        ) : null}

        {videoSrc ? (
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-border/40">
            <iframe
              title={normalized.name}
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

  if (to) {
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

