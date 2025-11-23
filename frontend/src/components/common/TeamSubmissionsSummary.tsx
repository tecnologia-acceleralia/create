import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, FileText, CheckCircle2, Clock, Star } from 'lucide-react';
import { useState } from 'react';
import type { TeamSubmissionsAndEvaluationsSummary } from '@/services/teams';
import { format } from 'date-fns';
import { es, ca, enUS } from 'date-fns/locale';
import { safeTranslate } from '@/utils/i18n-helpers';

type TeamSubmissionsSummaryProps = {
  summary: TeamSubmissionsAndEvaluationsSummary;
};

const locales = { es, ca, en: enUS };

function getMultilingualText(text: string | { es: string; ca?: string; en?: string } | undefined, locale: string): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  const lang = locale === 'ca' ? 'ca' : locale === 'en' ? 'en' : 'es';
  return text[lang] || text.es || '';
}

export function TeamSubmissionsSummary({ summary }: TeamSubmissionsSummaryProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language ?? 'es';
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());

  const togglePhase = (phaseId: number) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(phaseId)) {
      newExpanded.delete(phaseId);
    } else {
      newExpanded.add(phaseId);
    }
    setExpandedPhases(newExpanded);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: locales[locale as keyof typeof locales] || es });
    } catch {
      return dateString;
    }
  };

  // Filtrar fases que tengan entregas o evaluaciones
  const phasesWithContent = summary.phases.filter(phase => {
    const totalSubmissions = phase.tasks.reduce((sum, task) => sum + task.submissions.length, 0);
    const hasEvaluations = phase.phase_evaluations.length > 0;
    return totalSubmissions > 0 || hasEvaluations;
  });

  if (phasesWithContent.length === 0) {
    return null;
  }

  // Función para obtener el idioma del usuario normalizado (es, ca, en)
  const getUserLanguage = (): string => {
    const lang = locale.split('-')[0]; // Obtener solo el código de idioma (es, ca, en)
    return ['es', 'ca', 'en'].includes(lang) ? lang : 'es';
  };

  const userLanguage = getUserLanguage();

  // Función para filtrar evaluaciones por idioma si tienen campo de idioma
  // Por ahora, mostramos todas las evaluaciones ya que no hay campo de idioma en el modelo
  const filterEvaluationsByLanguage = <T extends { language?: string; metadata?: { language?: string } }>(
    evaluations: T[]
  ): T[] => {
    return evaluations.filter(evaluation => {
      // Si la evaluación tiene un campo language explícito, filtrar por él
      if (evaluation.language) {
        const evalLang = evaluation.language.split('-')[0];
        return evalLang === userLanguage;
      }
      // Si tiene metadata con language, usar ese
      if (evaluation.metadata?.language) {
        const evalLang = evaluation.metadata.language.split('-')[0];
        return evalLang === userLanguage;
      }
      // Si no hay información de idioma, mostrar todas (comportamiento por defecto)
      return true;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{safeTranslate(t, 'teams.submissionsAndEvaluations')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {phasesWithContent.map(phase => {
          const isExpanded = expandedPhases.has(phase.phase_id);
          const phaseName = getMultilingualText(phase.phase_name, locale);
          const totalSubmissions = phase.tasks.reduce((sum, task) => sum + task.submissions.length, 0);
          const hasEvaluations = phase.phase_evaluations.length > 0;

          return (
            <div key={phase.phase_id} className="border rounded-md">
              <button
                onClick={() => togglePhase(phase.phase_id)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium truncate">{phaseName}</span>
                  {totalSubmissions > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {totalSubmissions} {safeTranslate(t, 'teams.submissions')}
                    </Badge>
                  )}
                  {hasEvaluations && (
                    <Badge variant="outline" className="text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      {phase.phase_evaluations.length}
                    </Badge>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t bg-muted/30">
                  {phase.tasks.map(task => {
                    const taskTitle = getMultilingualText(task.task_title, locale);
                    if (task.submissions.length === 0) return null;

                    return (
                      <div key={task.task_id} className="pt-2">
                        <div className="text-sm font-medium mb-2">{taskTitle}</div>
                        <div className="space-y-1.5 pl-4">
                          {task.submissions.map(submission => (
                            <div
                              key={submission.id}
                              className="flex items-start gap-2 text-xs bg-background rounded p-2 border"
                            >
                              <div className="flex-shrink-0 mt-0.5">
                                {submission.status === 'final' ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                ) : (
                                  <Clock className="h-3.5 w-3.5 text-yellow-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant={submission.type === 'final' ? 'default' : 'secondary'} className="text-xs">
                                    {submission.type === 'final' ? safeTranslate(t, 'teams.final') : safeTranslate(t, 'teams.provisional')}
                                  </Badge>
                                  {submission.files_count > 0 && (
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                      <FileText className="h-3 w-3" />
                                      {submission.files_count}
                                    </span>
                                  )}
                                  <span className="text-muted-foreground">{formatDate(submission.submitted_at)}</span>
                                </div>
                                {submission.evaluations.length > 0 && (() => {
                                  const filteredEvaluations = filterEvaluationsByLanguage(submission.evaluations);
                                  if (filteredEvaluations.length === 0) return null;
                                  return (
                                    <div className="mt-1.5 space-y-1">
                                      {filteredEvaluations.map(evaluation => (
                                        <div key={evaluation.id} className="flex items-center gap-2 text-muted-foreground">
                                          <Star className="h-3 w-3" />
                                          <span>
                                            {evaluation.score !== null && evaluation.score !== undefined
                                              ? `${evaluation.score}/10`
                                              : safeTranslate(t, 'teams.noScore')}
                                            {evaluation.status === 'final' && ` (${safeTranslate(t, 'teams.final')})`}
                                          </span>
                                          <span className="text-xs">{formatDate(evaluation.created_at)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {hasEvaluations && (() => {
                    const filteredPhaseEvaluations = filterEvaluationsByLanguage(phase.phase_evaluations);
                    if (filteredPhaseEvaluations.length === 0) return null;
                    return (
                      <div className="pt-2 border-t">
                        <div className="text-sm font-medium mb-2">{safeTranslate(t, 'teams.phaseEvaluation')}</div>
                        <div className="space-y-1.5 pl-4">
                          {filteredPhaseEvaluations.map(evaluation => (
                            <div key={evaluation.id} className="flex items-center gap-2 text-xs bg-background rounded p-2 border">
                              <Star className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>
                                    {evaluation.score !== null && evaluation.score !== undefined
                                      ? `${evaluation.score}/10`
                                      : safeTranslate(t, 'teams.noScore')}
                                  </span>
                                  {evaluation.status === 'final' && (
                                    <Badge variant="default" className="text-xs">
                                      {safeTranslate(t, 'teams.final')}
                                    </Badge>
                                  )}
                                  <span className="text-muted-foreground">{formatDate(evaluation.created_at)}</span>
                                </div>
                                {evaluation.comment && (
                                  <div className="mt-1 text-muted-foreground line-clamp-2">{evaluation.comment}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}

        {summary.project_evaluation && (() => {
          const filteredProjectEvaluation = filterEvaluationsByLanguage([summary.project_evaluation])[0];
          if (!filteredProjectEvaluation) return null;
          return (
            <div className="border rounded-md p-3 bg-blue-50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">{safeTranslate(t, 'teams.finalProjectEvaluation')}</span>
              </div>
              <div className="pl-6 space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span>
                    {filteredProjectEvaluation.score !== null && filteredProjectEvaluation.score !== undefined
                      ? `${filteredProjectEvaluation.score}/10`
                      : safeTranslate(t, 'teams.noScore')}
                  </span>
                  {filteredProjectEvaluation.status === 'final' && (
                    <Badge variant="default" className="text-xs">
                      {safeTranslate(t, 'teams.final')}
                    </Badge>
                  )}
                  <span className="text-muted-foreground">
                    {formatDate(filteredProjectEvaluation.created_at)}
                  </span>
                </div>
                {filteredProjectEvaluation.comment && (
                  <div className="text-muted-foreground line-clamp-2">{filteredProjectEvaluation.comment}</div>
                )}
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

