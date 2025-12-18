import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Copy, ClipboardList, CheckCircle2 } from 'lucide-react';

import { DashboardLayout } from '@/components/layout';
import { Spinner } from '@/components/common';
import { getFileIcon } from '@/utils/files';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { getSubmissions, getProjectEvaluations, createProjectEvaluation, updateProjectEvaluation, getPhaseEvaluations, type Submission, type ProjectEvaluation, type PhaseEvaluation } from '@/services/submissions';
import { getEventDetail, getProjectRubrics, type PhaseRubric, type Phase } from '@/services/events';
import { getTeamsByEvent } from '@/services/teams';
import { cn } from '@/utils/cn';

const evaluationSchema = z.object({
  comment: z.string().min(1, 'El comentario es requerido'),
  score: z.union([
    z.number().min(0, 'La puntuación mínima es 0').max(10, 'La puntuación máxima es 10'),
    z.nan()
  ]).optional()
});

type EvaluationFormValues = z.infer<typeof evaluationSchema>;

function ProjectEvaluationPage() {
  const { eventId, teamId } = useParams();
  const numericEventId = Number(eventId);
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
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<number>>(new Set());

  // Verificar permisos
  useEffect(() => {
    if (!isReviewer) {
      toast.error(safeTranslate(t, 'common.unauthorized', { defaultValue: 'No tienes permisos para acceder a esta página' }));
      navigate(tenantPath('dashboard'));
    }
  }, [isReviewer, navigate, tenantPath, t]);

  // Obtener equipo y proyecto
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', numericEventId],
    queryFn: () => getTeamsByEvent(numericEventId),
    enabled: Number.isInteger(numericEventId)
  });

  const team = teams?.find(t => t.id === numericTeamId);
  const projectId = team?.project?.id;

  const { data: eventDetail, isLoading: eventLoading } = useQuery({
    queryKey: ['event', numericEventId],
    queryFn: () => getEventDetail(numericEventId),
    enabled: Number.isInteger(numericEventId)
  });

  // Cargar todas las entregas del proyecto (de todas las fases)
  const { data: allSubmissions, isLoading: submissionsLoading } = useQuery<Submission[]>({
    queryKey: ['project-submissions', numericEventId, numericTeamId],
    queryFn: async () => {
      if (!eventDetail?.tasks) return [];
      const submissions: Submission[] = [];
      for (const task of eventDetail.tasks) {
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
    enabled: !!eventDetail && eventDetail.tasks && eventDetail.tasks.length > 0
  });

  // Cargar evaluación existente de proyecto
  const { data: existingEvaluation, isLoading: evaluationLoading } = useQuery<ProjectEvaluation | null>({
    queryKey: ['project-evaluation', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      try {
        const evaluations = await getProjectEvaluations(projectId);
        // Retornar la evaluación final o la más reciente
        return evaluations.find(e => e.status === 'final') || evaluations[0] || null;
      } catch (error) {
        return null;
      }
    },
    enabled: projectId !== null && projectId !== undefined && Number.isFinite(projectId),
    retry: false
  });

  // Obtener rúbrica de proyecto
  const { data: rubrics, isLoading: rubricsLoading } = useQuery<PhaseRubric[]>({
    queryKey: ['project-rubrics', numericEventId],
    queryFn: () => getProjectRubrics(numericEventId),
    enabled: Number.isInteger(numericEventId)
  });

  const rubric = useMemo(() => {
    if (!rubrics) return null;
    return rubrics.find(r => r.rubric_scope === 'project') || null;
  }, [rubrics]);

  // Cargar evaluaciones de fase para todas las fases
  const { data: phaseEvaluationsMap, isLoading: phaseEvaluationsLoading } = useQuery<Map<number, PhaseEvaluation | null>>({
    queryKey: ['phase-evaluations-for-project', numericEventId, numericTeamId],
    queryFn: async () => {
      if (!eventDetail?.phases || !numericTeamId) return new Map();
      const map = new Map<number, PhaseEvaluation | null>();
      for (const phase of eventDetail.phases) {
        try {
          const evaluations = await getPhaseEvaluations(phase.id, numericTeamId);
          // Obtener la evaluación final o la más reciente
          const finalEvaluation = evaluations.find(e => e.status === 'final') || evaluations[0] || null;
          map.set(phase.id, finalEvaluation);
        } catch (error) {
          map.set(phase.id, null);
        }
      }
      return map;
    },
    enabled: !!eventDetail && !!eventDetail.phases && eventDetail.phases.length > 0 && Number.isInteger(numericTeamId),
    retry: false
  });

  // Preparar entregas agrupadas por fase y tarea
  const submissionsByPhase = useMemo(() => {
    if (!allSubmissions || !eventDetail?.tasks || !eventDetail?.phases) return new Map<number, Map<number, Submission[]>>();

    const phaseMap = new Map<number, Map<number, Submission[]>>();
    
    // Inicializar mapas por fase
    for (const phase of eventDetail.phases) {
      phaseMap.set(phase.id, new Map<number, Submission[]>());
    }

    // Agrupar entregas por fase y tarea
    for (const task of eventDetail.tasks) {
      const phaseId = task.phase_id;
      const phaseTasksMap = phaseMap.get(phaseId);
      if (!phaseTasksMap) continue;

      const taskSubmissions = allSubmissions
        .filter(s => s.task_id === task.id)
        .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      phaseTasksMap.set(task.id, taskSubmissions);
    }

    return phaseMap;
  }, [allSubmissions, eventDetail]);

  // Preparar entregas agrupadas por tarea (para compatibilidad con código existente)
  const submissionsByTask = useMemo(() => {
    if (!allSubmissions || !eventDetail?.tasks) return new Map<number, Submission[]>();

    const map = new Map<number, Submission[]>();
    for (const task of eventDetail.tasks) {
      const taskSubmissions = allSubmissions
        .filter(s => s.task_id === task.id)
        .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      map.set(task.id, taskSubmissions);
    }
    return map;
  }, [allSubmissions, eventDetail]);

  // Inicializar selección por defecto: todas las entregas finales y última entrega de cada tarea
  useEffect(() => {
    if (allSubmissions && eventDetail?.tasks && selectedSubmissionIds.size === 0) {
      const defaultSelected = new Set<number>();
      
      for (const task of eventDetail.tasks) {
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
  }, [allSubmissions, eventDetail, submissionsByTask, selectedSubmissionIds.size]);

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
      form.reset({
        comment: existingEvaluation.comment || '',
        score: existingEvaluation.score ? Number(existingEvaluation.score) : undefined
      });
    } else {
      form.reset({ comment: '', score: undefined });
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

  const saveDraftMutation = useMutation({
    mutationFn: async (values: EvaluationFormValues) => {
      if (!projectId) throw new Error('Project ID is required');
      const payload: {
        submission_ids?: number[];
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
        return updateProjectEvaluation(projectId, existingEvaluation.id, payload);
      } else {
        return createProjectEvaluation(projectId, payload);
      }
    },
    onSuccess: () => {
      toast.success(safeTranslate(t, 'evaluations.draftSaved', { defaultValue: 'Borrador guardado' }));
      void queryClient.invalidateQueries({ queryKey: ['project-evaluation', projectId] });
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
      if (!projectId) throw new Error('Project ID is required');
      const payload: {
        submission_ids?: number[];
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
        return updateProjectEvaluation(projectId, existingEvaluation.id, payload);
      } else {
        return createProjectEvaluation(projectId, payload);
      }
    },
    onSuccess: () => {
      toast.success(safeTranslate(t, 'evaluations.finalSaved', { defaultValue: 'Evaluación final guardada y enviada' }));
      void queryClient.invalidateQueries({ queryKey: ['project-evaluation', projectId] });
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

  // Obtener nombre del equipo y proyecto
  const teamName = useMemo(() => {
    return team?.name || '';
  }, [team]);

  const projectName = useMemo(() => {
    return team?.project?.name || '';
  }, [team]);

  if (eventLoading || submissionsLoading || evaluationLoading || rubricsLoading || teamsLoading || phaseEvaluationsLoading) {
    return <Spinner fullHeight />;
  }

  if (!projectId) {
    return (
      <DashboardLayout title={safeTranslate(t, 'evaluations.pageTitle', { defaultValue: 'Evaluación de Proyecto' })}>
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {safeTranslate(t, 'evaluations.projectNotFound', { defaultValue: 'Proyecto no encontrado' })}
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={safeTranslate(t, 'evaluations.projectEvaluationTitle', { defaultValue: 'Evaluación de Proyecto' })}
      subtitle={`${projectName} - ${teamName}`}
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
            {eventDetail?.phases && eventDetail.phases.length > 0 ? (
              eventDetail.phases
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                .map(phase => {
                  const phaseTasksMap = submissionsByPhase.get(phase.id);
                  const phaseEvaluation = phaseEvaluationsMap?.get(phase.id);
                  const phaseName = getMultilingualText(phase.name, currentLang);
                  
                  // Obtener todas las tareas de esta fase
                  const phaseTasks = eventDetail.tasks
                    ?.filter(t => t.phase_id === phase.id)
                    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)) || [];

                  // Verificar si hay entregas en esta fase
                  const hasSubmissions = phaseTasks.some(task => {
                    const taskSubmissions = phaseTasksMap?.get(task.id) || [];
                    return taskSubmissions.length > 0;
                  });

                  if (!hasSubmissions && !phaseEvaluation) {
                    return null; // No mostrar fases sin entregas ni evaluaciones
                  }

                  return (
                    <div key={phase.id} className="space-y-4">
                      {/* Encabezado de fase */}
                      <div className="border-b pb-2">
                        <h2 className="text-lg font-semibold">{phaseName}</h2>
                      </div>

                      {/* Entregas de la fase */}
                      {phaseTasks.length > 0 && (
                        <div className="space-y-4">
                          {phaseTasks.map(task => {
                            const taskSubmissions = phaseTasksMap?.get(task.id) || [];
                            const taskTitle = getMultilingualText(task.title, currentLang);
                            
                            if (taskSubmissions.length === 0) {
                              return null;
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
                        </div>
                      )}

                      {/* Evaluación final de la fase */}
                      {phaseEvaluation && phaseEvaluation.status === 'final' && (
                        <div className="border rounded-md p-4 bg-muted/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm">
                              {safeTranslate(t, 'evaluations.finalPhaseEvaluation', { defaultValue: 'Evaluación Final de la Fase' })}
                            </h3>
                            {phaseEvaluation.score !== null && phaseEvaluation.score !== undefined && (
                              <Badge variant="default" className="text-sm">
                                {Number(phaseEvaluation.score).toFixed(1)}/100
                              </Badge>
                            )}
                          </div>
                          {phaseEvaluation.comment && (
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {phaseEvaluation.comment}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {safeTranslate(t, 'evaluations.evaluatedAt', { defaultValue: 'Evaluado el' })} {new Date(phaseEvaluation.created_at).toLocaleString(locale)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
                .filter(Boolean)
            ) : (
              <p className="text-sm text-muted-foreground">
                {safeTranslate(t, 'evaluations.noTasks', { defaultValue: 'No hay tareas en este evento' })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Rúbrica */}
        <Card>
          <CardHeader>
            <CardTitle>{safeTranslate(t, 'evaluations.evaluationTools', { defaultValue: 'Herramientas de Evaluación' })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rubric ? (
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
            ) : (
              <p className="text-sm text-muted-foreground">
                {safeTranslate(t, 'evaluations.noRubric', { defaultValue: 'No hay rúbrica configurada para este proyecto' })}
              </p>
            )}
          </CardContent>
        </Card>

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
                  {safeTranslate(t, 'evaluations.score', { defaultValue: 'Puntuación' })} (0-10)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  {...form.register('score', { 
                    valueAsNumber: true,
                    min: { value: 0, message: safeTranslate(t, 'evaluations.scoreMin', { defaultValue: 'La puntuación mínima es 0' }) },
                    max: { value: 10, message: safeTranslate(t, 'evaluations.scoreMax10', { defaultValue: 'La puntuación máxima es 10' }) }
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

export default ProjectEvaluationPage;

