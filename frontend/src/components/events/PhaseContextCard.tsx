import { useTranslation } from 'react-i18next';
import { ExpandableSection } from '@/components/common';
import { formatDateRange } from '@/utils/date';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMultilingualText } from '@/utils/multilingual';
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
  className
}: PhaseContextCardProps) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.split('-')[0] || locale || 'es') as 'es' | 'ca' | 'en';
  
  const phaseName = getMultilingualText(phase.name, currentLang);
  const phaseDescription = phase.description ? getMultilingualText(phase.description, currentLang) : null;
  const introHtml = phase.intro_html ? getMultilingualText(phase.intro_html, currentLang) : null;

  if (!introHtml) {
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
              {phaseDescription ? `${phaseName} - ${phaseDescription}` : phaseName}
            </p>
            {(phase.start_date || phase.end_date) && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatDateRange(locale, phase.start_date ?? null, phase.end_date ?? null) ??
                  safeTranslate(t, 'events.taskPeriodNotSet')}
              </p>
            )}
          </div>
        }
        contentClassName="mt-3"
      >
        <div className="mx-auto w-full max-w-4xl">
          <div className="html-content">
            <div dangerouslySetInnerHTML={{ __html: introHtml }} />
          </div>
        </div>
      </ExpandableSection>
    </div>
  );
}

