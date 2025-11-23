import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Copy, ClipboardList, Sparkles } from 'lucide-react';

import { DashboardLayout } from '@/components/layout';
import { Spinner } from '@/components/common';
import { getFileIcon } from '@/utils/files';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { getSubmissions, getSubmission, getFinalEvaluation, getEvaluations, createEvaluation, updateEvaluation, createAiEvaluation, type Evaluation } from '@/services/submissions';
import { getEventDetail, getRubrics, type PhaseRubric } from '@/services/events';
import { cn } from '@/utils/cn';

const evaluationSchema = z.object({
  comment: z.string().min(1, 'El comentario es requerido'),
  score: z.union([
    z.number().min(0, 'La puntuación mínima es 0').max(10, 'La puntuación máxima es 10'),
    z.nan()
  ]).optional()
});

type EvaluationFormValues = z.infer<typeof evaluationSchema>;

function EvaluationPage() {
  const { eventId, taskId, submissionId } = useParams();
  const numericEventId = Number(eventId);
  const numericTaskId = Number(taskId);
  const numericSubmissionId = Number(submissionId);
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

  // Cargar la submission específica
  const { data: currentSubmission, isLoading: submissionLoading } = useQuery({
    queryKey: ['submission', numericSubmissionId],
    queryFn: () => getSubmission(numericSubmissionId),
    enabled: Number.isInteger(numericSubmissionId)
  });

  // Cargar todas las submissions de la tarea para mostrar las del mismo equipo
  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ['submissions', numericTaskId],
    queryFn: () => getSubmissions(numericTaskId),
    enabled: Number.isInteger(numericTaskId)
  });

  // Cargar evaluación existente (final o borrador más reciente)
  const { data: existingEvaluation, isLoading: evaluationLoading } = useQuery<Evaluation | null>({
    queryKey: ['evaluation', numericSubmissionId],
    queryFn: async () => {
      try {
        // Intentar obtener evaluación final primero
        return await getFinalEvaluation(numericSubmissionId);
      } catch (error) {
        // Si es 404, no hay evaluación final, buscar borrador o la más reciente
        if (
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          typeof (error as { response?: { status?: number } }).response === 'object'
        ) {
          const response = (error as { response: { status?: number } }).response;
          if (response.status === 404) {
            // No hay evaluación final, obtener todas y buscar borrador o la más reciente
            const evals = await getEvaluations(numericSubmissionId);
            if (evals.length > 0) {
              // Retornar la más reciente (puede ser borrador)
              return evals[0];
            }
            return null;
          }
        }
        // Para otros errores, también intentar obtener todas las evaluaciones
        try {
          const evals = await getEvaluations(numericSubmissionId);
          if (evals.length > 0) {
            return evals[0];
          }
        } catch {
          // Ignorar errores secundarios
        }
        return null;
      }
    },
    enabled: Number.isInteger(numericSubmissionId),
    retry: false
  });

  const teamSubmissions = useMemo(() => {
    if (!submissions || !currentSubmission) return [];
    return submissions.filter(s => s.team_id === currentSubmission.team_id && s.task_id === numericTaskId);
  }, [submissions, currentSubmission, numericTaskId]);

  const task = eventDetail?.tasks?.find(t => t.id === numericTaskId);
  const phase = eventDetail?.phases?.find(p => p.id === task?.phase_id);

  // Obtener rúbrica
  const { data: rubrics, isLoading: rubricsLoading } = useQuery<PhaseRubric[]>({
    queryKey: ['rubrics', numericEventId, phase?.id],
    queryFn: () => getRubrics(numericEventId, phase!.id),
    enabled: Number.isInteger(numericEventId) && !!phase?.id
  });

  const rubric = useMemo(() => {
    if (!rubrics || !task) return null;
    // Buscar rúbrica específica de la tarea primero
    if (task.phase_rubric_id) {
      const taskRubric = rubrics.find(r => r.id === task.phase_rubric_id);
      if (taskRubric) return taskRubric;
    }
    // Si no, buscar rúbrica de la fase
    return rubrics.find(r => r.phase_id === phase?.id) || rubrics[0] || null;
  }, [rubrics, task, phase]);

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
      // Si es evaluación con IA, mostrar el texto en el cuadro de IA
      if (existingEvaluation.source === 'ai_assisted' && existingEvaluation.comment) {
        setAiEvaluationText(existingEvaluation.comment);
        // No copiar automáticamente al campo final, el usuario lo hará con el botón de copiar
      }
    } else {
      // Resetear si no hay evaluación
      form.reset({ comment: '', score: undefined });
      setAiEvaluationText('');
    }
  }, [existingEvaluation, form]);

  const aiEvaluationMutation = useMutation({
    mutationFn: () => {
      toast.info(safeTranslate(t, 'evaluations.generatingAi', { defaultValue: 'Generando evaluación con IA...' }), {
        duration: 3000
      });
      return createAiEvaluation(numericSubmissionId, { locale: evaluationLocale, status: 'draft' });
    },
    onSuccess: (data) => {
      toast.success(safeTranslate(t, 'evaluations.aiCreated', { defaultValue: 'Evaluación con IA generada' }));
      setAiEvaluationText(data.comment || '');
      // No copiar automáticamente el comentario al campo final, el usuario lo hará con el botón de copiar
      if (data.score) {
        form.setValue('score', Number(data.score));
      }
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
          toast.error(safeTranslate(t, 'evaluations.missingRubric', { defaultValue: 'No hay una rúbrica configurada para esta tarea' }));
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
      const payload: { comment: string; score?: number | null; status: 'draft' } = {
        comment: values.comment,
        status: 'draft'
      };
      
      if (values.score !== undefined && !Number.isNaN(values.score)) {
        payload.score = values.score;
      } else {
        payload.score = null;
      }

      if (existingEvaluation) {
        return updateEvaluation(numericSubmissionId, existingEvaluation.id, payload);
      } else {
        return createEvaluation(numericSubmissionId, payload);
      }
    },
    onSuccess: () => {
      toast.success(safeTranslate(t, 'evaluations.draftSaved', { defaultValue: 'Borrador guardado' }));
      void queryClient.invalidateQueries({ queryKey: ['evaluation', numericSubmissionId] });
      void queryClient.invalidateQueries({ queryKey: ['submissions', numericTaskId] });
    },
    onError: (error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response === 'object'
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
      const payload: { comment: string; score?: number | null; status: 'final' } = {
        comment: values.comment,
        status: 'final'
      };
      
      if (values.score !== undefined && !Number.isNaN(values.score)) {
        payload.score = values.score;
      } else {
        payload.score = null;
      }

      if (existingEvaluation) {
        return updateEvaluation(numericSubmissionId, existingEvaluation.id, payload);
      } else {
        return createEvaluation(numericSubmissionId, payload);
      }
    },
    onSuccess: () => {
      toast.success(safeTranslate(t, 'evaluations.finalSaved', { defaultValue: 'Evaluación final guardada y enviada' }));
      void queryClient.invalidateQueries({ queryKey: ['evaluation', numericSubmissionId] });
      void queryClient.invalidateQueries({ queryKey: ['submissions', numericTaskId] });
      void queryClient.invalidateQueries({ queryKey: ['events', numericEventId, 'deliverables-tracking'] });
      navigate(tenantPath(`dashboard/events/${eventId}/deliverables-tracking`));
    },
    onError: (error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response === 'object'
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
    toast.success(safeTranslate(t, 'evaluations.copied', { defaultValue: 'Texto copiado al campo de evaluación final' }));
  };

  if (eventLoading || submissionLoading || submissionsLoading || evaluationLoading || rubricsLoading) {
    return <Spinner fullHeight />;
  }

  if (!currentSubmission || !task) {
    return (
      <DashboardLayout title={safeTranslate(t, 'evaluations.pageTitle', { defaultValue: 'Evaluación' })}>
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {safeTranslate(t, 'evaluations.notFound', { defaultValue: 'Entrega no encontrada' })}
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const team = currentSubmission.team;

  // Construir el subtítulo del hero
  // Si hay fase: mostrar "Fase X - Nombre de fase" y debajo el nombre de la tarea
  // Si no hay fase: mostrar solo el nombre de la tarea
  const phaseName = phase ? getMultilingualText(phase.name, currentLang) : null;
  const heroSubtitle = phase 
    ? `${safeTranslate(t, 'phases.phase', { defaultValue: 'Fase' })} ${phase.id} - ${phaseName}`
    : null;
  const heroTaskTitle = getMultilingualText(task.title, currentLang);

  return (
    <DashboardLayout
      title={safeTranslate(t, 'evaluations.pageTitle', { defaultValue: 'Evaluación de Entrega' })}
      subtitle={
        heroSubtitle ? (
          <div className="flex flex-col gap-1">
            <span>{heroSubtitle}</span>
            <span className="text-sm font-normal">{heroTaskTitle}</span>
          </div>
        ) : (
          heroTaskTitle
        )
      }
    >
      <div className="space-y-6">
        {/* Grid con Card de Equipo y Proyecto y Card de Entregas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card de Equipo y Proyecto */}
          <Card>
            <CardHeader>
              <CardTitle>{safeTranslate(t, 'evaluations.teamAndProject', { defaultValue: 'Equipo y Proyecto' })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-2">{safeTranslate(t, 'teams.title', { defaultValue: 'Equipo' })}</h3>
                <p className="text-sm">{team.name}</p>
              </div>
              {team.project && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">{safeTranslate(t, 'teams.project', { defaultValue: 'Proyecto' })}</h3>
                  <p className="text-sm font-medium">{team.project.name}</p>
                  {team.project.summary && (
                    <p className="text-sm text-muted-foreground mt-1">{team.project.summary}</p>
                  )}
                  {team.project.problem && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-muted-foreground">{safeTranslate(t, 'teams.projectProblem', { defaultValue: 'Problema' })}</p>
                      <p className="text-sm">{team.project.problem}</p>
                    </div>
                  )}
                  {team.project.solution && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-muted-foreground">{safeTranslate(t, 'teams.projectSolution', { defaultValue: 'Solución' })}</p>
                      <p className="text-sm">{team.project.solution}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Entregas de la actividad */}
          <Card>
          <CardHeader>
            <CardTitle>{safeTranslate(t, 'evaluations.submissions', { defaultValue: 'Entregas de esta actividad' })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamSubmissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{safeTranslate(t, 'evaluations.noSubmissions', { defaultValue: 'No hay entregas' })}</p>
            ) : (
              teamSubmissions.map(submission => (
                <div key={submission.id} className={cn('rounded-md border p-4', submission.id === numericSubmissionId && 'border-primary bg-primary/5')}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {new Date(submission.submitted_at).toLocaleString(locale)}
                      </span>
                      <Badge variant={submission.status === 'final' ? 'default' : 'secondary'}>
                        {submission.status === 'final' ? safeTranslate(t, 'submissions.final', { defaultValue: 'Final' }) : safeTranslate(t, 'submissions.draft', { defaultValue: 'Borrador' })}
                      </Badge>
                    </div>
                  </div>
                  {submission.content && (
                    <p className="text-sm text-muted-foreground mb-2">{submission.content}</p>
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
              ))
            )}
          </CardContent>
        </Card>
        </div>

        {/* Rúbrica y Evaluación con IA */}
        <Card>
          <CardHeader>
            <CardTitle>{safeTranslate(t, 'evaluations.evaluationTools', { defaultValue: 'Herramientas de Evaluación' })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rubric ? (
              <div className="space-y-4">
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
                    onClick={() => aiEvaluationMutation.mutate()}
                    disabled={aiEvaluationMutation.isPending}
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
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {safeTranslate(t, 'evaluations.noRubric', { defaultValue: 'No hay rúbrica configurada para esta tarea' })}
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
                <label className="text-sm font-medium">
                  {safeTranslate(t, 'evaluations.score', { defaultValue: 'Puntuación' })}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  {...form.register('score', { 
                    valueAsNumber: true,
                    min: { value: 0, message: safeTranslate(t, 'evaluations.scoreMin', { defaultValue: 'La puntuación mínima es 0' }) },
                    max: { value: 10, message: safeTranslate(t, 'evaluations.scoreMax', { defaultValue: 'La puntuación máxima es 10' }) }
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
                  disabled={saveDraftMutation.isPending || saveFinalMutation.isPending}
                >
                  {saveDraftMutation.isPending ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'evaluations.saveDraft', { defaultValue: 'Guardar borrador' })}
                </Button>
                <Button
                  type="button"
                  onClick={form.handleSubmit((values) => saveFinalMutation.mutate(values))}
                  disabled={saveDraftMutation.isPending || saveFinalMutation.isPending}
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

export default EvaluationPage;

