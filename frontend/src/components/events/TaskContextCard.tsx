import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ExpandableSection } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateRange } from '@/utils/date';
import { useTenantPath } from '@/hooks/useTenantPath';
import type { Task, Phase } from '@/services/events';

type TaskContextCardProps = {
  readonly task: Task;
  readonly phase?: Phase;
  readonly locale?: string;
  readonly defaultExpanded?: boolean;
  readonly className?: string;
  readonly showActions?: boolean;
  readonly eventId?: number;
  readonly isPhaseZero?: boolean;
  readonly periodStatus?: {
    readonly isValid: boolean;
    readonly reason: 'not_started' | 'ended' | 'no_dates' | 'valid';
  };
};

export function TaskContextCard({
  task,
  phase,
  locale = 'es',
  defaultExpanded = true,
  className,
  showActions = true,
  eventId,
  isPhaseZero = false,
  periodStatus
}: TaskContextCardProps) {
  const { t } = useTranslation();
  const tenantPath = useTenantPath();

  const hasValidDates = phase?.start_date || phase?.end_date;

  return (
    <div className={`rounded-2xl border border-border/70 bg-card/80 p-6 ${className ?? ''}`}>
      <ExpandableSection
        defaultExpanded={defaultExpanded}
        header={
          <div className="flex items-start justify-between gap-3 flex-1">
            <div className="flex-1">
              <p className="text-sm font-semibold text-muted-foreground mb-1">Tarea</p>
              <p className="text-base font-semibold text-foreground">{task.title}</p>
              {hasValidDates && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateRange(locale, phase?.start_date ?? null, phase?.end_date ?? null) ??
                    t('events.taskPeriodNotSet')}
                </p>
              )}
              {task.description ? (
                <p className="text-sm text-muted-foreground mt-2">{task.description}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {task.is_required ? (
                <Badge variant="secondary">{t('events.taskRequiredBadge')}</Badge>
              ) : null}
            </div>
          </div>
        }
      >
        <div className="space-y-3 mt-3">
          {task.intro_html ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: task.intro_html }}
            />
          ) : null}
          {showActions && !isPhaseZero && eventId && task.delivery_type !== 'none' && (
            <div className="flex flex-wrap gap-3 items-center">
              {periodStatus?.isValid ? (
                <Button asChild>
                  <Link to={tenantPath(`dashboard/events/${eventId}/tasks/${task.id}`)}>
                    {t('submissions.register')}
                  </Link>
                </Button>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      if (periodStatus?.reason === 'not_started') {
                        return t('events.taskPeriodNotStarted');
                      }
                      if (periodStatus?.reason === 'ended') {
                        return t('events.taskPeriodEnded');
                      }
                      return t('events.taskPeriodNotAvailable');
                    })()}
                  </p>
                  <Button variant="outline" disabled>
                    {t('submissions.register')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </ExpandableSection>
    </div>
  );
}

