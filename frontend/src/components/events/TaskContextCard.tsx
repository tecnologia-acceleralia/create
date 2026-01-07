import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ExpandableSection } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateRange } from '@/utils/date';
import { useTenantPath } from '@/hooks/useTenantPath';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMultilingualText } from '@/utils/multilingual';
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
  const { t, i18n } = useTranslation();
  const tenantPath = useTenantPath();
  const currentLang = (i18n.language?.split('-')[0] || locale || 'es') as 'es' | 'ca' | 'en';

  const taskTitle = getMultilingualText(task.title, currentLang);
  const taskDescription = task.description ? getMultilingualText(task.description, currentLang) : null;
  const introHtml = task.intro_html ? getMultilingualText(task.intro_html, currentLang) : null;

  const hasValidDates = phase?.start_date || phase?.end_date;

  // Función para convertir texto plano con saltos de línea en HTML
  // Si el texto ya contiene HTML, lo devuelve tal cual; si no, convierte \n en HTML
  const formatDescriptionAsHtml = (text: string): string => {
    if (!text) return '';
    // Si el texto ya contiene etiquetas HTML, devolverlo tal cual
    if (/<[a-z][\s\S]*>/i.test(text)) {
      return text;
    }
    // Si es texto plano, convertir saltos de línea en HTML
    // Dividir por párrafos (doble salto de línea) y procesar cada uno
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.length === 0) return '';
    
    return paragraphs
      .map(para => {
        // Convertir saltos de línea simples en <br>
        const withBreaks = para.trim().replace(/\n/g, '<br>');
        return `<p>${withBreaks}</p>`;
      })
      .join('');
  };

  return (
    <div className={`rounded-2xl border border-border/70 bg-card/80 p-6 ${className ?? ''}`}>
      <ExpandableSection
        defaultExpanded={defaultExpanded}
        header={
          <div className="flex items-start justify-between gap-3 flex-1">
            <div className="flex-1">
              <p className="text-sm font-semibold text-muted-foreground mb-1">Tarea</p>
              <p className="text-base font-semibold text-foreground">{taskTitle}</p>
              {hasValidDates && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateRange(locale, phase?.start_date ?? null, phase?.end_date ?? null) ??
                    safeTranslate(t, 'events.taskPeriodNotSet')}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {task.is_required ? (
                <Badge variant="secondary">{safeTranslate(t, 'events.taskRequiredBadge')}</Badge>
              ) : null}
            </div>
          </div>
        }
      >
        <div className="space-y-3 mt-3">
          {taskDescription ? (
            <div className="mx-auto w-full max-w-4xl">
              <div className="html-content">
                <div dangerouslySetInnerHTML={{ __html: formatDescriptionAsHtml(taskDescription) }} />
              </div>
            </div>
          ) : null}
          {introHtml ? (
            <div className="mx-auto w-full max-w-4xl">
              <div className="html-content">
                <div dangerouslySetInnerHTML={{ __html: introHtml }} />
              </div>
            </div>
          ) : null}
          {showActions && !isPhaseZero && eventId && task.delivery_type !== 'none' && (
            <div className="flex flex-wrap gap-3 items-center">
              {periodStatus?.isValid ? (
                <Button asChild>
                  <Link to={tenantPath(`dashboard/events/${eventId}/tasks/${task.id}`)}>
                    {safeTranslate(t, 'submissions.register')}
                  </Link>
                </Button>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      if (periodStatus?.reason === 'not_started') {
                        return safeTranslate(t, 'events.taskPeriodNotStarted');
                      }
                      if (periodStatus?.reason === 'ended') {
                        return safeTranslate(t, 'events.taskPeriodEnded');
                      }
                      return safeTranslate(t, 'events.taskPeriodNotAvailable');
                    })()}
                  </p>
                  <Button variant="outline" disabled>
                    {safeTranslate(t, 'submissions.register')}
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

