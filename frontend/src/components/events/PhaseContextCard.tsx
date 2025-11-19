import { useTranslation } from 'react-i18next';
import { ExpandableSection } from '@/components/common';
import { formatDateRange } from '@/utils/date';
import type { Phase } from '@/services/events';

type PhaseContextCardProps = {
  phase: Phase;
  locale?: string;
  defaultExpanded?: boolean;
  className?: string;
};

export function PhaseContextCard({
  phase,
  locale = 'es',
  defaultExpanded = true,
  className
}: PhaseContextCardProps) {
  const { t } = useTranslation();

  if (!phase.intro_html) {
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
        <div dangerouslySetInnerHTML={{ __html: phase.intro_html }} />
      </ExpandableSection>
    </div>
  );
}

