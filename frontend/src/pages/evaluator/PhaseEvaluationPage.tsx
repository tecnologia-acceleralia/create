import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Copy, ClipboardList, Sparkles, CheckCircle2 } from 'lucide-react';

import { DashboardLayout } from '@/components/layout';
import { Spinner } from '@/components/common';
import { getFileIcon } from '@/utils/files';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMultilingualText } from '@/utils/multilingual';
import { getSubmissions, getPhaseEvaluations, createPhaseEvaluation, createPhaseAiEvaluation, updatePhaseEvaluation, type Submission, type PhaseEvaluation } from '@/services/submissions';
import { getEventDetail, getRubrics, type PhaseRubric } from '@/services/events';
import { cn } from '@/utils/cn';

const evaluationSchema = z.object({
  comment: z.string().min(1, 'El comentario es requerido'),
  score: z.union([
    z.number().int().min(0, 'La puntuación mínima es 0').max(100, 'La puntuación máxima es 100'),
    z.nan()
  ]).optional()
});

type EvaluationFormValues = z.infer<typeof evaluationSchema>;

function PhaseEvaluationPage() {
  const { eventId, phaseId, teamId } = useParams();
  const numericEventId = Number(eventId);
  const numericPhaseId = Number(phaseId);
  const numericTeamId = Number(teamId);
  const navigate = useNavigate();
  const tenantPath = useTenantPath();
  const { t, i18n } = useTranslation();
  const locale = i18n.language ?? 'es';
  const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';
  const queryClient = useQueryClient();
  const { isSuperAdmin, activeMembership, user } = useAuth();
  const roleScopes = useMemo(
    () => new Set<string>(activeMembership?.roles?.map(role => role.scope) ?? user?.roleScopes ?? []),
    [activeMembership, user]
  );
  const isReviewer = isSuperAdmin || roleScopes.has('evaluator') || roleScopes.has('organizer') || roleScopes.has('tenant_admin');

  const [rubricDialogOpen, setRubricDialogOpen] = useState(false);
  const [aiEvaluationText, setAiEvaluationText] = useState<string>('');
  const [aiEvaluationScore, setAiEvaluationScore] = useState<number | null>(null);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<number>>(new Set());
  const [evaluationLocale, setEvaluationLocale] = useState<string>(() => {
    // Mapear idiomas de i18n a formatos esperados por el backend
    const langMap: Record<string, string> = {
      'es': 'es-ES',
      'ca': 'ca-ES',
      'en': 'en-US'
    };
    return langMap[i18n.language] || 'es-ES';
  });

  // Verificar permisos
  useEffect(() => {
    if (!isReviewer) {
      toast.error(safeTranslate(t, 'common.unauthorized', { defaultValue: 'No tienes permisos para acceder a esta página' }));
      navigate(tenantPath('dashboard'));
    }
  }, [isReviewer, navigate, tenantPath, t]);

  const { data: eventDetail, isLoading: eventLoading } = useQuery({
    queryKey: ['event', numericEventId],
    queryFn: () => getEventDetail(numericEventId),
    enabled: Number.isInteger(numericEventId)
  });

  const phase = eventDetail?.phases?.find(p => p.id === numericPhaseId);
  const phaseTasks = useMemo(() => {
    if (!eventDetail?.tasks) return [];
    return eventDetail.tasks
      .filter(t => t.phase_id === numericPhaseId)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }, [eventDetail, numericPhaseId]);

  // Cargar todas las entregas de las tareas de la fase para este equipo
  const { data: allSubmissions, isLoading: submissionsLoading } = useQuery<Submission[]>({
    queryKey: ['phase-submissions', numericPhaseId, numericTeamId],
    queryFn: async () => {
      const submissions: Submission[] = [];
      for (const task of phaseTasks) {
        try {
          const taskSubmissions = await getSubmissions(task.id);
          const teamSubmissions = taskSubmissions.filter(s => s.team_id === numericTeamId);
          submissions.push(...teamSubmissions);
        } catch (error) {
          // Ignorar errores de tareas sin entregas
        }
      }
      return submissions;
    },
    enabled: phaseTasks.length > 0
  });

  // Cargar evaluación existente de fase
  const { data: existingEvaluation, isLoading: evaluationLoading } = useQuery<PhaseEvaluation | null>({
    queryKey: ['phase-evaluation', numericPhaseId, numericTeamId],
    queryFn: async () => {
      try {
        const evaluations = await getPhaseEvaluations(numericPhaseId, numericTeamId);
        // Retornar la evaluación final o la más reciente
        return evaluations.find(e => e.status === 'final') || evaluations[0] || null;
      } catch (error) {
        return null;
      }
    },
    enabled: Number.isInteger(numericPhaseId) && Number.isInteger(numericTeamId),
    retry: false
  });

  // Obtener rúbrica de fase
  const { data: rubrics, isLoading: rubricsLoading } = useQuery<PhaseRubric[]>({
    queryKey: ['rubrics', numericEventId, numericPhaseId],
    queryFn: () => getRubrics(numericEventId, numericPhaseId),
    enabled: Number.isInteger(numericEventId) && Number.isInteger(numericPhaseId)
  });

  const rubric = useMemo(() => {
    if (!rubrics) return null;
    return rubrics.find(r => r.phase_id === numericPhaseId && r.rubric_scope === 'phase') || null;
  }, [rubrics, numericPhaseId]);

  // Preparar entregas agrupadas por tarea y ordenadas
  const submissionsByTask = useMemo(() => {
    if (!allSubmissions || !phaseTasks) return new Map<number, Submission[]>();

    const map = new Map<number, Submission[]>();
    for (const task of phaseTasks) {
      const taskSubmissions = allSubmissions
        .filter(s => s.task_id === task.id)
        .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      map.set(task.id, taskSubmissions);
    }
    return map;
  }, [allSubmissions, phaseTasks]);

  // Inicializar selección por defecto: todas las entregas finales y última entrega de cada tarea
  useEffect(() => {
    if (allSubmissions && phaseTasks && selectedSubmissionIds.size === 0) {
      const defaultSelected = new Set<number>();
      
      for (const task of phaseTasks) {
        const taskSubmissions = submissionsByTask.get(task.id) || [];
        if (taskSubmissions.length === 0) continue;

        // Agregar todas las entregas finales
        taskSubmissions.forEach(s => {
          if (s.status === 'final' || s.type === 'final') {
            defaultSelected.add(s.id);
          }
        });

        // Si no hay entregas finales, agregar la última entrega
        if (defaultSelected.size === 0 || !taskSubmissions.some(s => defaultSelected.has(s.id))) {
          const lastSubmission = taskSubmissions[0];
          if (lastSubmission) {
            defaultSelected.add(lastSubmission.id);
          }
        }
      }

      setSelectedSubmissionIds(defaultSelected);
    }
  }, [allSubmissions, phaseTasks, submissionsByTask, selectedSubmissionIds.size]);

  // Si hay evaluación existente, marcar las entregas evaluadas
  useEffect(() => {
    if (existingEvaluation?.evaluated_submission_ids) {
      const evaluatedIds = new Set(existingEvaluation.evaluated_submission_ids);
      setSelectedSubmissionIds(evaluatedIds);
    }
  }, [existingEvaluation]);

  const form = useForm<EvaluationFormValues>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: {
      comment: existingEvaluation?.comment || '',
      score: existingEvaluation?.score ? Number(existingEvaluation.score) : undefined
    }
  });

  // Cargar evaluación existente cuando esté disponible
  useEffect(() => {
    if (existingEvaluation) {
      // Si la evaluación es generada con IA, solo mostrarla en aiEvaluationText
      // NO copiar al form automáticamente, el usuario debe usar el botón "Copiar"
      if (existingEvaluation.source === 'ai_assisted') {
        setAiEvaluationText(existingEvaluation.comment || '');
        // Guardar el score de la IA para poder copiarlo después, pero NO copiarlo al form
        setAiEvaluationScore(existingEvaluation.score ? Number(existingEvaluation.score) : null);
        // El form NO debe tener ni el comentario ni el score automáticamente
        form.reset({
          comment: '', // No copiar el comentario automáticamente
          score: undefined // No copiar el score automáticamente
        });
      } else {
        // Para evaluaciones manuales, cargar normalmente en el form
        form.reset({
          comment: existingEvaluation.comment || '',
          score: existingEvaluation.score ? Number(existingEvaluation.score) : undefined
        });
        setAiEvaluationText('');
        setAiEvaluationScore(null);
      }
    } else {
      form.reset({ comment: '', score: undefined });
      setAiEvaluationText('');
      setAiEvaluationScore(null);
    }
  }, [existingEvaluation, form]);

  const toggleSubmissionSelection = (submissionId: number) => {
    const newSelected = new Set(selectedSubmissionIds);
    if (newSelected.has(submissionId)) {
      newSelected.delete(submissionId);
    } else {
      newSelected.add(submissionId);
    }
    setSelectedSubmissionIds(newSelected);
  };

  const aiEvaluationMutation = useMutation({
    mutationFn: () => {
      toast.info(safeTranslate(t, 'evaluations.generatingAi', { defaultValue: 'Generando evaluación con IA...' }), {
        duration: 3000
      });
      return createPhaseAiEvaluation(numericPhaseId, numericTeamId, {
        submission_ids: Array.from(selectedSubmissionIds),
        locale: evaluationLocale,
        status: 'draft'
      });
    },
    onSuccess: (data) => {
      toast.success(safeTranslate(t, 'evaluations.aiCreated', { defaultValue: 'Evaluación con IA generada' }));
      // Solo establecer en aiEvaluationText y guardar el score, NO copiar al form
      setAiEvaluationText(data.comment || '');
      // Guardar el score de la IA para poder copiarlo después, pero NO copiarlo al form
      setAiEvaluationScore(data.score ? Number(data.score) : null);
      // Limpiar tanto el comentario como el score del form
      form.setValue('comment', '');
      form.setValue('score', undefined);
      // Limpiar badges y reasignar según las entregas evaluadas
      if (data.evaluated_submission_ids) {
        setSelectedSubmissionIds(new Set(data.evaluated_submission_ids));
      }
      void queryClient.invalidateQueries({ queryKey: ['phase-evaluation', numericPhaseId, numericTeamId] });
    },
    onError: (error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { status?: number } }).response === 'object'
      ) {
        const response = (error as { response: { status?: number } }).response;
        if (response.status === 409) {
          toast.error(safeTranslate(t, 'evaluations.missingRubric', { defaultValue: 'No hay una rúbrica configurada para esta fase' }));
          return;
        }
        if (response.status === 500) {
          toast.error(safeTranslate(t, 'evaluations.aiServiceUnavailable', { defaultValue: 'Servicio de IA no disponible' }));
          return;
        }
      }
      toast.error(safeTranslate(t, 'common.error'));
    }
  });

  const saveDraftMutation = useMutation({
    mutationFn: async (values: EvaluationFormValues) => {
      const payload: {
        submission_ids: number[];
        comment: string;
        status: 'draft';
        score?: number;
      } = {
        submission_ids: Array.from(selectedSubmissionIds),
        comment: values.comment,
        status: 'draft' as const
      };
      
      if (values.score !== undefined && !Number.isNaN(values.score)) {
        payload.score = values.score;
      }

      if (existingEvaluation) {
        return updatePhaseEvaluation(numericPhaseId, numericTeamId, existingEvaluation.id, payload);
      } else {
        return createPhaseEvaluation(numericPhaseId, numericTeamId, payload);
      }
    },
    onSuccess: () => {
      toast.success(safeTranslate(t, 'evaluations.draftSaved', { defaultValue: 'Borrador guardado' }));
      void queryClient.invalidateQueries({ queryKey: ['phase-evaluation', numericPhaseId, numericTeamId] });
    },
    onError: (error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response: { data?: { message?: string } } }).response === 'object'
      ) {
        const response = (error as { response: { data?: { message?: string } } }).response;
        const message = response.data?.message || safeTranslate(t, 'common.error');
        toast.error(message);
      } else {
        toast.error(safeTranslate(t, 'common.error'));
      }
    }
  });

  const saveFinalMutation = useMutation({
    mutationFn: async (values: EvaluationFormValues) => {
      const payload: {
        submission_ids: number[];
        comment: string;
        status: 'final';
        score?: number;
      } = {
        submission_ids: Array.from(selectedSubmissionIds),
        comment: values.comment,
        status: 'final' as const
      };
      
      if (values.score !== undefined && !Number.isNaN(values.score)) {
        payload.score = values.score;
      }

      if (existingEvaluation) {
        return updatePhaseEvaluation(numericPhaseId, numericTeamId, existingEvaluation.id, payload);
      } else {
        return createPhaseEvaluation(numericPhaseId, numericTeamId, payload);
      }
    },
    onSuccess: () => {
      toast.success(safeTranslate(t, 'evaluations.finalSaved', { defaultValue: 'Evaluación final guardada y enviada' }));
      void queryClient.invalidateQueries({ queryKey: ['phase-evaluation', numericPhaseId, numericTeamId] });
      void queryClient.invalidateQueries({ queryKey: ['events', numericEventId, 'deliverables-tracking'] });
      navigate(tenantPath(`dashboard/tracking/deliverables?eventId=${eventId}`));
    },
    onError: (error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response: { data?: { message?: string } } }).response === 'object'
      ) {
        const response = (error as { response: { data?: { message?: string } } }).response;
        const message = response.data?.message || safeTranslate(t, 'common.error');
        toast.error(message);
      } else {
        toast.error(safeTranslate(t, 'common.error'));
      }
    }
  });


  const copyAiToFinal = () => {
    form.setValue('comment', aiEvaluationText);
    // También copiar el score si está disponible
    if (aiEvaluationScore !== null) {
      form.setValue('score', aiEvaluationScore);
    }
    toast.success(safeTranslate(t, 'evaluations.copied', { defaultValue: 'Texto y puntuación copiados al campo de evaluación final' }));
  };

  // Obtener nombre del equipo desde las submissions (debe estar antes de los returns condicionales)
  const teamName = useMemo(() => {
    if (allSubmissions && allSubmissions.length > 0) {
      return allSubmissions[0].team?.name || '';
    }
    return '';
  }, [allSubmissions]);

  if (eventLoading || submissionsLoading || evaluationLoading || rubricsLoading) {
    return <Spinner fullHeight />;
  }

  if (!phase) {
    return (
      <DashboardLayout title={safeTranslate(t, 'evaluations.pageTitle', { defaultValue: 'Evaluación de Fase' })}>
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {safeTranslate(t, 'evaluations.phaseNotFound', { defaultValue: 'Fase no encontrada' })}
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const phaseName = getMultilingualText(phase.name, currentLang);

  return (
    <DashboardLayout
      title={safeTranslate(t, 'evaluations.phaseEvaluationTitle', { defaultValue: 'Evaluación de Fase' })}
      subtitle={`${phaseName} - ${teamName}`}
    >
      <div className="space-y-6">
        {/* Lista de entregas por tarea */}
        <Card>
          <CardHeader>
            <CardTitle>{safeTranslate(t, 'evaluations.selectSubmissions', { defaultValue: 'Seleccionar entregas para evaluar' })}</CardTitle>
            <CardDescription>
              {safeTranslate(t, 'evaluations.selectSubmissionsDescription', { defaultValue: 'Selecciona las entregas que deseas incluir en la evaluación. Por defecto se seleccionan todas las entregas finales y la última entrega de cada tarea.' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {phaseTasks.map(task => {
              const taskSubmissions = submissionsByTask.get(task.id) || [];
              const taskTitle = getMultilingualText(task.title, currentLang);
              if (taskSubmissions.length === 0) {
                return (
                  <div key={task.id} className="border rounded-md p-4">
                    <h3 className="font-semibold text-sm mb-2">{taskTitle}</h3>
                    <p className="text-sm text-muted-foreground">
                      {safeTranslate(t, 'evaluations.noSubmissionsForTask', { defaultValue: 'No hay entregas para esta tarea' })}
                    </p>
                  </div>
                );
              }

              return (
                <div key={task.id} className="border rounded-md p-4 space-y-3">
                  <h3 className="font-semibold text-sm">{taskTitle}</h3>
                  <div className="space-y-2">
                    {taskSubmissions.map(submission => {
                      const isSelected = selectedSubmissionIds.has(submission.id);
                      const wasEvaluated = existingEvaluation?.evaluated_submission_ids?.includes(submission.id);

                      return (
                        <div
                          key={submission.id}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors',
                            isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                          )}
                          onClick={() => toggleSubmissionSelection(submission.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSubmissionSelection(submission.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {new Date(submission.submitted_at).toLocaleString(locale)}
                              </span>
                              <Badge variant={submission.status === 'final' ? 'default' : 'secondary'}>
                                {submission.status === 'final' ? safeTranslate(t, 'submissions.final', { defaultValue: 'Final' }) : safeTranslate(t, 'submissions.draft', { defaultValue: 'Borrador' })}
                              </Badge>
                              {wasEvaluated && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {safeTranslate(t, 'evaluations.evaluated', { defaultValue: 'Evaluada' })}
                                </Badge>
                              )}
                            </div>
                            {submission.content && (
                              <p className="text-sm text-muted-foreground">{submission.content}</p>
                            )}
                            {submission.files && submission.files.length > 0 && (
                              <ul className="space-y-1 text-xs">
                                {submission.files.map(file => {
                                  const { icon: FileTypeIcon, color } = getFileIcon(file.mime_type, file.original_name);
                                  return (
                                    <li key={file.id} className="flex items-center gap-2">
                                      <span title={file.mime_type}>
                                        <FileTypeIcon className="h-4 w-4" style={{ color }} />
                                      </span>
                                      <a className="text-primary underline" href={file.url} target="_blank" rel="noreferrer">
                                        {file.original_name}
                                      </a>
                                      <span className="text-muted-foreground">
                                        · {(file.size_bytes / 1024 / 1024).toFixed(2)} MB
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Rúbrica y Evaluación con IA */}
        <Card>
          <CardHeader>
            <CardTitle>{safeTranslate(t, 'evaluations.evaluationTools', { defaultValue: 'Herramientas de Evaluación' })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rubric ? (
              <>
                <div className="flex flex-wrap gap-3">
                  <Dialog open={rubricDialogOpen} onOpenChange={setRubricDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <ClipboardList className="h-4 w-4 mr-2" />
                        {safeTranslate(t, 'evaluations.viewRubric', { defaultValue: 'Consultar rúbrica' })}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{getMultilingualText(rubric.name, currentLang)}</DialogTitle>
                        {rubric.description && (
                          <DialogDescription>{getMultilingualText(rubric.description, currentLang)}</DialogDescription>
                        )}
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div className="text-sm">
                          <span className="font-semibold">{safeTranslate(t, 'evaluations.scale', { defaultValue: 'Escala' })}: </span>
                          {rubric.scale_min} - {rubric.scale_max}
                        </div>
                        {rubric.criteria && rubric.criteria.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm">{safeTranslate(t, 'evaluations.criteria', { defaultValue: 'Criterios' })}</h4>
                            {rubric.criteria.map((criterion, index) => (
                              <div key={criterion.id || index} className="border rounded-md p-3">
                                <div className="font-medium text-sm">{getMultilingualText(criterion.title, currentLang)}</div>
                                {criterion.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{getMultilingualText(criterion.description, currentLang)}</p>
                                )}
                                <div className="text-xs text-muted-foreground mt-1">
                                  {safeTranslate(t, 'evaluations.weight', { defaultValue: 'Peso' })}: {criterion.weight || 1}
                                  {criterion.max_score !== null && criterion.max_score !== undefined && (
                                    <> · {safeTranslate(t, 'evaluations.maxScore', { defaultValue: 'Puntuación máxima' })}: {criterion.max_score}</>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium whitespace-nowrap">
                      {safeTranslate(t, 'evaluations.evaluationLanguage', { defaultValue: 'Idioma de evaluación' })}:
                    </label>
                    <Select
                      value={evaluationLocale}
                      onValueChange={setEvaluationLocale}
                      className="w-[180px]"
                    >
                      <option value="es-ES">{safeTranslate(t, 'common.languages.es', { defaultValue: 'Español' })}</option>
                      <option value="ca-ES">{safeTranslate(t, 'common.languages.ca', { defaultValue: 'Catalán' })}</option>
                      <option value="en-US">{safeTranslate(t, 'common.languages.en', { defaultValue: 'Inglés' })}</option>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedSubmissionIds.size === 0) {
                        toast.error(safeTranslate(t, 'evaluations.selectAtLeastOneSubmission', { defaultValue: 'Debes seleccionar al menos una entrega' }));
                        return;
                      }
                      aiEvaluationMutation.mutate();
                    }}
                    disabled={aiEvaluationMutation.isPending || selectedSubmissionIds.size === 0}
                  >
                    {aiEvaluationMutation.isPending ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        {safeTranslate(t, 'evaluations.generatingAi', { defaultValue: 'Generando...' })}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        {safeTranslate(t, 'evaluations.generateAiEvaluation', { defaultValue: 'Evaluación con IA' })}
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {safeTranslate(t, 'evaluations.noRubric', { defaultValue: 'No hay rúbrica configurada para esta fase' })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Evaluación con IA (solo lectura) */}
        {aiEvaluationText && (
          <Card>
            <CardHeader>
              <CardTitle>{safeTranslate(t, 'evaluations.aiEvaluation', { defaultValue: 'Evaluación generada con IA' })}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={aiEvaluationText}
                readOnly
                rows={10}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={copyAiToFinal}
              >
                <Copy className="h-4 w-4 mr-2" />
                {safeTranslate(t, 'evaluations.copyFromAi', { defaultValue: 'Copiar a evaluación final' })}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Evaluación Final */}
        <Card>
          <CardHeader>
            <CardTitle>{safeTranslate(t, 'evaluations.finalEvaluation', { defaultValue: 'Evaluación Final' })}</CardTitle>
            <CardDescription>
              {safeTranslate(t, 'evaluations.finalEvaluationDescription', { defaultValue: 'Esta evaluación será visible para los miembros del equipo cuando la guardes como final' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(() => {})} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {safeTranslate(t, 'evaluations.comment', { defaultValue: 'Comentario' })} *
                </label>
                <Textarea
                  {...form.register('comment')}
                  rows={10}
                  placeholder={safeTranslate(t, 'evaluations.commentPlaceholder', { defaultValue: 'Escribe tu evaluación aquí...' })}
                />
                {form.formState.errors.comment && (
                  <p className="text-xs text-destructive">{form.formState.errors.comment.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium block mb-2">
                  {safeTranslate(t, 'evaluations.score', { defaultValue: 'Puntuación' })}
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  {...form.register('score', { 
                    valueAsNumber: true,
                    min: { value: 0, message: safeTranslate(t, 'evaluations.scoreMin', { defaultValue: 'La puntuación mínima es 0' }) },
                    max: { value: 100, message: safeTranslate(t, 'evaluations.scoreMax', { defaultValue: 'La puntuación máxima es 100' }) }
                  })}
                  className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {form.formState.errors.score && (
                  <p className="text-xs text-destructive">{form.formState.errors.score.message}</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={form.handleSubmit((values) => saveDraftMutation.mutate(values))}
                  disabled={saveDraftMutation.isPending || saveFinalMutation.isPending || selectedSubmissionIds.size === 0}
                >
                  {saveDraftMutation.isPending ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'evaluations.saveDraft', { defaultValue: 'Guardar borrador' })}
                </Button>
                <Button
                  type="button"
                  onClick={form.handleSubmit((values) => saveFinalMutation.mutate(values))}
                  disabled={saveDraftMutation.isPending || saveFinalMutation.isPending || selectedSubmissionIds.size === 0}
                >
                  {saveFinalMutation.isPending ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'evaluations.saveAndSendFinal', { defaultValue: 'Guardar y enviar evaluación final' })}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default PhaseEvaluationPage;

