import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ExpandableSection } from '@/components/common';
import { formatDateRange } from '@/utils/date';
import { resolveAssetMarkers } from '@/utils/asset-markers';
import { getEventAssets } from '@/services/event-assets';
import type { Phase } from '@/services/events';

type PhaseContextCardProps = {
  phase: Phase;
  locale?: string;
  defaultExpanded?: boolean;
  className?: string;
  eventId?: number;
};

export function PhaseContextCard({
  phase,
  locale = 'es',
  defaultExpanded = true,
  className,
  eventId
}: PhaseContextCardProps) {
  const { t } = useTranslation();

  // Cargar assets del evento para resolver marcadores
  const { data: assets = [] } = useQuery({
    queryKey: ['eventAssets', eventId],
    queryFn: () => (eventId ? getEventAssets(eventId) : Promise.resolve([])),
    enabled: Boolean(eventId && phase.intro_html)
  });

  // Resolver marcadores de assets en el HTML antes de renderizar
  const resolvedIntroHtml = useMemo(() => {
    if (!phase.intro_html || !assets.length) {
      return phase.intro_html;
    }
    return resolveAssetMarkers(phase.intro_html, assets);
  }, [phase.intro_html, assets]);

  if (!resolvedIntroHtml) {
    return null;
  }

  return (
    <div className={`rounded-2xl border border-border/70 bg-card/80 p-6 ${className ?? ''}`}>
      <ExpandableSection
        defaultExpanded={defaultExpanded}
        header={
          <div className="flex-1">
            <p className="text-sm font-semibold text-muted-foreground mb-1">Fase</p>
            <p className="text-base font-semibold text-foreground">
              {phase.description ? `${phase.name} - ${phase.description}` : phase.name}
            </p>
            {(phase.start_date || phase.end_date) && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatDateRange(locale, phase.start_date ?? null, phase.end_date ?? null) ??
                  t('events.taskPeriodNotSet')}
              </p>
            )}
          </div>
        }
        contentClassName="prose prose-sm max-w-none mt-3"
      >
        <div dangerouslySetInnerHTML={{ __html: resolvedIntroHtml }} />
      </ExpandableSection>
    </div>
  );
}

